import { Router, Request, Response } from 'express';
import { db } from '../services/gcpService';

const router = Router();

/**
 * [POST] /api/vision/crowd
 * Edge receiver for anonymized CCTV count streams.
 * Zero raw video feeds leave the local stadium boundary. Only aggregate numbers are passed.
 */
router.post('/crowd', async (req: Request, res: Response): Promise<void> => {
  try {
    const { zoneId, count } = req.body;
    if (!zoneId || count === undefined) {
      res.status(400).json({ error: 'Missing zoneId or count parameter' });
      return;
    }

    // Update Firestore with the new aggregate occupancy count
    const gateRef = db.collection('gateStats').doc(zoneId);
    await gateRef.set({
      flowRate: count, // Representing current occupancy count in this concourse/gate area
      status: count > 300 ? 'critical' : count > 150 ? 'congested' : 'clear',
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    res.status(200).json({
      message: 'Successfully processed edge vision telemetry',
      zoneId,
      anonymousCount: count,
      compliance: 'Zero PII Retained. Edge processing complete.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
