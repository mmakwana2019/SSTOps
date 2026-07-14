import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Event-Driven Cloud Function (2nd Gen)
 * Listens to Pub/Sub 'gate-scans' events to asynchronously update crowd counts,
 * calculate rolling statistics, and trigger notifications when congestion thresholds are crossed.
 */
export const onTicketScanPubSub = onMessagePublished('gate-scans', async (event) => {
  try {
    const messageData = event.data.message.json;
    if (!messageData) {
      console.warn('Received empty message payload');
      return;
    }

    const { ticketId, userId, seat, gate, scanTime } = messageData;
    if (!ticketId || !gate) {
      console.warn('Received message missing required ticketId or gate');
      return;
    }
    console.log(`Processing scan for Ticket: ${ticketId}, User: ${userId}, Gate: ${gate}`);

    const gateRef = db.collection('gateStats').doc(gate);
    
    await db.runTransaction(async (transaction) => {
      const gateDoc = await transaction.get(gateRef);
      const data = gateDoc.data() || {};
      
      const currentRate = (data.flowRate || 0) + 1;
      let status = 'clear';

      // Simple warning thresholds
      if (currentRate > 150) {
        status = 'critical';
      } else if (currentRate > 80) {
        status = 'congested';
      }

      transaction.set(gateRef, {
        flowRate: currentRate,
        status,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      // Record a log in the rolling registry
      const logRef = db.collection('gateLogs').doc();
      transaction.set(logRef, {
        ticketId,
        userId,
        seat,
        gate,
        scanTime,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // Check if we need to emit a surge warning alert
    const gateDoc = await gateRef.get();
    const currentStatus = gateDoc.data()?.status;

    if (currentStatus === 'critical' || currentStatus === 'congested') {
      const alertRef = db.collection('alerts').doc();
      await alertRef.set({
        gate,
        severity: currentStatus === 'critical' ? 'high' : 'medium',
        message: `High passenger inflow rate detected at ${gate}. Current queue wait estimate is ${currentStatus === 'critical' ? '18 mins' : '10 mins'}.`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        active: true
      });
    }

  } catch (error: any) {
    console.error('Error in onTicketScanPubSub:', error.message);
  }
});

/**
 * HTTPS Event Trigger: Simulates FCM messaging for gate adjustments
 */
export const notifyGateDelay = onRequest({ cors: true }, async (req, res) => {
  try {
    const { ticketId, gate, reason } = req.body;
    if (!ticketId || !gate) {
      res.status(400).json({ error: 'Missing ticketId or gate parameter' });
      return;
    }

    // In production, fetch user associated with ticket, and send FCM payload:
    // admin.messaging().sendToDevice(...)
    
    const notificationLogRef = db.collection('notificationLogs').doc();
    await notificationLogRef.set({
      ticketId,
      gate,
      title: '⚠️ Gate Congestion Alert',
      body: `Due to high crowds, we recommend entering through ${gate}. ${reason || ''}`,
      sentAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: `Simulated FCM notification dispatched to Ticket Holder: ${ticketId}`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
