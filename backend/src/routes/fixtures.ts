import { Router, Request, Response } from 'express';
import { db } from '../services/gcpService';

const router = Router();

/**
 * [GET] /api/fixtures/list
 * List scheduled fixtures
 */
router.get('/list', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('fixtures').get();
    const fixtures: any[] = [];
    snapshot.forEach(doc => {
      fixtures.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json(fixtures);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * [POST] /api/fixtures/create
 * Schedules a fixture after running strict conflict checks
 */
router.post('/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const { team1, team2, date, time, venue, officials, broadcastSlot } = req.body;

    if (!team1 || !team2 || !date || !time || !venue || !officials || !broadcastSlot) {
      res.status(400).json({ error: 'Missing scheduling properties' });
      return;
    }

    // 1. Fetch existing fixtures on that date to perform conflict checks
    const snapshot = await db.collection('fixtures').where('date', '==', date).get();
    const existingFixtures: any[] = [];
    snapshot.forEach(doc => {
      existingFixtures.push({ id: doc.id, ...doc.data() });
    });

    const conflicts: string[] = [];

    for (const fixture of existingFixtures) {
      // 1.1 Venue double-booking conflict
      if (fixture.venue.toLowerCase() === venue.toLowerCase()) {
        conflicts.push(`Venue Conflict: ${venue} is already booked for ${fixture.team1} vs ${fixture.team2} on this date.`);
      }

      // 1.2 Official availability conflict
      const overlappingOfficials = officials.filter((official: string) => 
        fixture.officials.map((o: string) => o.toLowerCase()).includes(official.toLowerCase())
      );
      if (overlappingOfficials.length > 0) {
        conflicts.push(`Official Assignment Conflict: Match official(s) (${overlappingOfficials.join(', ')}) are already assigned to ${fixture.team1} vs ${fixture.team2} on this date.`);
      }

      // 1.3 Broadcast slot conflict
      if (fixture.broadcastSlot.toLowerCase() === broadcastSlot.toLowerCase()) {
        conflicts.push(`Broadcast Slot Conflict: Broadcast slot '${broadcastSlot}' is already allocated to ${fixture.team1} vs ${fixture.team2} on this date.`);
      }
    }

    // If conflicts exist, return error response containing conflicts
    if (conflicts.length > 0) {
      res.status(409).json({
        error: 'Scheduling Conflict Detected',
        conflicts,
      });
      return;
    }

    // 2. Commit fixture to Firestore
    const fixtureRef = db.collection('fixtures').doc();
    const fixtureData = {
      fixtureId: fixtureRef.id,
      team1,
      team2,
      date,
      time,
      venue,
      officials,
      broadcastSlot,
      createdAt: new Date(),
    };

    await fixtureRef.set(fixtureData);

    res.status(201).json({
      message: 'Fixture scheduled successfully',
      fixture: fixtureData
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
