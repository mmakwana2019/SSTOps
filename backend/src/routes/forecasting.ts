import { Router, Request, Response } from 'express';
import { db } from '../services/gcpService';

const router = Router();

/**
 * [GET] /api/forecasting/surge
 * Analyzes gate scanning velocity and forecasts crowd surges over the next 15-30 mins
 */
router.get('/surge', async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Fetch current ticket scan counts to evaluate actual velocity
    const ticketsSnapshot = await db.collection('tickets')
      .where('status', '==', 'scanned')
      .get();
    
    // Distribute scan timestamps across gates for demonstration purposes
    const gateScanCounts: Record<string, number> = { GateA: 0, GateB: 0, GateC: 0, GateD: 0 };
    
    ticketsSnapshot.forEach(doc => {
      const data = doc.data();
      const gate = data.gate || 'GateA';
      if (gateScanCounts[gate] !== undefined) {
        gateScanCounts[gate]++;
      }
    });

    // 2. Project future surge risk based on scan frequency patterns
    const gateCapacities = { GateA: 5000, GateB: 5000, GateC: 5000, GateD: 5000 };
    const scanVelocity = {
      GateA: Math.min(Math.floor(gateScanCounts.GateA * 0.15), 120), // mock current rate (scans/min)
      GateB: Math.min(Math.floor(gateScanCounts.GateB * 0.12), 150),
      GateC: Math.min(Math.floor(gateScanCounts.GateC * 0.08), 40),
      GateD: Math.min(Math.floor(gateScanCounts.GateD * 0.05), 30),
    };

    // Calculate prediction models for the next 15 minutes (Vertex AI Forecasting simulator)
    const projections = Object.keys(scanVelocity).map(gate => {
      const currentRate = scanVelocity[gate as keyof typeof scanVelocity];
      const capacity = gateCapacities[gate as keyof typeof gateCapacities];
      
      // Calculate a trend vector
      let trend: 'stable' | 'rising' | 'critical' = 'stable';
      let predictedSurgeTime = 0;
      let alert = false;
      let suggestion = 'All clear. Monitor flow.';

      if (currentRate > 100) {
        trend = 'critical';
        alert = true;
        predictedSurgeTime = 12; // minutes to reach critical capacity limit
        suggestion = `Critical crowd load! Re-route inbound traffic from local transit to Gate C. Dispatch 4 backup crowd control agents immediately.`;
      } else if (currentRate > 60) {
        trend = 'rising';
        alert = true;
        predictedSurgeTime = 25; // minutes to queue overload
        suggestion = `Rising pressure at ${gate}. Prepare to open secondary turnstiles. Staff alert issued.`;
      }

      return {
        gate,
        currentVelocity: currentRate,
        capacity,
        trend,
        alert,
        predictedSurgeTime,
        suggestion,
      };
    });

    res.status(200).json({
      timestamp: new Date().toISOString(),
      predictions: projections,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
