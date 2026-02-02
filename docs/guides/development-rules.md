# Project-0 MCP Development Rules

## Code Quality Standards

### TypeScript/JavaScript

- Always use TypeScript strict mode
- Prefer functional programming patterns
- Use async/await over promises
- Never use `any` type (use `unknown` if necessary)
- All functions must have JSDoc comments
- Use named exports over default exports

### Python

- Follow PEP 8 style guide
- Use type hints for all function signatures
- Docstrings required for all public functions
- Use f-strings for string formatting
- Prefer dataclasses over dictionaries

## Architecture Principles

### Backend

- All API routes must have input validation (Zod)
- All database queries must use Drizzle ORM (no raw SQL)
- All mutations must be wrapped in transactions
- Error handling: never expose internal errors to clients
- Logging: use Winston with structured JSON logs

### Frontend

- Components must be functional (no class components)
- Use React Query for server state
- Use Zustand for client state
- All API calls must include error handling
- Accessibility: all interactive elements must be keyboard accessible

### NLP Service

- All LLM calls must have timeout (30s max)
- All generated questions must pass validation
- Quality score must be >= 0.4 to persist
- Cache generated questions (Redis, 30-day TTL)
- Retry failed generations max 3 times

## Security Requirements

### Authentication

- Never log passwords or tokens
- Always hash passwords with Argon2id
- JWT access tokens: 15 minutes expiry
- Refresh tokens: 7 days expiry, stored HttpOnly
- Rate limit: authentication endpoints to 5 req/15min

### Input Validation

- Validate ALL user inputs (client + server)
- Sanitize HTML content (use DOMPurify)
- File uploads: check MIME type AND magic bytes
- SQL injection: only use parameterized queries
- Path traversal: sanitize all file paths

### Data Protection

- Never commit secrets (.env to .gitignore)
- Use environment variables for all secrets
- HTTPS only in production
- CORS: whitelist specific origins
- CSP headers: restrict script sources

## Testing Requirements

### Coverage

- Minimum 80% overall coverage
- Business logic: 90%+ coverage
- All API endpoints must have integration tests
- Critical flows must have E2E tests

### Test Structure

- Unit tests: `*.test.ts` files co-located with code
- Integration tests: `__tests__/integration/`
- E2E tests: `e2e/`
- Fixtures: `__tests__/fixtures/`

### Test Quality

- Tests must be deterministic (no random data)
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Clean up after tests (database, files, etc.)

## Git Workflow

### Commits

- Use conventional commits format
- Commit messages: imperative mood, lowercase
- One logical change per commit
- Reference issue numbers where applicable

### Branches

- `main`: production-ready code
- `develop`: integration branch
- `feature/*`: new features
- `fix/*`: bug fixes
- `refactor/*`: code improvements

### Pull Requests

- All PRs require passing CI
- Code review required before merge
- Squash commits when merging to main
- Delete branch after merge

## Documentation

### Code Comments

- Comment WHY, not WHAT
- Update comments when code changes
- Document complex algorithms
- Flag TODOs with issue references

### API Documentation

- All endpoints documented in OpenAPI/Swagger
- Include request/response examples
- Document all error codes
- Update docs before deploying changes

## Performance

### Database

- Index all foreign keys
- Composite indexes for common queries
- Pagination: max 100 items per page
- Connection pooling: min 5, max 20

### Frontend

- Code splitting for routes
- Lazy load heavy components
- Optimize images (WebP, lazy loading)
- Bundle size: <500KB initial load

### Backend

- Response time: p95 < 500ms
- Use caching for expensive operations
- Async processing for long-running tasks
- Rate limiting on all public endpoints

## Error Handling

### Client Errors (4xx)

- Return user-friendly messages
- Include error codes for programmatic handling
- Validate input and return specific field errors
- Never expose internal logic

### Server Errors (5xx)

- Log full error with stack trace
- Return generic message to client
- Alert on critical errors
- Include request ID for tracking

## Deployment

### Pre-Deployment

- All tests passing
- Code reviewed and approved
- Database migrations tested
- Environment variables configured
- Backup created

### Post-Deployment

- Smoke tests executed
- Monitor logs for 30 minutes
- Check error rates
- Verify database migrations
- Document deployment in changelog

## Monitoring

### Metrics

- Track API response times
- Monitor error rates
- Track queue job success/failure
- Monitor database connection pool
- Track LLM generation success rate

### Alerting

- Alert on error rate > 5%
- Alert on p95 response time > 1s
- Alert on disk usage > 80%
- Alert on failed background jobs
- Alert on security events

## Code Review Checklist

- [ ] Code follows style guide
- [ ] All tests passing
- [ ] No hardcoded secrets
- [ ] Error handling implemented
- [ ] Input validation present
- [ ] Documentation updated
- [ ] Performance considered
- [ ] Security reviewed
- [ ] Backwards compatible (if applicable)
- [ ] Logging added for debugging

## Prohibited Practices

### Never Do This

- ❌ Commit secrets or API keys
- ❌ Use `eval()` or `exec()`
- ❌ Disable security features
- ❌ Ignore linter warnings
- ❌ Skip tests to "move faster"
- ❌ Use `console.log` in production code
- ❌ Catch errors without handling them
- ❌ Use `any` type in TypeScript
- ❌ Modify node_modules directly
- ❌ Push directly to main branch

## Best Practices

### Always Do This

- ✅ Write tests before fixing bugs
- ✅ Review your own PR before requesting review
- ✅ Keep functions small (<50 lines)
- ✅ Use meaningful variable names
- ✅ Handle edge cases
- ✅ Clean up unused code
- ✅ Update documentation
- ✅ Log important events
- ✅ Use version control properly
- ✅ Ask for help when stuck

## LLM-Specific Rules

### Question Generation

- Always validate generated questions
- Never store questions with score < 0.4
- Cache successful generations
- Implement retry logic (max 3 attempts)
- Log generation failures for analysis

### Prompt Engineering

- Version control prompts
- Include few-shot examples
- Specify output format explicitly
- Test prompts with edge cases
- A/B test prompt variations

### Quality Assurance

- Manual review first 100 questions
- Track quality metrics over time
- Flag questions with user reports
- Implement feedback loop
- Regular prompt optimization

## Mistral Question Generation

### Ollama Configuration

- **Model**: `mistral:7b-instruct-q4_K_M` (recommended) or `mistral:latest`
- **Endpoint**: `http://localhost:11434/api/generate`
- **Timeout**: 60 seconds per request
- **Concurrency**: Max 2 parallel requests (local GPU constraint)

### API Integration

```python
# NLP Service - Ollama request format
{
    "model": "mistral",
    "prompt": "<s>[INST] Generate a quiz question... [/INST]",
    "stream": false,
    "options": {
        "temperature": 0.7,
        "top_p": 0.9,
        "num_predict": 512
    }
}
```

### Question Generation Prompt Template

```
[INST] You are an expert quiz question generator. Based on the following text, generate a multiple-choice question.

TEXT:
{extracted_pdf_text}

REQUIREMENTS:
1. Create ONE clear, unambiguous question
2. Provide exactly 4 options (A, B, C, D)
3. Only ONE option should be correct
4. Include a brief explanation for the correct answer
5. Assign difficulty: easy, medium, or hard

OUTPUT FORMAT (JSON):
{
  "question": "...",
  "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
  "correct_answer": "A",
  "explanation": "...",
  "difficulty": "medium"
}
[/INST]
```

### Response Validation Rules

- **JSON Parsing**: Must be valid JSON (use try-catch)
- **Required Fields**: question, options, correct_answer, difficulty
- **Options Count**: Exactly 4 options (A, B, C, D)
- **Correct Answer**: Must be one of A, B, C, D
- **Difficulty**: Must be "easy", "medium", or "hard"
- **Min Length**: Question must be ≥ 20 characters
- **Max Length**: Question must be ≤ 500 characters

### Quality Scoring Algorithm

```python
def calculate_quality_score(question: dict) -> float:
    score = 0.0

    # Clarity (0.3) - question is clear and specific
    if len(question["question"]) >= 30 and "?" in question["question"]:
        score += 0.3

    # Option Quality (0.3) - distinct, similar length options
    options = list(question["options"].values())
    if len(set(options)) == 4:  # All unique
        score += 0.15
    if all(10 <= len(opt) <= 200 for opt in options):
        score += 0.15

    # Explanation (0.2) - has meaningful explanation
    if question.get("explanation") and len(question["explanation"]) >= 20:
        score += 0.2

    # Difficulty appropriateness (0.2)
    if question.get("difficulty") in ["easy", "medium", "hard"]:
        score += 0.2

    return round(score, 2)
```

### Error Handling

| Error Type               | Action              | Retry    |
| ------------------------ | ------------------- | -------- |
| Ollama connection failed | Log, return 503     | Yes (3x) |
| Invalid JSON response    | Log, regenerate     | Yes (2x) |
| Quality score < 0.4      | Discard, regenerate | Yes (1x) |
| Timeout (>60s)           | Cancel, log         | Yes (1x) |
| Empty response           | Log error           | Yes (2x) |

### Caching Strategy

- **Cache Key**: `quiz:pdf:{pdf_id}:page:{page_num}:hash:{content_hash}`
- **TTL**: 30 days
- **Storage**: Redis
- **Invalidation**: On PDF re-upload or manual trigger

### Rate Limiting

- **Per User**: 10 questions/minute
- **Per PDF**: 50 questions/hour
- **Global**: 100 questions/minute (system-wide)

### Monitoring Metrics

- `quiz.generation.success_rate` - Target: >95%
- `quiz.generation.latency_p95` - Target: <10s
- `quiz.generation.quality_avg` - Target: >0.7
- `quiz.ollama.connection_errors` - Alert if >5/hour

## Emergency Procedures

### Production Bug

1. Create hotfix branch from main
2. Fix bug with minimal changes
3. Add regression test
4. Fast-track code review
5. Deploy immediately
6. Monitor for 1 hour
7. Document incident

### Security Incident

1. Immediately disable affected feature
2. Notify team/stakeholders
3. Investigate and document
4. Patch vulnerability
5. Force password reset if needed
6. Post-mortem analysis
7. Update security practices

### Data Loss

1. Stop all writes immediately
2. Restore from latest backup
3. Verify data integrity
4. Document what was lost
5. Communicate to affected users
6. Review backup procedures
7. Implement additional safeguards
