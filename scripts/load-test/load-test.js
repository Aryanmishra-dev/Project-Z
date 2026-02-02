/**
 * K6 Load Testing Script for PDF Quiz Generator
 *
 * Run with: k6 run scripts/load-test/load-test.js
 *
 * Prerequisites:
 * 1. Install k6: brew install k6
 * 2. Start the application: pnpm dev
 * 3. Ensure test user exists: test@example.com / Test123!
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const loginFailures = new Counter('login_failures');
const apiErrors = new Counter('api_errors');
const quizCompletions = new Counter('quiz_completions');
const successRate = new Rate('success_rate');
const apiLatency = new Trend('api_latency');

// Test configuration
export const options = {
  // Ramp-up pattern for load testing
  stages: [
    { duration: '30s', target: 2 }, // Warm up: ramp to 2 users
    { duration: '1m', target: 5 }, // Ramp up to 5 users
    { duration: '2m', target: 5 }, // Stay at 5 users
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 10 }, // Stay at 10 users
    { duration: '1m', target: 15 }, // Push to 15 users
    { duration: '2m', target: 15 }, // Stay at 15 users
    { duration: '1m', target: 0 }, // Ramp down
  ],

  // Performance thresholds
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
    http_req_failed: ['rate<0.01'], // Less than 1% failures
    success_rate: ['rate>0.95'], // Over 95% success
    api_latency: ['p(95)<400'], // API calls under 400ms
    login_failures: ['count<5'], // Less than 5 login failures
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1`;

// Test users (pre-created in database)
const TEST_USERS = [
  { email: 'loadtest1@example.com', password: 'Test123!' },
  { email: 'loadtest2@example.com', password: 'Test123!' },
  { email: 'loadtest3@example.com', password: 'Test123!' },
  { email: 'loadtest4@example.com', password: 'Test123!' },
  { email: 'loadtest5@example.com', password: 'Test123!' },
];

// Get random test user
function getTestUser() {
  return TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
}

// Setup function - runs once before tests
export function setup() {
  console.log('Starting load test against', BASE_URL);

  // Verify API is responding
  const healthCheck = http.get(`${API_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('API health check failed');
  }

  return { timestamp: new Date().toISOString() };
}

// Main test function - runs for each virtual user
export default function () {
  const user = getTestUser();
  let accessToken = null;

  // Scenario 1: Authentication Flow
  group('Authentication', () => {
    // Login
    const loginPayload = JSON.stringify({
      email: user.email,
      password: user.password,
    });

    const loginRes = http.post(`${API_URL}/auth/login`, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' },
    });

    const loginSuccess = check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'login has token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data?.tokens?.accessToken != null;
        } catch {
          return false;
        }
      },
    });

    if (loginSuccess) {
      try {
        const body = JSON.parse(loginRes.body);
        accessToken = body.data.tokens.accessToken;
      } catch (e) {
        loginFailures.add(1);
      }
    } else {
      loginFailures.add(1);
    }

    successRate.add(loginSuccess);
    apiLatency.add(loginRes.timings.duration);
    sleep(1);
  });

  // Skip remaining tests if login failed
  if (!accessToken) {
    console.log('Login failed, skipping remaining tests');
    return;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  // Scenario 2: Dashboard Load
  group('Dashboard', () => {
    // Fetch user profile
    const profileRes = http.get(`${API_URL}/users/me`, {
      headers: authHeaders,
      tags: { name: 'get_profile' },
    });

    check(profileRes, {
      'profile status is 200': (r) => r.status === 200,
    });
    apiLatency.add(profileRes.timings.duration);

    // Fetch PDFs list
    const pdfsRes = http.get(`${API_URL}/pdfs`, {
      headers: authHeaders,
      tags: { name: 'get_pdfs' },
    });

    const pdfsSuccess = check(pdfsRes, {
      'pdfs status is 200': (r) => r.status === 200,
      'pdfs response time OK': (r) => r.timings.duration < 500,
    });

    successRate.add(pdfsSuccess);
    apiLatency.add(pdfsRes.timings.duration);

    // Fetch quiz sessions
    const sessionsRes = http.get(`${API_URL}/quiz-sessions`, {
      headers: authHeaders,
      tags: { name: 'get_sessions' },
    });

    check(sessionsRes, {
      'sessions status is 200': (r) => r.status === 200,
    });
    apiLatency.add(sessionsRes.timings.duration);

    sleep(2);
  });

  // Scenario 3: Analytics Load
  group('Analytics', () => {
    // Fetch trends
    const trendsRes = http.get(`${API_URL}/analytics/trends?period=30d`, {
      headers: authHeaders,
      tags: { name: 'get_trends' },
    });

    check(trendsRes, {
      'trends status is 200': (r) => r.status === 200,
    });
    apiLatency.add(trendsRes.timings.duration);

    // Fetch weak areas
    const weakAreasRes = http.get(`${API_URL}/analytics/weak-areas`, {
      headers: authHeaders,
      tags: { name: 'get_weak_areas' },
    });

    check(weakAreasRes, {
      'weak areas status is 200': (r) => r.status === 200,
    });
    apiLatency.add(weakAreasRes.timings.duration);

    // Fetch streaks
    const streaksRes = http.get(`${API_URL}/analytics/streaks`, {
      headers: authHeaders,
      tags: { name: 'get_streaks' },
    });

    check(streaksRes, {
      'streaks status is 200': (r) => r.status === 200,
    });
    apiLatency.add(streaksRes.timings.duration);

    // Fetch patterns
    const patternsRes = http.get(`${API_URL}/analytics/patterns`, {
      headers: authHeaders,
      tags: { name: 'get_patterns' },
    });

    check(patternsRes, {
      'patterns status is 200': (r) => r.status === 200,
    });
    apiLatency.add(patternsRes.timings.duration);

    sleep(1);
  });

  // Scenario 4: Quiz Flow (if PDF exists)
  group('Quiz Flow', () => {
    // Get a PDF for quiz
    const pdfsRes = http.get(`${API_URL}/pdfs?limit=1`, {
      headers: authHeaders,
      tags: { name: 'get_pdf_for_quiz' },
    });

    let pdfId = null;
    try {
      const pdfsBody = JSON.parse(pdfsRes.body);
      if (pdfsBody.data?.pdfs?.length > 0) {
        pdfId = pdfsBody.data.pdfs[0].id;
      }
    } catch (e) {
      // No PDFs available
    }

    if (pdfId) {
      // Create quiz session
      const createSessionPayload = JSON.stringify({
        pdfId: pdfId,
        questionCount: 5,
        difficulty: 'medium',
      });

      const createSessionRes = http.post(`${API_URL}/quiz-sessions`, createSessionPayload, {
        headers: authHeaders,
        tags: { name: 'create_session' },
      });

      let sessionId = null;
      let questions = [];

      const sessionCreated = check(createSessionRes, {
        'session created': (r) => r.status === 201 || r.status === 200,
      });

      if (sessionCreated) {
        try {
          const sessionBody = JSON.parse(createSessionRes.body);
          sessionId = sessionBody.data?.session?.id;
          questions = sessionBody.data?.questions || [];
        } catch (e) {
          apiErrors.add(1);
        }
      }
      apiLatency.add(createSessionRes.timings.duration);

      // Submit answers
      if (sessionId && questions.length > 0) {
        const answers = questions.map((q) => ({
          questionId: q.id,
          selectedOption: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
          timeSpentSeconds: Math.floor(Math.random() * 30) + 10,
        }));

        const submitPayload = JSON.stringify({ answers });

        const submitRes = http.post(`${API_URL}/quiz-sessions/${sessionId}/submit`, submitPayload, {
          headers: authHeaders,
          tags: { name: 'submit_quiz' },
        });

        const quizSubmitted = check(submitRes, {
          'quiz submitted': (r) => r.status === 200,
          'quiz response time OK': (r) => r.timings.duration < 1000,
        });

        if (quizSubmitted) {
          quizCompletions.add(1);
        } else {
          apiErrors.add(1);
        }

        successRate.add(quizSubmitted);
        apiLatency.add(submitRes.timings.duration);
      }
    }

    sleep(2);
  });

  // Scenario 5: Settings Access
  group('Settings', () => {
    const profileRes = http.get(`${API_URL}/settings/profile`, {
      headers: authHeaders,
      tags: { name: 'get_settings_profile' },
    });

    check(profileRes, {
      'settings profile status OK': (r) => r.status === 200 || r.status === 404,
    });
    apiLatency.add(profileRes.timings.duration);

    const sessionsRes = http.get(`${API_URL}/settings/sessions`, {
      headers: authHeaders,
      tags: { name: 'get_settings_sessions' },
    });

    check(sessionsRes, {
      'settings sessions status OK': (r) => r.status === 200 || r.status === 404,
    });
    apiLatency.add(sessionsRes.timings.duration);

    sleep(1);
  });

  // Scenario 6: Logout
  group('Logout', () => {
    const logoutRes = http.post(`${API_URL}/auth/logout`, JSON.stringify({}), {
      headers: authHeaders,
      tags: { name: 'logout' },
    });

    check(logoutRes, {
      'logout successful': (r) => r.status === 200 || r.status === 204,
    });
    apiLatency.add(logoutRes.timings.duration);
  });

  // Wait before next iteration
  sleep(Math.random() * 3 + 1);
}

// Teardown function - runs once after all tests
export function teardown(data) {
  console.log('Load test completed at', new Date().toISOString());
  console.log('Test started at', data.timestamp);
}

/**
 * Results Summary (Expected):
 *
 * ✓ http_req_duration.............: avg=150ms   min=50ms   med=120ms  max=800ms  p(90)=300ms  p(95)=450ms
 * ✓ http_req_failed...............: 0.50%  ✓ (threshold: <1%)
 * ✓ success_rate..................: 95.50% ✓ (threshold: >95%)
 * ✓ api_latency...................: avg=130ms  p(95)=350ms ✓ (threshold: <400ms)
 * ✓ quiz_completions..............: 150
 * ✓ login_failures................: 2      ✓ (threshold: <5)
 *
 * Running 10 concurrent users for 10 minutes should result in:
 * - ~600 total iterations
 * - ~2400 HTTP requests
 * - <1% error rate
 * - p95 response time under 500ms
 */
