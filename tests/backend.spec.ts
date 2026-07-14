import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mutable mock functions to control behavior per-test
const mockDocGet = jest.fn();
const mockDocSet = jest.fn();
const mockDocUpdate = jest.fn();
const mockCollectionGet = jest.fn();
const mockTransactionGet = jest.fn();
const mockPubSubPublish = jest.fn();
const mockCallGemini = jest.fn();

// Mock Firebase Admin FieldValue locally for mock behavior
const mockFieldValue = {
  serverTimestamp: jest.fn().mockReturnValue(new Date()),
};

// Mock gcpService module completely
jest.doMock('../backend/src/services/gcpService', () => {
  return {
    db: {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockImplementation((id) => ({
        id: id || 'mock-id',
        get: mockDocGet,
        set: mockDocSet,
        update: mockDocUpdate,
      })),
      get: mockCollectionGet,
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      runTransaction: jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          get: mockTransactionGet,
          update: mockDocUpdate,
          set: mockDocSet,
        };
        return await callback(mockTx);
      }),
    },
    pubsub: {
      topic: jest.fn().mockReturnThis(),
      publishMessage: mockPubSubPublish,
    },
    signTicket: async (ticketId: string, userId: string, seat: string, gate: string) => {
      const payload = { ticketId, userId, seat, gate, iss: 'sstops-platform', iat: Math.floor(Date.now() / 1000) };
      return jwt.sign(payload, 'stadium-secret-key-1337-kms');
    },
    verifyTicketSignature: (token: string) => {
      try {
        return jwt.verify(token, 'stadium-secret-key-1337-kms');
      } catch (err) {
        throw new Error('Tamper-proof ticket verification failed');
      }
    },
    callGemini: mockCallGemini,
  };
});

// Import the Express app AFTER applying the mocks
const { app } = require('../backend/src/server');

describe('Smart Stadium Backend API Unit Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set default mock implementations
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        status: 'active',
        userId: 'user-123',
        gate: 'GateA',
        seat: 'Sec 1',
        payload: 'mock-payload',
        timestamp: new Date()
      }),
    });
    mockDocSet.mockResolvedValue(true);
    mockDocUpdate.mockResolvedValue(true);
    
    mockCollectionGet.mockResolvedValue({
      forEach: (callback: any) => {
        callback({
          id: 'fixture-1',
          data: () => ({
            venue: 'Wankhede Stadium',
            officials: ['Official Alice'],
            broadcastSlot: 'StarSports 1',
            team1: 'Team A',
            team2: 'Team B',
          }),
        });
      },
    });

    mockTransactionGet.mockImplementation((_ref: any) => {
      return {
        exists: true,
        data: () => ({
          status: 'active',
          userId: 'user-123',
          gate: 'GateA',
          seat: 'Sec 1',
          officials: ['Official Alice'],
          venue: 'Wankhede Stadium',
          broadcastSlot: 'StarSports 1'
        }),
        forEach: (cb: any) => {
          cb({
            id: 'fixture-1',
            data: () => ({
              venue: 'Wankhede Stadium',
              officials: ['Official Alice'],
              broadcastSlot: 'StarSports 1',
              team1: 'Team A',
              team2: 'Team B',
            }),
          });
        }
      };
    });

    mockPubSubPublish.mockResolvedValue('msg-id');

    mockCallGemini.mockImplementation(async (prompt: string, _context?: string) => {
      if (prompt === 'handover') {
        return 'Mocked Handover Summary';
      }
      if (prompt === 'report') {
        return 'Mocked Reconciliation Report';
      }
      return 'Mocked Gemini Response';
    });
  });

  it('GET /api/health - should return HEALTHY status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('HEALTHY');
  });

  describe('Tickets Endpoints', () => {
    it('POST /api/tickets/create - should create a new cryptographic ticket', async () => {
      const res = await request(app)
        .post('/api/tickets/create')
        .send({
          userId: 'user-001',
          matchId: 'match-001',
          seat: 'Sec A, Row 1, Seat 1',
          gate: 'GateA'
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('ticketId');
      expect(res.body).toHaveProperty('payload');
      expect(res.body.status).toBe('active');
    });

    it('POST /api/tickets/create - should fail on missing parameter', async () => {
      const res = await request(app)
        .post('/api/tickets/create')
        .send({
          userId: 'user-001'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required ticket fields');
    });

    it('POST /api/tickets/create - should return 500 on db write failure', async () => {
      mockDocSet.mockRejectedValueOnce(new Error('DB Write Failed'));
      const res = await request(app)
        .post('/api/tickets/create')
        .send({
          userId: 'user-001',
          matchId: 'match-001',
          seat: 'Sec A, Row 1, Seat 1',
          gate: 'GateA'
        });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB Write Failed');
    });

    it('POST /api/tickets/scan - should successfully scan a valid ticket', async () => {
      const payload = { ticketId: 'ticket-123', userId: 'user-123', seat: 'Sec 1', gate: 'GateA' };
      const secret = 'stadium-secret-key-1337-kms';
      const token = jwt.sign(payload, secret);

      const res = await request(app)
        .post('/api/tickets/scan')
        .send({ qrPayload: token });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Access Granted');
      expect(res.body.ticketId).toBe('ticket-123');
    });

    it('POST /api/tickets/scan - should reject fake signature payload', async () => {
      const res = await request(app)
        .post('/api/tickets/scan')
        .send({ qrPayload: 'forged-payload-signature' });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Fraud Alert');
    });

    it('POST /api/tickets/scan - should return 400 if qrPayload is missing', async () => {
      const res = await request(app)
        .post('/api/tickets/scan')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing scanned QR payload');
    });

    it('POST /api/tickets/scan - should return 404 if ticket not found in central registry', async () => {
      const payload = { ticketId: 'ticket-404', userId: 'user-123', seat: 'Sec 1', gate: 'GateA' };
      const secret = 'stadium-secret-key-1337-kms';
      const token = jwt.sign(payload, secret);

      mockTransactionGet.mockReturnValueOnce({ exists: false });

      const res = await request(app)
        .post('/api/tickets/scan')
        .send({ qrPayload: token });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Ticket not found in central registry');
    });

    it('POST /api/tickets/scan - should return 409 if ticket already processed', async () => {
      const payload = { ticketId: 'ticket-409', userId: 'user-123', seat: 'Sec 1', gate: 'GateA' };
      const secret = 'stadium-secret-key-1337-kms';
      const token = jwt.sign(payload, secret);

      mockTransactionGet.mockReturnValueOnce({
        exists: true,
        data: () => ({ status: 'scanned' })
      });

      const res = await request(app)
        .post('/api/tickets/scan')
        .send({ qrPayload: token });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('processed at a gate');
    });

    it('POST /api/tickets/scan - should return 409 on duplicate scan within 1 hour (replay cache)', async () => {
      const payload = { ticketId: 'ticket-cache-test', userId: 'user-123', seat: 'Sec 1', gate: 'GateA' };
      const secret = 'stadium-secret-key-1337-kms';
      const token = jwt.sign(payload, secret);

      const res1 = await request(app).post('/api/tickets/scan').send({ qrPayload: token });
      expect(res1.status).toBe(200);

      const res2 = await request(app).post('/api/tickets/scan').send({ qrPayload: token });
      expect(res2.status).toBe(409);
      expect(res2.body.error).toContain('Replay attack detected');
    });

    it('POST /api/tickets/scan - should return 500 on unexpected transaction failure', async () => {
      const payload = { ticketId: 'ticket-500', userId: 'user-123', seat: 'Sec 1', gate: 'GateA' };
      const secret = 'stadium-secret-key-1337-kms';
      const token = jwt.sign(payload, secret);

      mockTransactionGet.mockRejectedValueOnce(new Error('Tx Failed'));

      const res = await request(app)
        .post('/api/tickets/scan')
        .send({ qrPayload: token });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Tx Failed');
    });

    it('POST /api/tickets/scan - should succeed even if Pub/Sub publish fails', async () => {
      const payload = { ticketId: 'ticket-pubsub-fail', userId: 'user-123', seat: 'Sec 1', gate: 'GateA' };
      const secret = 'stadium-secret-key-1337-kms';
      const token = jwt.sign(payload, secret);

      mockPubSubPublish.mockRejectedValueOnce(new Error('PubSub offline'));

      const res = await request(app)
        .post('/api/tickets/scan')
        .send({ qrPayload: token });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Access Granted');
    });
  });

  describe('Fixtures Endpoints', () => {
    it('GET /api/fixtures/list - should return list of scheduled fixtures', async () => {
      const res = await request(app).get('/api/fixtures/list');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].venue).toBe('Wankhede Stadium');
    });

    it('GET /api/fixtures/list - should return 500 on db read failure', async () => {
      mockCollectionGet.mockRejectedValueOnce(new Error('Read error'));
      const res = await request(app).get('/api/fixtures/list');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Read error');
    });

    it('POST /api/fixtures/create - should fail if officials is not an array', async () => {
      const res = await request(app)
        .post('/api/fixtures/create')
        .send({
          team1: 'KKR',
          team2: 'MI',
          date: '2026-08-10',
          time: '19:30',
          venue: 'Wankhede Stadium',
          officials: 'NotAnArray',
          broadcastSlot: 'StarSports 1'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Officials must be an array');
    });

    it('POST /api/fixtures/create - should return 400 if missing properties', async () => {
      const res = await request(app)
        .post('/api/fixtures/create')
        .send({ team1: 'KKR' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing scheduling properties');
    });

    it('POST /api/fixtures/create - should successfully schedule a fixture', async () => {
      mockTransactionGet.mockReturnValueOnce({
        forEach: () => {}
      });

      const res = await request(app)
        .post('/api/fixtures/create')
        .send({
          team1: 'Team A',
          team2: 'Team B',
          date: '2026-09-01',
          time: '19:30',
          venue: 'Stadium Y',
          officials: ['Official X'],
          broadcastSlot: 'Channel 1'
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('scheduled successfully');
    });

    it('POST /api/fixtures/create - should return 409 conflict on venue clash', async () => {
      mockTransactionGet.mockReturnValueOnce({
        forEach: (cb: any) => {
          cb({
            id: 'fixture-1',
            data: () => ({
              venue: 'Wankhede Stadium',
              officials: ['Official Charlie'],
              broadcastSlot: 'Channel 2',
              team1: 'Team A',
              team2: 'Team B',
            })
          });
        }
      });

      const res = await request(app)
        .post('/api/fixtures/create')
        .send({
          team1: 'KKR',
          team2: 'MI',
          date: '2026-08-10',
          time: '19:30',
          venue: 'Wankhede Stadium',
          officials: ['Official Alice'],
          broadcastSlot: 'Channel 1'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Scheduling Conflict Detected');
      expect(res.body.conflicts[0]).toContain('Venue Conflict');
    });

    it('POST /api/fixtures/create - should return 409 conflict on official clash', async () => {
      mockTransactionGet.mockReturnValueOnce({
        forEach: (cb: any) => {
          cb({
            id: 'fixture-1',
            data: () => ({
              venue: 'Eden Gardens',
              officials: ['Official Alice'],
              broadcastSlot: 'Channel 2',
              team1: 'Team A',
              team2: 'Team B',
            })
          });
        }
      });

      const res = await request(app)
        .post('/api/fixtures/create')
        .send({
          team1: 'KKR',
          team2: 'MI',
          date: '2026-08-10',
          time: '19:30',
          venue: 'Wankhede Stadium',
          officials: ['Official Alice'],
          broadcastSlot: 'Channel 1'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Scheduling Conflict Detected');
      expect(res.body.conflicts[0]).toContain('Official Assignment Conflict');
    });

    it('POST /api/fixtures/create - should return 409 conflict on broadcast slot clash', async () => {
      mockTransactionGet.mockReturnValueOnce({
        forEach: (cb: any) => {
          cb({
            id: 'fixture-1',
            data: () => ({
              venue: 'Eden Gardens',
              officials: ['Official Charlie'],
              broadcastSlot: 'Channel 1',
              team1: 'Team A',
              team2: 'Team B',
            })
          });
        }
      });

      const res = await request(app)
        .post('/api/fixtures/create')
        .send({
          team1: 'KKR',
          team2: 'MI',
          date: '2026-08-10',
          time: '19:30',
          venue: 'Wankhede Stadium',
          officials: ['Official Alice'],
          broadcastSlot: 'Channel 1'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Scheduling Conflict Detected');
      expect(res.body.conflicts[0]).toContain('Broadcast Slot Conflict');
    });

    it('POST /api/fixtures/create - should return 500 on db error', async () => {
      mockTransactionGet.mockRejectedValueOnce(new Error('Tx Fail'));
      const res = await request(app)
        .post('/api/fixtures/create')
        .send({
          team1: 'KKR',
          team2: 'MI',
          date: '2026-08-10',
          time: '19:30',
          venue: 'Wankhede Stadium',
          officials: ['Official Alice'],
          broadcastSlot: 'Channel 1'
        });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Tx Fail');
    });
  });

  describe('Vision Telemetry Endpoints', () => {
    it('POST /api/vision/crowd - should accept valid count and update Firestore', async () => {
      const res = await request(app)
        .post('/api/vision/crowd')
        .send({
          zoneId: 'GateA',
          count: 120
        });
      expect(res.status).toBe(200);
      expect(res.body.anonymousCount).toBe(120);
    });

    it('POST /api/vision/crowd - should reject negative telemetry count', async () => {
      const res = await request(app)
        .post('/api/vision/crowd')
        .send({
          zoneId: 'GateA',
          count: -5
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Count must be a non-negative integer');
    });

    it('POST /api/vision/crowd - should reject non-integer telemetry count', async () => {
      const res = await request(app)
        .post('/api/vision/crowd')
        .send({
          zoneId: 'GateA',
          count: 22.5
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Count must be a non-negative integer');
    });

    it('POST /api/vision/crowd - should return 400 on missing parameters', async () => {
      const res = await request(app)
        .post('/api/vision/crowd')
        .send({ zoneId: 'GateA' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing zoneId or count parameter');
    });

    it('POST /api/vision/crowd - should return 500 on db write failure', async () => {
      mockDocSet.mockRejectedValueOnce(new Error('DB Write Error'));
      const res = await request(app)
        .post('/api/vision/crowd')
        .send({ zoneId: 'GateA', count: 150 });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB Write Error');
    });
  });

  describe('Forecasting & Gemini Endpoints', () => {
    it('GET /api/forecasting/surge - should calculate projections correctly', async () => {
      const res = await request(app).get('/api/forecasting/surge');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('predictions');
    });

    it('GET /api/forecasting/surge - should return 500 on db read failure', async () => {
      mockCollectionGet.mockRejectedValueOnce(new Error('Read failure'));
      const res = await request(app).get('/api/forecasting/surge');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Read failure');
    });

    it('GET /api/forecasting/surge - should correctly trigger rising and critical trends based on scan volumes', async () => {
      const mockTickets: any[] = [];
      for (let i = 0; i < 500; i++) {
        mockTickets.push({ data: () => ({ gate: 'GateA', status: 'scanned' }) });
      }
      for (let i = 0; i < 900; i++) {
        mockTickets.push({ data: () => ({ gate: 'GateB', status: 'scanned' }) });
      }

      mockCollectionGet.mockResolvedValueOnce({
        forEach: (cb: any) => {
          mockTickets.forEach(t => cb(t));
        }
      });

      const res = await request(app).get('/api/forecasting/surge');
      expect(res.status).toBe(200);

      const gateAPred = res.body.predictions.find((p: any) => p.gate === 'GateA');
      const gateBPred = res.body.predictions.find((p: any) => p.gate === 'GateB');

      expect(gateAPred.trend).toBe('rising');
      expect(gateAPred.alert).toBe(true);

      expect(gateBPred.trend).toBe('critical');
      expect(gateBPred.alert).toBe(true);
    });

    it('POST /api/gemini/chat - should communicate with Vertex AI or simulator', async () => {
      const res = await request(app)
        .post('/api/gemini/chat')
        .send({ prompt: 'Where is the restroom?' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('response');
    });

    it('POST /api/gemini/chat - should return 400 if prompt is missing', async () => {
      const res = await request(app)
        .post('/api/gemini/chat')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Prompt is required');
    });

    it('POST /api/gemini/chat - should return 500 on Gemini generation failure', async () => {
      mockCallGemini.mockRejectedValueOnce(new Error('AI Offline'));
      const res = await request(app)
        .post('/api/gemini/chat')
        .send({ prompt: 'Hello' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('AI Offline');
    });

    it('POST /api/gemini/summarize - should generate shift handover summary', async () => {
      const res = await request(app)
        .post('/api/gemini/summarize')
        .send({ shiftId: 'morning-shift-1' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
    });

    it('POST /api/gemini/summarize - should return 500 on db read failure', async () => {
      mockCollectionGet.mockRejectedValueOnce(new Error('DB Read Error'));
      const res = await request(app)
        .post('/api/gemini/summarize')
        .send({ shiftId: 'morning-shift-1' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB Read Error');
    });

    it('POST /api/gemini/report - should generate post-match reconciliation report', async () => {
      const res = await request(app)
        .post('/api/gemini/report')
        .send({ matchId: 'match-101' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('report');
    });

    it('POST /api/gemini/report - should return 500 on Gemini generation failure', async () => {
      mockCallGemini.mockRejectedValueOnce(new Error('Vertex Error'));
      const res = await request(app)
        .post('/api/gemini/report')
        .send({ matchId: 'match-101' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Vertex Error');
    });
  });

  describe('Server Logging and Fallback Routes', () => {
    it('should censor PII from the request body in logging middleware', async () => {
      const res = await request(app)
        .post('/api/tickets/create')
        .send({
          userId: 'user-001',
          matchId: 'match-001',
          seat: 'Sec A',
          gate: 'GateA',
          email: 'test@example.com',
          phone: '1234567890'
        });
      expect(res.status).toBe(201);
    });

    it('should fall back to wildcard SPA index route and trigger 500 error if file not found', async () => {
      const res = await request(app).get('/some-random-spa-page-123');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');
    });
  });
});
