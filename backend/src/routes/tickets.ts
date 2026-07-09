import { Router, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { db, signTicket, verifyTicketSignature, pubsub } from '../services/gcpService';

const router = Router();
const scannedTicketCache = new Set<string>(); // Memorystore (Redis) offline simulation cache

/**
 * [POST] /api/tickets/create
 * Internal/Operator endpoint to generate a new valid ticket
 */
router.post('/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, matchId, seat, gate } = req.body;
    if (!userId || !matchId || !seat || !gate) {
      res.status(400).json({ error: 'Missing required ticket fields' });
      return;
    }

    const ticketRef = db.collection('tickets').doc();
    const ticketId = ticketRef.id;

    // Cryptographically sign payload using KMS wrapper
    const encryptedPayload = await signTicket(ticketId, userId, seat, gate);

    const ticketData = {
      ticketId,
      userId,
      matchId,
      seat,
      gate,
      status: 'active',
      payload: encryptedPayload,
      createdAt: new Date(),
    };

    await ticketRef.set(ticketData);
    res.status(201).json(ticketData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * [POST] /api/tickets/scan
 * Simulates a hardware gate scanner node processing a QR code payload
 */
router.post('/scan', async (req: Request, res: Response): Promise<void> => {
  try {
    const { qrPayload } = req.body;
    if (!qrPayload) {
      res.status(400).json({ error: 'Missing scanned QR payload' });
      return;
    }

    // 1. Cryptographically verify signature (Zero Trust, tamper-proof payload check)
    let verifiedData: any;
    try {
      verifiedData = verifyTicketSignature(qrPayload);
    } catch (err: any) {
      res.status(403).json({ error: 'Fraud Alert: Invalid signature / Tampered QR payload' });
      return;
    }

    const { ticketId, userId, seat, gate } = verifiedData;

    // 2. Deduplicate using Memorystore/Cache (Defend against fast double scans / replay attacks)
    if (scannedTicketCache.has(ticketId)) {
      res.status(409).json({ error: 'Fraud Alert: Replay attack detected. Ticket already scanned.' });
      return;
    }

    // Fetch the ticket from Firestore to verify its current live state
    const ticketRef = db.collection('tickets').doc(ticketId);
    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      res.status(404).json({ error: 'Ticket not found in central registry' });
      return;
    }

    const ticketData = ticketDoc.data();
    if (ticketData?.status === 'scanned') {
      scannedTicketCache.add(ticketId); // Sync cache
      res.status(409).json({ error: 'Fraud Alert: Ticket has already been processed at a gate' });
      return;
    }

    // 3. Mark ticket as scanned & commit to Firestore
    await ticketRef.update({
      status: 'scanned',
      scanTime: adminFirestoreTimestamp(),
    });

    // Add to Redis cache (expires after 1 hour in a real scenario)
    scannedTicketCache.add(ticketId);
    setTimeout(() => scannedTicketCache.delete(ticketId), 60 * 60 * 1000);

    // 4. Publish Event to Pub/Sub to decouple analytics & notifications
    const eventPayload = {
      ticketId,
      userId,
      seat,
      gate,
      scanTime: new Date().toISOString(),
    };

    try {
      const topicName = 'projects/sstops-dev/topics/gate-scans';
      const dataBuffer = Buffer.from(JSON.stringify(eventPayload));
      await pubsub.topic(topicName).publishMessage({ data: dataBuffer });
    } catch (pubsubErr: any) {
      console.warn('Pub/Sub publish failed (using emulator fallback):', pubsubErr.message);
    }

    res.status(200).json({
      message: 'Access Granted',
      ticketId,
      seat,
      gate,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function adminFirestoreTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

export default router;
