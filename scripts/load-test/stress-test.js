/**
 * K6 Stress Test Script for PDF Quiz Generator
 *
 * Purpose: Find the breaking point of the system
 * Run with: k6 run scripts/load-test/stress-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const apiErrors = new Counter('api_errors');
const breakingPointHit = new Counter('breaking_point_hit');
const successRate = new Rate('success_rate');
const responseTime = new Trend('response_time');

export const options = {
  // Stress test pattern - aggressive ramp-up
  stages: [
    { duration: '2m', target: 10 }, // Below normal load
    { duration: '5m', target: 10 }, // Normal load
    { duration: '2m', target: 20 }, // Around breaking point
    { duration: '5m', target: 20 }, // Around breaking point
    { duration: '2m', target: 30 }, // Beyond breaking point
    { duration: '5m', target: 30 }, // Beyond breaking point
    { duration: '2m', target: 50 }, // Well beyond breaking point
    { duration: '5m', target: 50 }, // Well beyond breaking point
    { duration: '10m', target: 0 }, // Recovery phase
  ],

  // Thresholds - more lenient than load test
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% under 2s
    http_req_failed: ['rate<0.10'], // Less than 10% failures
    success_rate: ['rate>0.80'], // Over 80% success (stress allows more failures)
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;

// Single test user for stress testing
const TEST_USER = {
  email: 'stresstest@example.com',
  password: 'Test123!',
};

export default function () {
  let accessToken = null;

  // Quick login
  const loginRes = http.post(`${API_URL}/auth/login`, JSON.stringify(TEST_USER), {
    headers: { 'Content-Type': 'application/json' },
  });

  const loginSuccess = check(loginRes, {
    'login successful': (r) => r.status === 200,
  });

  if (loginSuccess) {
    try {
      const body = JSON.parse(loginRes.body);
      accessToken = body.data?.tokens?.accessToken;
    } catch (e) {
      apiErrors.add(1);
    }
  }

  successRate.add(loginSuccess);
  responseTime.add(loginRes.timings.duration);

  // Track potential breaking point
  if (loginRes.timings.duration > 5000) {
    breakingPointHit.add(1);
  }

  if (!accessToken) {
    sleep(0.5);
    return;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  // Rapid API calls to stress the system
  const endpoints = [
    `${API_URL}/users/me`,
    `${API_URL}/pdfs`,
    `${API_URL}/quiz-sessions`,
    `${API_URL}/analytics/trends?period=7d`,
    `${API_URL}/analytics/weak-areas`,
    `${API_URL}/analytics/streaks`,
  ];

  for (const endpoint of endpoints) {
    const res = http.get(endpoint, { headers: authHeaders });

    const success = check(res, {
      'response OK': (r) => r.status < 500,
    });

    successRate.add(success);
    responseTime.add(res.timings.duration);

    if (!success) {
      apiErrors.add(1);
    }

    if (res.timings.duration > 5000) {
      breakingPointHit.add(1);
    }

    // Minimal sleep during stress test
    sleep(0.1);
  }

  // Quick logout
  http.post(`${API_URL}/auth/logout`, '{}', { headers: authHeaders });

  sleep(0.5);
}

export function handleSummary(data) {
  console.log('\n=== STRESS TEST SUMMARY ===\n');

  const metrics = data.metrics;

  console.log('Response Time:');
  console.log(`  Average: ${Math.round(metrics.http_req_duration.values.avg)}ms`);
  console.log(`  p95: ${Math.round(metrics.http_req_duration.values['p(95)'])}ms`);
  console.log(`  Max: ${Math.round(metrics.http_req_duration.values.max)}ms`);

  console.log('\nError Rate:');
  console.log(`  Failed Requests: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  console.log(`  API Errors: ${metrics.api_errors?.values.count || 0}`);

  console.log('\nBreaking Point Indicators:');
  console.log(`  Slow Responses (>5s): ${metrics.breaking_point_hit?.values.count || 0}`);

  if (metrics.http_req_failed.values.rate > 0.05) {
    console.log('\n⚠️  Breaking point likely reached - error rate exceeded 5%');
  }

  if (metrics.http_req_duration.values['p(95)'] > 2000) {
    console.log('\n⚠️  Performance degraded - p95 exceeded 2s');
  }

  return {
    'summary.json': JSON.stringify(data, null, 2),
  };
}
