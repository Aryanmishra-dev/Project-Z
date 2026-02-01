# NLP Service

FastAPI-based NLP service for PDF text extraction and AI-powered question generation.

## Features

- **PDF Text Extraction**: Extract text from PDF documents using PyMuPDF
- **Text Chunking**: Split text into semantic chunks with spaCy sentence boundaries
- **Question Generation**: Generate MCQs using Ollama LLM (Mistral 7B)
- **Quality Validation**: 4-stage validation with quality scoring
- **Redis Caching**: Cache generated questions with 30-day TTL

## Quick Start

### Prerequisites

- Python 3.11+
- Redis server
- Ollama with Mistral model

### Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download spaCy model
python -m spacy download en_core_web_sm

# Copy and configure environment
cp .env.example .env
```

### Running Ollama

```bash
# Install Ollama (macOS)
brew install ollama

# Pull the Mistral model
ollama pull mistral:7b-instruct-q4_K_M

# Start Ollama server
ollama serve
```

### Running the Service

```bash
# Development mode
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Running with Docker

```bash
# Build image
docker build -t nlp-service .

# Run container
docker run -p 8000:8000 \
  -e REDIS_HOST=host.docker.internal \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  nlp-service
```

## API Endpoints

### Health

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check with dependency status
- `GET /health/live` - Liveness check

### Questions

- `POST /api/v1/questions/generate` - Generate MCQs from text
- `GET /api/v1/questions/difficulties` - List difficulty levels

### PDF

- `POST /api/v1/pdf/extract` - Extract text from PDF
- `POST /api/v1/pdf/chunk` - Chunk text into segments

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_HOST` | `0.0.0.0` | Service host |
| `SERVICE_PORT` | `8000` | Service port |
| `DEBUG` | `false` | Debug mode |
| `LOG_LEVEL` | `INFO` | Logging level |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_MODEL` | `mistral:7b-instruct-q4_K_M` | LLM model |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `CHUNK_SIZE_WORDS` | `800` | Target chunk size |
| `CHUNK_OVERLAP_WORDS` | `200` | Chunk overlap |

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_pdf_extractor.py -v
```

## Project Structure

```
nlp-service/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration
│   ├── models/
│   │   ├── question.py      # Question models
│   │   └── pdf.py           # PDF models
│   ├── routers/
│   │   ├── health.py        # Health endpoints
│   │   ├── questions.py     # Question endpoints
│   │   └── pdf.py           # PDF endpoints
│   ├── services/
│   │   ├── pdf_extractor.py # PDF extraction
│   │   ├── text_chunker.py  # Text chunking
│   │   ├── llm_client.py    # Ollama client
│   │   ├── question_validator.py
│   │   └── question_generator.py
│   ├── prompts/
│   │   └── __init__.py      # Prompt templates
│   └── utils/
│       ├── logger.py        # Logging
│       ├── errors.py        # Custom exceptions
│       └── cache.py         # Redis cache
├── tests/
│   ├── conftest.py
│   ├── test_pdf_extractor.py
│   ├── test_text_chunker.py
│   ├── test_llm_client.py
│   ├── test_question_validator.py
│   └── test_routers.py
├── Dockerfile
├── requirements.txt
├── pyproject.toml
└── README.md
```

## License

MIT
