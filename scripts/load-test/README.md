# Load Testing Suite

This directory contains k6 load testing scripts for the PDF Quiz Generator application.

## Prerequisites

### Install k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

### Prepare Test Users

Create test users in the database before running load tests:

```sql
-- Run in PostgreSQL
INSERT INTO users (email, password_hash, username, created_at)
VALUES 
  ('loadtest1@example.com', '<hashed_password>', 'loadtest1', NOW()),
  ('loadtest2@example.com', '<hashed_password>', 'loadtest2', NOW()),
  ('loadtest3@example.com', '<hashed_password>', 'loadtest3', NOW()),
  ('loadtest4@example.com', '<hashed_password>', 'loadtest4', NOW()),
  ('loadtest5@example.com', '<hashed_password>', 'loadtest5', NOW()),
  ('stresstest@example.com', '<hashed_password>', 'stresstest', NOW());
```

Or use the API to register test users:

```bash
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/v1/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"loadtest${i}@example.com\",\"password\":\"Test123!\",\"username\":\"loadtest${i}\"}"
done
```

## Running Tests

### Load Test (Normal Operation)

Tests system under expected load with gradual ramp-up to 10-15 concurrent users.

```bash
# Default (localhost:3000)
k6 run scripts/load-test/load-test.js

# Custom base URL
k6 run -e BASE_URL=http://localhost:3000 scripts/load-test/load-test.js

# With HTML report
k6 run --out json=results.json scripts/load-test/load-test.js
```

### Stress Test (Finding Breaking Point)

Aggressively ramps up to find where the system starts to fail.

```bash
k6 run scripts/load-test/stress-test.js
```

### Spike Test (Sudden Load)

Tests system behavior when traffic suddenly spikes.

```bash
k6 run scripts/load-test/spike-test.js
```

## Test Scenarios

### Load Test Stages

| Duration | Target VUs | Description |
|----------|------------|-------------|
| 30s | 2 | Warm up |
| 1m | 5 | Ramp to 5 users |
| 2m | 5 | Sustain 5 users |
| 1m | 10 | Ramp to 10 users |
| 3m | 10 | Sustain 10 users |
| 1m | 15 | Ramp to 15 users |
| 2m | 15 | Sustain 15 users |
| 1m | 0 | Ramp down |

### Performance Thresholds

| Metric | Threshold | Description |
|--------|-----------|-------------|
| http_req_duration p(95) | < 500ms | 95th percentile response time |
| http_req_duration p(99) | < 1000ms | 99th percentile response time |
| http_req_failed | < 1% | Overall error rate |
| success_rate | > 95% | Successful operations |
| login_failures | < 5 | Authentication failures |

## Interpreting Results

### Sample Output

```
          /\      |‾‾| /‾‾/   /‾‾/   
     /\  /  \     |  |/  /   /  /    
    /  \/    \    |     (   /   ‾‾\  
   /          \   |  |\  \ |  (‾)  | 
  / __________ \  |__| \__\ \_____/ .io

  execution: local
     script: scripts/load-test/load-test.js
     output: -

  scenarios: (100.00%) 1 scenario, 15 max VUs, 11m30s max duration (incl. graceful stop):
           * default: Up to 15 looping VUs for 11m0s over 8 stages

     ✓ http_req_duration.............: avg=142ms  min=23ms  med=98ms  max=876ms  p(90)=298ms  p(95)=445ms
     ✓ http_req_failed...............: 0.42%   ✓ 18      ✗ 4256
     ✓ success_rate..................: 96.21%  ✓ 4094    ✗ 162
     ✓ api_latency...................: avg=128ms  p(95)=352ms
     ✓ quiz_completions..............: 203
     ✓ login_failures................: 3       ✓ (threshold: <5)
```

### What to Look For

1. **p95 Response Time** - Should be under 500ms for a good user experience
2. **Error Rate** - Should be under 1% for reliable operation
3. **Quiz Completions** - Validates the critical path works under load
4. **Max Response Time** - Watch for outliers that indicate bottlenecks

## Debugging Slow Requests

If tests reveal performance issues:

1. **Check Database Queries**
   ```bash
   # Enable slow query log in PostgreSQL
   ALTER SYSTEM SET log_min_duration_statement = 100;
   SELECT pg_reload_conf();
   ```

2. **Check Redis Cache Hit Rate**
   ```bash
   redis-cli INFO stats | grep keyspace
   ```

3. **Check Node.js Event Loop**
   - Add `clinic flame` profiling
   - Check for blocking operations

4. **Check Connection Pools**
   - Database connection exhaustion
   - Redis connection limits

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/load-test.yml
load-test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Start services
      run: docker-compose up -d
    - name: Wait for services
      run: sleep 30
    - name: Run load test
      uses: grafana/k6-action@v0.3.1
      with:
        filename: scripts/load-test/load-test.js
        flags: --out json=results.json
    - name: Upload results
      uses: actions/upload-artifact@v4
      with:
        name: k6-results
        path: results.json
```

## Grafana Dashboard (Optional)

For real-time visualization, run k6 with InfluxDB output:

```bash
# Start InfluxDB and Grafana
docker-compose -f docker-compose.monitoring.yml up -d

# Run k6 with InfluxDB output
k6 run --out influxdb=http://localhost:8086/k6 scripts/load-test/load-test.js
```

Then import the k6 dashboard in Grafana (Dashboard ID: 2587).
