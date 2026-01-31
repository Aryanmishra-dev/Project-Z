# PDF Quiz Generator

> Transform your study materials into interactive, AI-powered quizzes

[![CI Pipeline](https://github.com/yourusername/Project-0/workflows/CI%20Pipeline/badge.svg)](https://github.com/yourusername/Project-0/actions)
[![Coverage](https://codecov.io/gh/yourusername/Project-0/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/Project-0)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 📄 **PDF Upload & Processing** - Extract text and generate questions automatically
- 🤖 **AI-Powered** - Uses Mistral 7B LLM running locally via Ollama
- 🎯 **Difficulty Levels** - Questions categorized as easy, medium, or hard
- ✅ **Quality Validation** - Only high-quality questions persist (score ≥ 0.6)
- 📊 **Analytics Dashboard** - Track your learning progress
- 🔒 **Privacy-First** - All data stays on your machine
- 🚀 **Modern Stack** - React, Node.js, FastAPI, PostgreSQL

## 🏗️ Architecture

```
Frontend (React + Vite) → API (Express.js) → Database (PostgreSQL)
                              ↓
                    NLP Service (FastAPI)
                              ↓
                      Ollama (Mistral 7B)
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker Desktop
- Ollama
- pnpm 8+

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/Project-0.git
cd Project-0

# Run setup script
chmod +x scripts/setup/init.sh
./scripts/setup/init.sh

# Update environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development servers
pnpm dev
```

### Access

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Docs**: http://localhost:3000/api/docs
- **NLP Service**: http://localhost:8000

## 📚 Documentation

- [User Guide](docs/guides/user-guide.md)
- [API Reference](docs/api/api-reference.md)
- [Architecture](docs/architecture/system-design.md)
- [Developer Guide](docs/guides/developer-guide.md)
- [Deployment](docs/guides/deployment.md)

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Coverage report
pnpm test:coverage
```

## 📦 Project Structure

```
Project-0/
├── packages/
│   ├── frontend/        # React application
│   ├── backend/         # Node.js API
│   ├── nlp-service/     # Python FastAPI service
│   └── shared/          # Shared types & utilities
├── docs/                # Documentation
├── scripts/             # Setup & deployment scripts
├── e2e/                 # End-to-end tests
└── docker/              # Docker configurations
```

## 🛠️ Development

### Available Scripts

```bash
pnpm dev              # Start all services
pnpm build            # Build for production
pnpm lint             # Run linters
pnpm format           # Format code
pnpm type-check       # TypeScript type checking
pnpm db:migrate       # Run database migrations
pnpm docker:up        # Start Docker services
```

### Git Workflow

- Use conventional commits: `feat:`, `fix:`, `docs:`, etc.
- Create feature branches from `develop`
- All PRs require passing CI and code review
- Squash commits when merging

## 🔐 Security

- Passwords hashed with Argon2id
- JWT with refresh token rotation
- Input validation on all endpoints
- Rate limiting enabled
- CORS configured
- File upload restrictions (PDF only, 10MB max)

## 📊 Performance

- API response time: p95 < 500ms
- PDF processing: < 3 minutes (50 pages)
- Test coverage: 80%+
- Zero critical vulnerabilities

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 👥 Authors

- Your Name - [@yourusername](https://github.com/yourusername)

## 🙏 Acknowledgments

- Mistral AI for the LLM model
- Ollama for local LLM hosting
- Anthropic for Claude Code

---

**Built with ❤️ using modern web technologies**

# Project-0

Monorepo starter containing frontend, backend, NLP service, and shared packages.

Structure:

- packages/
- docs/
- scripts/

Use this repository as a starting point for the project.
