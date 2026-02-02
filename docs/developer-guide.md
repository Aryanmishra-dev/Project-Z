# PDF Quiz Generator - Developer Guide

This guide covers the development setup, architecture, coding standards, and contribution guidelines for the PDF Quiz Generator project.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Architecture](#project-architecture)
3. [Tech Stack](#tech-stack)
4. [Coding Standards](#coding-standards)
5. [Testing](#testing)
6. [Working with the API](#working-with-the-api)
7. [Database](#database)
8. [Caching](#caching)
9. [NLP Service](#nlp-service)
10. [Deployment](#deployment)
11. [Contributing](#contributing)

---

## Development Setup

### Prerequisites

- **Node.js**: v20.x or later
- **pnpm**: v8.x or later
- **Python**: 3.11 or later
- **Docker**: For PostgreSQL and Redis
- **Git**: Version control

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/pdf-quiz-generator.git
cd pdf-quiz-generator

# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Start infrastructure (PostgreSQL, Redis)
docker-compose up -d

# Run database migrations
pnpm --filter @project-z/backend db:migrate

# Seed database (optional)
pnpm --filter @project-z/backend db:seed

# Start development servers
pnpm dev
```

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pdfquiz
REDIS_URL=redis://localhost:6379

# Authentication
JWT_ACCESS_SECRET=your-access-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# NLP Service
NLP_SERVICE_URL=http://localhost:8000
OPENAI_API_KEY=your-openai-api-key

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

# App
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
```

### Running Services Individually

```bash
# Backend only
pnpm --filter @project-z/backend dev

# Frontend only
pnpm --filter @project-z/frontend dev

# NLP Service only
cd packages/nlp-service
python -m uvicorn main:app --reload
```

---

## Project Architecture

### Monorepo Structure

```
pdf-quiz-generator/
├── packages/
│   ├── backend/          # Express.js API server
│   ├── frontend/         # React SPA
│   ├── nlp-service/      # Python FastAPI NLP service
│   └── shared/           # Shared types and utilities
├── docker/               # Docker configurations
├── docs/                 # Documentation
├── scripts/              # Build and deployment scripts
└── tests/                # E2E tests
```

### Backend Architecture

```
packages/backend/
├── src/
│   ├── config/           # Configuration management
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Express middleware
│   ├── routes/           # API route definitions
│   ├── services/         # Business logic
│   ├── repositories/     # Data access layer
│   ├── db/
│   │   ├── schema/       # Drizzle schema definitions
│   │   └── migrations/   # Database migrations
│   ├── utils/            # Utility functions
│   └── types/            # TypeScript type definitions
├── tests/
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
└── index.ts              # Application entry point
```

### Frontend Architecture

```
packages/frontend/
├── src/
│   ├── components/
│   │   ├── ui/           # Reusable UI components
│   │   ├── common/       # Shared components
│   │   └── features/     # Feature-specific components
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Page components
│   ├── services/         # API client services
│   ├── stores/           # Zustand state stores
│   ├── types/            # TypeScript types
│   └── utils/            # Utility functions
└── tests/                # Component tests
```

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  PostgreSQL │
│    (React)  │◀────│  (Express)  │◀────│             │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌─────────┐   ┌─────────────┐
              │  Redis  │   │ NLP Service │
              │ (Cache) │   │  (FastAPI)  │
              └─────────┘   └─────────────┘
```

---

## Tech Stack

### Backend

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Validation**: Zod
- **Authentication**: JWT (RS256)

### Frontend

- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State**: Zustand + React Query
- **Forms**: React Hook Form + Zod
- **Components**: Radix UI primitives

### NLP Service

- **Framework**: FastAPI
- **Language**: Python 3.11+
- **LLM**: OpenAI GPT-4
- **PDF Processing**: PyMuPDF

### DevOps

- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Testing**: Vitest, pytest, Playwright
- **Load Testing**: k6

---

## Coding Standards

### TypeScript Guidelines

```typescript
// Use explicit types
const getUserById = async (id: string): Promise<User | null> => {
  // ...
};

// Use interfaces for objects
interface CreateUserDto {
  email: string;
  username: string;
  password: string;
}

// Use type for unions/intersections
type UserRole = 'admin' | 'user' | 'guest';

// Use enums sparingly, prefer const objects
const QuizStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

type QuizStatusType = (typeof QuizStatus)[keyof typeof QuizStatus];
```

### React Guidelines

```tsx
// Use functional components with explicit return types
const UserCard: React.FC<UserCardProps> = ({ user, onEdit }) => {
  return (
    <div className="card">
      <h3>{user.name}</h3>
      <button onClick={() => onEdit(user.id)}>Edit</button>
    </div>
  );
};

// Use custom hooks for logic
const useUser = (userId: string) => {
  const query = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userService.getById(userId),
  });

  return query;
};

// Colocate related files
// components/
//   UserCard/
//     UserCard.tsx
//     UserCard.test.tsx
//     index.ts
```

### Python Guidelines

```python
# Use type hints
from typing import Optional, List
from pydantic import BaseModel

class QuestionRequest(BaseModel):
    text: str
    difficulty: str = "medium"
    count: int = 10

async def generate_questions(
    content: str,
    config: QuestionRequest
) -> List[Question]:
    """Generate quiz questions from content.

    Args:
        content: The text content to generate questions from.
        config: Question generation configuration.

    Returns:
        A list of generated Question objects.
    """
    pass
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add quiz timer functionality
fix: resolve race condition in session cleanup
docs: update API documentation for analytics
test: add unit tests for auth service
refactor: extract PDF processing into separate module
chore: update dependencies
```

### Branch Naming

```
feature/add-quiz-timer
bugfix/session-cleanup-race-condition
hotfix/critical-auth-vulnerability
docs/update-api-reference
```

---

## Testing

### Unit Tests

```bash
# Run all unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific package tests
pnpm --filter @project-z/backend test

# Watch mode
pnpm --filter @project-z/frontend test:watch
```

### Writing Tests

```typescript
// Backend service test
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should throw for invalid password', async () => {
      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrong',
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });
});
```

```tsx
// Frontend component test
import { render, screen, fireEvent } from '@testing-library/react';
import { QuizQuestion } from './QuizQuestion';

describe('QuizQuestion', () => {
  const mockQuestion = {
    id: '1',
    text: 'What is 2 + 2?',
    options: { A: '3', B: '4', C: '5', D: '6' },
  };

  it('renders question text', () => {
    render(<QuizQuestion question={mockQuestion} />);
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
  });

  it('calls onAnswer when option selected', () => {
    const onAnswer = vi.fn();
    render(<QuizQuestion question={mockQuestion} onAnswer={onAnswer} />);

    fireEvent.click(screen.getByText('4'));
    expect(onAnswer).toHaveBeenCalledWith('1', 'B');
  });
});
```

### E2E Tests

```bash
# Run Playwright tests
pnpm test:e2e

# Run with UI
pnpm test:e2e:ui

# Run specific test file
pnpm test:e2e tests/quiz-flow.spec.ts
```

### Load Tests

```bash
# Run k6 load test
k6 run scripts/load-test/load-test.js

# Run stress test
k6 run scripts/load-test/stress-test.js
```

---

## Working with the API

### Adding a New Endpoint

1. **Define the route** in `routes/`:

```typescript
// routes/feature.routes.ts
import { Router } from 'express';
import { FeatureController } from '../controllers/feature.controller';

const router = Router();
const controller = new FeatureController();

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);

export { router as featureRoutes };
```

2. **Create the controller** in `controllers/`:

```typescript
// controllers/feature.controller.ts
export class FeatureController {
  private service = new FeatureService();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.list(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
```

3. **Implement the service** in `services/`:

```typescript
// services/feature.service.ts
export class FeatureService {
  private repository = new FeatureRepository();

  async list(options: ListOptions) {
    return this.repository.findMany(options);
  }
}
```

4. **Add validation** using Zod:

```typescript
// validators/feature.validator.ts
import { z } from 'zod';

export const createFeatureSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});
```

---

## Database

### Drizzle Schema

```typescript
// db/schema/users.ts
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 30 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Migrations

```bash
# Generate migration
pnpm --filter @project-z/backend db:generate

# Run migrations
pnpm --filter @project-z/backend db:migrate

# Push schema (development)
pnpm --filter @project-z/backend db:push
```

### Queries

```typescript
// Using Drizzle query builder
const user = await db.query.users.findFirst({
  where: eq(users.email, email),
  with: {
    sessions: true,
  },
});

// Using raw SQL when needed
const result = await db.execute(sql`
  SELECT * FROM users
  WHERE email ILIKE ${`%${search}%`}
`);
```

---

## Caching

### Redis Usage

```typescript
// services/cache.service.ts
import { redis } from '../config/redis';

export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length) {
      await redis.del(...keys);
    }
  }
}
```

### Cache Keys Convention

```
user:{userId}:profile
user:{userId}:analytics:trends
pdf:{pdfId}:questions
session:{sessionId}
```

---

## NLP Service

### Question Generation

```python
# services/question_generator.py
from openai import OpenAI

class QuestionGenerator:
    def __init__(self):
        self.client = OpenAI()

    async def generate(
        self,
        content: str,
        count: int = 10,
        difficulty: str = "medium"
    ) -> list[Question]:
        prompt = self._build_prompt(content, count, difficulty)

        response = await self.client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        return self._parse_response(response)
```

### Adding New NLP Features

1. Create service in `services/`
2. Define Pydantic models in `models/`
3. Add endpoint in `routes/`
4. Write tests in `tests/`

---

## Contributing

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure all tests pass
4. Update documentation if needed
5. Submit PR with clear description
6. Address review feedback
7. Squash and merge after approval

### Code Review Checklist

- [ ] Tests cover the changes
- [ ] No security vulnerabilities
- [ ] Performance impact considered
- [ ] Documentation updated
- [ ] Breaking changes noted
- [ ] Commit messages follow convention

### Getting Help

- **Discord**: Join our developer community
- **GitHub Issues**: Report bugs or request features
- **Documentation**: Check the docs folder

---

_Happy coding! 🚀_
