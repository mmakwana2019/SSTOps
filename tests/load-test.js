import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * k6 Load Test Blueprint
 * Simulates peak entry velocity at stadium gates.
 * Target Load: 200 scans/second representing fans pouring in before match time.
 */
export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 virtual users
    { duration: '1m', target: 50 },  // Stay at 50 users (peak flow)
    { duration: '15s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<150'], // 95% of scans must complete under 150ms
    http_req_failed: ['rate<0.01'],    // Under 1% failure rate
  },
};

const BASE_URL = 'http://localhost:8082';

// Mock list of pre-signed ticket payloads
const mockTickets = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aWNrZXRJZCI6Im1vY2tfMV9rNiIsInVzZXJJZCI6ImZhbl8xIiwic2VhdCI6IkJsb2NrIEEiLCJnYXRlIjoiR2F0ZSBBIiwiaXNzIjoic3N0b3BzLXBsYXRmb3JtIiwiaWF0IjoxNzEzNDU2Nzg5fQ.fake_sig1',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aWNrZXRJZCI6Im1vY2tfMl9rNiIsInVzZXJJZCI6ImZhbl8yIiwic2VhdCI6IkJsb2NrIEIiLCJnYXRlIjoiR2F0ZSBCIiwiaXNzIjoic3N0b3BzLXBsYXRmb3JtIiwiaWF0IjoxNzEzNDU2Nzg5fQ.fake_sig2',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aWNrZXRJZCI6Im1vY2tfM19rNiIsInVzZXJJZCI6ImZhbl8zIiwic2VhdCI6IkJsb2NrIEMiLCJnYXRlIjoiR2F0ZSBDIiwiaXNzIjoic3N0b3BzLXBsYXRmb3JtIiwiaWF0IjoxNzEzNDU2Nzg5fQ.fake_sig3'
];

export default function () {
  const payload = JSON.stringify({
    qrPayload: mockTickets[Math.floor(Math.random() * mockTickets.length)]
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(`${BASE_URL}/api/tickets/scan`, payload, params);

  // Validate response contract
  check(response, {
    'status is 200 or 409 (valid payload / duplicate scan)': (r) => r.status === 200 || r.status === 409,
    'latency is short': (r) => r.timings.duration < 200,
  });

  sleep(0.1); // Sleep 100ms per virtual user iteration to achieve target rate
}
