import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

describe('Firestore Security Rules Unit Tests', () => {
  beforeAll(async () => {
    // Load rules from root directory
    const rulesPath = path.resolve(__dirname, '../firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'sstops-test-rules-project',
      firestore: {
        rules,
        host: 'localhost',
        port: 8080
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('allows a fan user to read/write their own profile doc', async () => {
    const aliceContext = testEnv.authenticatedContext('alice_uid');
    const db = aliceContext.firestore();

    const selfDoc = db.collection('users').doc('alice_uid');
    await assertSucceeds(selfDoc.set({ name: 'Alice', role: 'fan' }));
    await assertSucceeds(selfDoc.get());
  });

  it('denies a fan user from reading another profile doc', async () => {
    const aliceContext = testEnv.authenticatedContext('alice_uid');
    const bobContext = testEnv.authenticatedContext('bob_uid');

    // Create bob's profile as Bob
    await bobContext.firestore().collection('users').doc('bob_uid').set({ name: 'Bob', role: 'fan' });

    // Alice attempts to inspect Bob's profile
    const bobDocAsAlice = aliceContext.firestore().collection('users').doc('bob_uid');
    await assertFails(bobDocAsAlice.get());
  });

  it('allows a fan to view their own ticket, but denies accessing other tickets', async () => {
    const aliceContext = testEnv.authenticatedContext('alice_uid');
    const bobContext = testEnv.authenticatedContext('bob_uid');

    // Seed database with rules disabled
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('users').doc('cmd_uid').set({ role: 'command' });
      await db.collection('users').doc('alice_uid').set({ role: 'fan' });
      await db.collection('users').doc('bob_uid').set({ role: 'fan' });
      await db.collection('tickets').doc('ticket_123').set({ userId: 'alice_uid', seat: 'Sec 3', gate: 'Gate A', status: 'active' });
    });

    // Alice reads her ticket
    await assertSucceeds(aliceContext.firestore().collection('tickets').doc('ticket_123').get());

    // Bob attempts to read Alice's ticket
    await assertFails(bobContext.firestore().collection('tickets').doc('ticket_123').get());
  });

  it('denies fans from scheduling fixtures, but allows command staff', async () => {
    const aliceContext = testEnv.authenticatedContext('alice_uid');
    const commandContext = testEnv.authenticatedContext('cmd_uid');
    
    // Seed user roles with rules disabled
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('users').doc('alice_uid').set({ role: 'fan' });
      await db.collection('users').doc('cmd_uid').set({ role: 'command' });
    });

    const fixtureDocAlice = aliceContext.firestore().collection('fixtures').doc('match_999');
    const fixtureDocCmd = commandContext.firestore().collection('fixtures').doc('match_999');

    const fixturePayload = {
      team1: 'Team A',
      team2: 'Team B',
      date: '2026-10-10',
      time: '18:00',
      venue: 'Stadium X',
      officials: ['Official 1'],
      broadcastSlot: 'Channel 1'
    };

    // Alice fails
    await assertFails(fixtureDocAlice.set(fixturePayload));

    // Command succeeds
    await assertSucceeds(fixtureDocCmd.set(fixturePayload));
  });
});
