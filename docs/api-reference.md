# PDF Quiz Generator - API Reference

## Overview

The PDF Quiz Generator API is a RESTful API that allows you to manage PDFs, generate quizzes, track progress, and access analytics.

**Base URL**: `https://api.pdfquizgen.com/v1` (Production)  
**Local URL**: `http://localhost:3000/api/v1` (Development)

## Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### Obtaining Tokens

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "johndoe"
    },
    "tokens": {
      "accessToken": "eyJhbG...",
      "refreshToken": "eyJhbG...",
      "expiresIn": 900
    }
  }
}
```

### Using Tokens

Include the access token in the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

### Refreshing Tokens

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbG..."
}
```

---

## API Endpoints

### Authentication

#### Register User
```http
POST /auth/register
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Valid email address |
| password | string | Yes | Min 8 chars, uppercase, lowercase, number |
| username | string | Yes | 3-30 characters |

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "username": "johndoe",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  }
}
```

#### Login
```http
POST /auth/login
```

**Request Body:**
| Field | Type | Required |
|-------|------|----------|
| email | string | Yes |
| password | string | Yes |

#### Logout
```http
POST /auth/logout
Authorization: Bearer {token}
```

#### Logout All Sessions
```http
POST /auth/logout-all
Authorization: Bearer {token}
```

#### Change Password
```http
POST /auth/change-password
Authorization: Bearer {token}
```

**Request Body:**
| Field | Type | Required |
|-------|------|----------|
| currentPassword | string | Yes |
| newPassword | string | Yes |

---

### Users

#### Get Current User
```http
GET /users/me
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "johndoe",
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T12:00:00Z"
    }
  }
}
```

#### Update Profile
```http
PATCH /users/me
Authorization: Bearer {token}
```

**Request Body:**
| Field | Type | Required |
|-------|------|----------|
| username | string | No |
| email | string | No |

#### Delete Account
```http
DELETE /users/me
Authorization: Bearer {token}
```

**Request Body:**
| Field | Type | Required |
|-------|------|----------|
| password | string | Yes |

---

### PDFs

#### Upload PDF
```http
POST /pdfs
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | file | Yes | PDF file (max 50MB) |
| title | string | No | Custom title |

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "pdf": {
      "id": "uuid",
      "title": "Document Title",
      "filename": "document.pdf",
      "pageCount": 25,
      "fileSize": 1048576,
      "status": "processing",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  }
}
```

#### List PDFs
```http
GET /pdfs
Authorization: Bearer {token}
```

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Items per page (max 50) |
| status | string | all | Filter by status |
| sortBy | string | createdAt | Sort field |
| order | string | desc | Sort order (asc/desc) |

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "pdfs": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

#### Get PDF Details
```http
GET /pdfs/{id}
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "pdf": {
      "id": "uuid",
      "title": "Document Title",
      "filename": "document.pdf",
      "pageCount": 25,
      "fileSize": 1048576,
      "status": "ready",
      "questionCount": 50,
      "createdAt": "2025-01-15T10:30:00Z"
    }
  }
}
```

#### Delete PDF
```http
DELETE /pdfs/{id}
Authorization: Bearer {token}
```

**Response:** `204 No Content`

#### Regenerate Questions
```http
POST /pdfs/{id}/regenerate
Authorization: Bearer {token}
```

**Request Body:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| count | number | 50 | Number of questions |
| difficulty | string | mixed | easy/medium/hard/mixed |

---

### Quiz Sessions

#### Create Quiz Session
```http
POST /quiz-sessions
Authorization: Bearer {token}
```

**Request Body:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| pdfId | string | Yes | - |
| questionCount | number | No | 10 |
| difficulty | string | No | medium |
| timeLimit | number | No | null |

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "pdfId": "uuid",
      "status": "in_progress",
      "questionCount": 10,
      "difficulty": "medium",
      "timeLimit": 600,
      "startedAt": "2025-01-15T10:30:00Z"
    },
    "questions": [
      {
        "id": "uuid",
        "questionNumber": 1,
        "text": "What is the main topic of chapter 1?",
        "options": {
          "A": "Introduction to AI",
          "B": "Machine Learning Basics",
          "C": "Neural Networks",
          "D": "Deep Learning"
        },
        "difficulty": "medium"
      }
    ]
  }
}
```

#### Get Quiz Session
```http
GET /quiz-sessions/{id}
Authorization: Bearer {token}
```

#### List Quiz Sessions
```http
GET /quiz-sessions
Authorization: Bearer {token}
```

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Items per page |
| status | string | all | Filter by status |
| pdfId | string | - | Filter by PDF |

#### Submit Answer
```http
POST /quiz-sessions/{id}/answer
Authorization: Bearer {token}
```

**Request Body:**
| Field | Type | Required |
|-------|------|----------|
| questionId | string | Yes |
| selectedOption | string | Yes |
| timeSpentSeconds | number | No |

#### Submit All Answers
```http
POST /quiz-sessions/{id}/submit
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "answers": [
    {
      "questionId": "uuid",
      "selectedOption": "A",
      "timeSpentSeconds": 30
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "status": "completed",
      "score": 8,
      "totalQuestions": 10,
      "percentage": 80,
      "completedAt": "2025-01-15T10:45:00Z",
      "timeTaken": 900
    },
    "results": [
      {
        "questionId": "uuid",
        "questionText": "...",
        "selectedOption": "A",
        "correctOption": "A",
        "isCorrect": true,
        "explanation": "..."
      }
    ]
  }
}
```

#### Abandon Quiz Session
```http
POST /quiz-sessions/{id}/abandon
Authorization: Bearer {token}
```

---

### Analytics

#### Get Performance Trends
```http
GET /analytics/trends
Authorization: Bearer {token}
```

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| period | string | 30d | 7d, 30d, 90d, 1y |
| groupBy | string | day | day, week, month |

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "date": "2025-01-15",
        "quizCount": 3,
        "averageScore": 85.5,
        "totalQuestions": 30
      }
    ],
    "summary": {
      "totalQuizzes": 45,
      "averageScore": 78.2,
      "improvement": 5.3
    }
  }
}
```

#### Get Weak Areas
```http
GET /analytics/weak-areas
Authorization: Bearer {token}
```

**Query Parameters:**
| Param | Type | Default |
|-------|------|---------|
| limit | number | 5 |

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "weakAreas": [
      {
        "topic": "Machine Learning",
        "incorrectPercentage": 35,
        "totalQuestions": 20,
        "recentTrend": "improving"
      }
    ]
  }
}
```

#### Get Study Patterns
```http
GET /analytics/patterns
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "patterns": {
      "bestTimeOfDay": "morning",
      "bestDayOfWeek": "Saturday",
      "optimalSessionLength": 25,
      "averageSessionLength": 18,
      "performanceByTime": {
        "morning": 82.5,
        "afternoon": 75.0,
        "evening": 78.3
      }
    }
  }
}
```

#### Get Streaks
```http
GET /analytics/streaks
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "streaks": {
      "current": 7,
      "longest": 21,
      "thisMonth": 15,
      "lastActivityDate": "2025-01-15"
    }
  }
}
```

---

### Health & Status

#### Health Check
```http
GET /health
```

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "nlp": "healthy"
  }
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid request data |
| UNAUTHORIZED | 401 | Missing or invalid authentication |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limiting

API requests are rate limited per user:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| General API | 100 requests | 1 minute |
| PDF Upload | 10 requests | 1 hour |
| Quiz Submission | 30 requests | 1 hour |

When rate limited, responses include:
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705311600
```

---

## Webhooks (Coming Soon)

Configure webhooks for real-time notifications:

- `pdf.processed` - PDF processing complete
- `quiz.completed` - Quiz session finished
- `streak.achieved` - New streak milestone

---

## SDKs & Libraries

- JavaScript/TypeScript: `@pdfquizgen/client`
- Python: `pdfquizgen-python`
- Go: `github.com/pdfquizgen/go-client`

---

## Changelog

### v1.0.0 (January 2025)
- Initial API release
- Core authentication endpoints
- PDF management
- Quiz sessions
- Analytics endpoints

---

*For support, contact api-support@pdfquizgen.com*
