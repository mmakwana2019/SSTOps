import { Router, Request, Response } from 'express';
import { callGemini, db } from '../services/gcpService';

const router = Router();

/**
 * [POST] /api/gemini/chat
 * Conversational Fan Assistant supporting Hindi, Marathi, and English
 */
router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, language } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const systemContext = `You are a helpful multilingual stadium assistant. The current language is ${language || 'English'}. Respond concisely. Keep the tone friendly and direct.`;
    const responseText = await callGemini(prompt, systemContext);
    res.status(200).json({ response: responseText });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * [POST] /api/gemini/summarize
 * Summarizes live logs for shift handover
 */
router.post('/summarize', async (req: Request, res: Response): Promise<void> => {
  try {
    const { shiftId } = req.body;
    
    // Fetch recent incidents from Firestore to summarize
    const snapshot = await db.collection('incidents')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const incidentsList: any[] = [];
    snapshot.forEach(doc => {
      incidentsList.push(doc.data());
    });

    const context = `Summarize the following incident logs for the command center shift handover. Logged incidents: ${JSON.stringify(incidentsList)}`;
    const summary = await callGemini('handover', context);

    res.status(200).json({ summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * [POST] /api/gemini/report
 * Generates a post-match tournament report utilizing analytical data
 */
router.post('/report', async (req: Request, res: Response): Promise<void> => {
  try {
    const { matchId } = req.body;

    // Simulate querying historical BigQuery metrics
    const mockBigQueryData = {
      matchId: matchId || 'match-101',
      totalTicketsSold: 32500,
      actualAttendance: 31120,
      revenueInr: 48750000,
      peakScanVelocity: 415,
      resolvedIncidents: 3,
      avgWaitTimeMinutes: 8.5
    };

    const context = `Create a professional tournament operations and ticket sales reconciliation report based on this data: ${JSON.stringify(mockBigQueryData)}`;
    const reportText = await callGemini('report', context);

    res.status(200).json({ report: reportText });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
