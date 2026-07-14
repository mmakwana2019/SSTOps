import axios from 'axios';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8082';

jest.setTimeout(15000);

describe('Backend API Contract Verification Tests', () => {
  let createdTicket: any = null;

  it('contract: should create a valid cryptographic ticket structure', async () => {
    const response = await axios.post(`${BACKEND_URL}/api/tickets/create`, {
      userId: 'contract_user_001',
      matchId: 'contract_match_101',
      seat: 'Block A, Row 1, Seat 10',
      gate: 'Gate A'
    });

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('ticketId');
    expect(response.data).toHaveProperty('payload');
    expect(response.data.status).toBe('active');
    expect(typeof response.data.payload).toBe('string');
    
    createdTicket = response.data;
  });

  it('contract: scanning should accept a valid cryptographic payload and deny a fake payload', async () => {
    // 1. Scan with valid payload
    const successRes = await axios.post(`${BACKEND_URL}/api/tickets/scan`, {
      qrPayload: createdTicket.payload
    });
    expect(successRes.status).toBe(200);
    expect(successRes.data.message).toBe('Access Granted');
    expect(successRes.data.seat).toBe('Block A, Row 1, Seat 10');

    // 2. Scan with forged payload
    let threw = false;
    try {
      await axios.post(`${BACKEND_URL}/api/tickets/scan`, {
        qrPayload: 'invalid-fake-qr-payload-kms-bypass-test'
      });
    } catch (err: any) {
      threw = true;
      expect(err.response.status).toBe(403);
      expect(err.response.data.error).toContain('Fraud Alert');
    }
    expect(threw).toBe(true);
  });

  it('contract: double scan must trigger replay fraud prevention', async () => {
    let threw = false;
    try {
      await axios.post(`${BACKEND_URL}/api/tickets/scan`, {
        qrPayload: createdTicket.payload
      });
    } catch (err: any) {
      threw = true;
      expect(err.response.status).toBe(409);
      const errMsg = err.response.data.error;
      const matches = errMsg.includes('already scanned') || errMsg.includes('processed at a gate');
      expect(matches).toBe(true);
    }
    expect(threw).toBe(true);
  });

  it('contract: fixture builder must detect venue, official, or broadcast conflicts', async () => {
    const testDate = `2026-08-${Math.floor(Math.random() * 1000000)}`;
    // 1. Create a base fixture
    const baseFixture = {
      team1: 'Royal Challengers',
      team2: 'Chennai Kings',
      date: testDate,
      time: '19:30',
      venue: 'Wankhede Stadium',
      officials: ['Official Alice', 'Official Bob'],
      broadcastSlot: 'StarSports 1 VIP'
    };

    const firstRes = await axios.post(`${BACKEND_URL}/api/fixtures/create`, baseFixture);
    expect(firstRes.status).toBe(201);

    // 2. Attempt to schedule overlapping match at same venue on same day (Conflict expected)
    let threw = false;
    try {
      await axios.post(`${BACKEND_URL}/api/fixtures/create`, {
        team1: 'Kolkata Knight Riders',
        team2: 'Delhi Daredevils',
        date: testDate,
        time: '19:30',
        venue: 'Wankhede Stadium', // same venue
        officials: ['Official Charlie'],
        broadcastSlot: 'StarSports 2'
      });
    } catch (err: any) {
      threw = true;
      expect(err.response.status).toBe(409);
      expect(err.response.data.error).toContain('Scheduling Conflict Detected');
      expect(err.response.data.conflicts[0]).toContain('Venue Conflict');
    }
    expect(threw).toBe(true);
  });
});
