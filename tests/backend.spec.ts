import request from 'supertest';
import { app } from '../backend/src/server';
import jwt from 'jsonwebtoken';

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => {
  const mockFirestore = () => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockImplementation((id) => ({
      id: id || 'mock-id',
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          status: 'active',
          userId: 'user-123',
          gate: 'GateA',
          seat: 'Sec 1',
          payload: 'mock-payload',
          timestamp: new Date()
        }),
      }),
      set: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(true),
    })),
    get: jest.fn().mockResolvedValue({
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
    }),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    runTransaction: jest.fn().mockImplementation(async (callback) => {
      const mockTx = {
        get: jest.fn().mockImplementation((_ref) => {
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
        }),
        update: jest.fn(),
        set: jest.fn(),
      };
      return await callback(mockTx);
    }),
  });
  return {
    apps: [],
    initializeApp: jest.fn(),
    firestore: Object.assign(mockFirestore, {
      FieldValue: {
        serverTimestamp: jest.fn().mockReturnValue(new Date()),
      },
    }),
  };
});

// Mock Pub/Sub SDK
jest.mock('@google-cloud/pubsub', () => {
  return {
    PubSub: jest.fn().mockImplementation(() => ({
      topic: jest.fn().mockReturnThis(),
      publishMessage: jest.fn().mockResolvedValue('msg-id'),
    })),
  };
});

// Mock Vertex AI SDK
jest.mock('@google-cloud/vertexai', () => {
  return {
    VertexAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            candidates: [
              {
                content: {
                  parts: [{ text: 'Mocked Gemini Response' }],
                },
              },
            ],
          },
        }),
      }),
    })),
  };
});

describe('Smart Stadium Backend API Unit Tests', () => {
  
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

    it('POST /api/tickets/scan - should successfully scan a valid ticket', async () => {
      // Build a fake but signed token for verification
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
  });

  describe('Fixtures Endpoints', () => {
    it('GET /api/fixtures/list - should return list of scheduled fixtures', async () => {
      const res = await request(app).get('/api/fixtures/list');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].venue).toBe('Wankhede Stadium');
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
  });

  describe('Forecasting & Gemini Endpoints', () => {
    it('GET /api/forecasting/surge - should calculate projections correctly', async () => {
      const res = await request(app).get('/api/forecasting/surge');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('predictions');
    });

    it('POST /api/gemini/chat - should communicate with Vertex AI or simulator', async () => {
      const res = await request(app)
        .post('/api/gemini/chat')
        .send({ prompt: 'Where is the restroom?' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('response');
    });

    it('POST /api/gemini/summarize - should generate shift handover summary', async () => {
      const res = await request(app)
        .post('/api/gemini/summarize')
        .send({ shiftId: 'morning-shift-1' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
    });

    it('POST /api/gemini/report - should generate post-match reconciliation report', async () => {
      const res = await request(app)
        .post('/api/gemini/report')
        .send({ matchId: 'match-101' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('report');
    });
  });
});
