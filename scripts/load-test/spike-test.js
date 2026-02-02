/**
 * K6 Spike Test Script for PDF Quiz Generator
 *
 * Purpose: Test system behavior under sudden load spikes
 * Run with: k6 run scripts/load-test/spike-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const recoveryTime = new Trend('recovery_time');
const spikeErrors = new Counter('spike_errors');
const successRate = new Rate('success_rate');

export const options = {
  // Spike pattern
  stages: [
    { duration: '10s', target: 1 }, // Warm up
    { duration: '1m', target: 1 }, // Normal operation
    { duration: '10s', target: 25 }, // Sudden spike!
    { duration: '3m', target: 25 }, // Hold spike
    { duration: '10s', target: 1 }, // Quick drop
    { duration: '3m', target: 1 }, // Recovery phase
    { duration: '10s', target: 25 }, // Another spike!
    { duration: '3m', target: 25 }, // Hold spike
    { duration: '1m', target: 0 }, // Ramp down
  ],

  thresholds: {
    http_req_duration: ['p(95)<3000'], // Allow up to 3s during spikes
    http_req_failed: ['rate<0.15'], // Up to 15% failures during spikes
    success_rate: ['rate>0.75'], // At least 75% success
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;

export default function () {
  const startTime = Date.now();

  // Test authentication endpoint under spike
  const loginRes = http.post(
    `${API_URL}/auth/login`,
    JSON.stringify({
      email: `spiketest${__VU}@example.com`,
      password: 'Test123!',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const success = check(loginRes, {
    'login response received': (r) => r.status !== 0,
    'login not rate limited': (r) => r.status !== 429,
  });

  if (!success || loginRes.status >= 500) {
    spikeErrors.add(1);
  }

  successRate.add(loginRes.status === 200);

  // Track time to get a response
  recoveryTime.add(Date.now() - startTime);

  let accessToken = null;
  if (loginRes.status === 200) {
    try {
      const body = JSON.parse(loginRes.body);
      accessToken = body.data?.tokens?.accessToken;
    } catch (e) {
      // Parse error
    }
  }

  // Quick API call if logged in
  if (accessToken) {
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
    };

    const dashboardRes = http.batch([
      ['GET', `${API_URL}/pdfs`, null, { headers: authHeaders }],
      ['GET', `${API_URL}/quiz-sessions`, null, { headers: authHeaders }],
      ['GET', `${API_URL}/analytics/streaks`, null, { headers: authHeaders }],
    ]);

    for (const res of dashboardRes) {
      check(res, {
        'dashboard call OK': (r) => r.status < 500,
      });

      if (res.status >= 500) {
        spikeErrors.add(1);
      }

      successRate.add(res.status === 200);
    }

    // Logout
    http.post(`${API_URL}/auth/logout`, '{}', {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
    });
  }

  sleep(0.5);
}

export function handleSummary(data) {
  console.log('\n=== SPIKE TEST SUMMARY ===\n');

  const metrics = data.metrics;

  console.log('Response Time During Spikes:');
  console.log(`  Average: ${Math.round(metrics.http_req_duration.values.avg)}ms`);
  console.log(`  p95: ${Math.round(metrics.http_req_duration.values['p(95)'])}ms`);
  console.log(`  Max: ${Math.round(metrics.http_req_duration.values.max)}ms`);

  console.log('\nRecovery Metrics:');
  console.log(`  Average Recovery Time: ${Math.round(metrics.recovery_time?.values.avg || 0)}ms`);
  console.log(`  Max Recovery Time: ${Math.round(metrics.recovery_time?.values.max || 0)}ms`);

  console.log('\nError Metrics:');
  console.log(`  Spike Errors: ${metrics.spike_errors?.values.count || 0}`);
  console.log(`  Success Rate: ${(metrics.success_rate?.values.rate * 100 || 0).toFixed(2)}%`);

  if (metrics.http_req_failed.values.rate < 0.1) {
    console.log('\n✅ System handled spikes well (error rate < 10%)');
  } else if (metrics.http_req_failed.values.rate < 0.2) {
    console.log('\n⚠️  System degraded under spikes (error rate 10-20%)');
  } else {
    console.log('\n❌ System struggled with spikes (error rate > 20%)');
  }

  return {
    'spike-summary.json': JSON.stringify(data, null, 2),
  };
}
