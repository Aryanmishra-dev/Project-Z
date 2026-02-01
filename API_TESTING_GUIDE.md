# API Testing Quick Reference

## 🎯 Test All Fixed Endpoints

### Prerequisites
```bash
# Ensure backend is running
curl http://localhost:3000/api/v1/health

# Ensure frontend is running
curl http://localhost:5173
```

---

## 1. Authentication Endpoints

### Register User
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "fullName": "Test User"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "test@example.com",
      "fullName": "Test User",
      "role": "user"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### Get Profile
```bash
# Save token from login
TOKEN="eyJhbGc..."

curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "test@example.com",
      "fullName": "Test User",
      "role": "user",
      "emailVerified": false,
      "createdAt": "2026-02-01T...",
      "updatedAt": "2026-02-01T..."
    }
  }
}
```

### Refresh Token
```bash
REFRESH_TOKEN="eyJhbGc..."

curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "'$REFRESH_TOKEN'"
  }'
```

### Logout
```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "'$REFRESH_TOKEN'"
  }'
```

---

## 2. PDF Endpoints

### Upload PDF
```bash
TOKEN="eyJhbGc..."

curl -X POST http://localhost:3000/api/v1/pdfs \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample.pdf"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "pdf": {
      "id": "uuid",
      "filename": "sample.pdf",
      "userId": "uuid",
      "status": "pending",
      "fileSizeBytes": 102400,
      "pageCount": null,
      "createdAt": "2026-02-01T...",
      "updatedAt": "2026-02-01T..."
    }
  }
}
```

### List PDFs
```bash
curl -X GET "http://localhost:3000/api/v1/pdfs?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "pdfs": [
      {
        "id": "uuid",
        "filename": "sample.pdf",
        "status": "completed",
        "fileSizeBytes": 102400,
        "pageCount": 5,
        "questionCount": 25,
        "createdAt": "2026-02-01T..."
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 10,
      "offset": 0
    }
  }
}
```

### Get PDF by ID
```bash
PDF_ID="uuid"

curl -X GET http://localhost:3000/api/v1/pdfs/$PDF_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Get PDF Status
```bash
curl -X GET http://localhost:3000/api/v1/pdfs/$PDF_ID/status \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "processing",
    "progress": 45,
    "step": "Extracting text from pages..."
  }
}
```

### Delete PDF
```bash
curl -X DELETE http://localhost:3000/api/v1/pdfs/$PDF_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3. Question Endpoints

### List Questions
```bash
PDF_ID="uuid"

curl -X GET "http://localhost:3000/api/v1/questions?pdfId=$PDF_ID&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "id": "uuid",
        "pdfId": "uuid",
        "questionText": "What is TypeScript?",
        "options": ["A programming language", "A framework", "A library", "A tool"],
        "correctOptionIndex": 0,
        "difficulty": "easy",
        "qualityScore": 0.95,
        "validationStatus": "valid"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### Get Random Questions
```bash
curl -X GET "http://localhost:3000/api/v1/questions/random?pdfId=$PDF_ID&count=5&difficulty=medium" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Question Counts
```bash
curl -X GET "http://localhost:3000/api/v1/questions/counts?pdfId=$PDF_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "total": 25,
    "byDifficulty": {
      "easy": 10,
      "medium": 10,
      "hard": 5
    }
  }
}
```

---

## 4. Quiz Session Endpoints

### Create Quiz Session
```bash
PDF_ID="uuid"

curl -X POST http://localhost:3000/api/v1/quiz-sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pdfId": "'$PDF_ID'",
    "questionCount": 10,
    "difficulty": "medium",
    "timeLimit": 600
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "userId": "uuid",
      "pdfId": "uuid",
      "status": "in_progress",
      "totalQuestions": 10,
      "currentQuestionIndex": 0,
      "score": 0,
      "startedAt": "2026-02-01T...",
      "questions": [
        {
          "id": "uuid",
          "questionText": "...",
          "options": ["A", "B", "C", "D"],
          "difficulty": "medium"
        }
      ]
    }
  }
}
```

### Get Quiz Session
```bash
SESSION_ID="uuid"

curl -X GET http://localhost:3000/api/v1/quiz-sessions/$SESSION_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Submit Answer
```bash
curl -X POST http://localhost:3000/api/v1/quiz-sessions/$SESSION_ID/answers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "uuid",
    "selectedOptionIndex": 0
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "correct": true,
    "correctOptionIndex": 0
  }
}
```

### Complete Quiz Session
```bash
curl -X POST http://localhost:3000/api/v1/quiz-sessions/$SESSION_ID/complete \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "score": 80,
    "totalQuestions": 10,
    "correctAnswers": 8,
    "incorrectAnswers": 2,
    "accuracy": 0.8,
    "duration": 300,
    "completedAt": "2026-02-01T...",
    "details": {
      "byDifficulty": {
        "medium": { "correct": 8, "total": 10 }
      }
    }
  }
}
```

### List Quiz Sessions
```bash
curl -X GET "http://localhost:3000/api/v1/quiz-sessions?limit=10&status=completed" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5. Analytics Endpoints

### Get Dashboard Stats
```bash
curl -X GET http://localhost:3000/api/v1/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "pdfs": {
      "total": 5,
      "completed": 4,
      "pending": 1,
      "failed": 0,
      "totalQuestions": 125
    },
    "quizzes": {
      "total": 15,
      "completed": 12,
      "averageScore": 78.5,
      "totalQuestionsAnswered": 150,
      "correctAnswers": 120,
      "accuracy": 0.8
    },
    "recentActivity": {
      "lastQuizDate": "2026-02-01T...",
      "lastUploadDate": "2026-01-30T...",
      "quizzesThisWeek": 5
    }
  }
}
```

### Get Performance Trends
```bash
curl -X GET http://localhost:3000/api/v1/analytics/trends \
  -H "Authorization: Bearer $TOKEN"
```

### Get Weak Areas
```bash
curl -X GET http://localhost:3000/api/v1/analytics/weak-areas \
  -H "Authorization: Bearer $TOKEN"
```

### Get Learning Patterns
```bash
curl -X GET http://localhost:3000/api/v1/analytics/patterns \
  -H "Authorization: Bearer $TOKEN"
```

### Get Streaks
```bash
curl -X GET http://localhost:3000/api/v1/analytics/streaks \
  -H "Authorization: Bearer $TOKEN"
```

---

## 6. Settings Endpoints

### Get Profile
```bash
curl -X GET http://localhost:3000/api/v1/settings/profile \
  -H "Authorization: Bearer $TOKEN"
```

### Update Profile
```bash
curl -X PATCH http://localhost:3000/api/v1/settings/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Updated Name"
  }'
```

### Change Password
```bash
curl -X PUT http://localhost:3000/api/v1/settings/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "SecurePass123!",
    "newPassword": "NewSecurePass456!"
  }'
```

### Get Active Sessions
```bash
curl -X GET http://localhost:3000/api/v1/settings/sessions \
  -H "Authorization: Bearer $TOKEN"
```

### Export Account Data
```bash
curl -X GET http://localhost:3000/api/v1/settings/export \
  -H "Authorization: Bearer $TOKEN" \
  -o account_data.json
```

### Delete Account
```bash
curl -X DELETE http://localhost:3000/api/v1/settings/account \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "SecurePass123!",
    "confirmation": "DELETE MY ACCOUNT"
  }'
```

---

## 🧪 Frontend Integration Test

Open the browser at `http://localhost:5173` and test:

1. **Registration**
   - Navigate to `/register`
   - Fill in email, password, full name
   - Submit form
   - ✅ Should redirect to dashboard with access token stored

2. **Login**
   - Navigate to `/login`
   - Enter email and password
   - Submit form
   - ✅ Should redirect to dashboard

3. **Upload PDF**
   - Navigate to `/pdfs` or dashboard
   - Click "Upload PDF" button
   - Select a PDF file
   - ✅ Should show upload progress
   - ✅ Should appear in PDF list

4. **Create Quiz**
   - Navigate to `/quiz/new`
   - Select a completed PDF
   - Choose difficulty and question count
   - Start quiz
   - ✅ Should show first question

5. **Take Quiz**
   - Answer questions
   - Submit answers
   - Complete quiz
   - ✅ Should show results

6. **View Analytics**
   - Navigate to `/analytics`
   - ✅ Should display dashboard stats
   - ✅ Should show performance trends
   - ✅ Should display weak areas

7. **Manage Settings**
   - Navigate to `/settings`
   - Update profile
   - ✅ Should save changes
   - Change password
   - ✅ Should update password

---

## 🐛 Debugging Tips

### Check Network Tab
```javascript
// In browser console
localStorage.getItem('accessToken')  // Should show JWT token
localStorage.getItem('refreshToken') // Should show refresh token
```

### Check Backend Logs
```bash
# In backend terminal
# Should see request logs:
# "Request completed" { method: 'POST', path: '/api/v1/auth/login', statusCode: 200, duration: '45ms' }
```

### Common Issues

1. **401 Unauthorized**
   - Check token is stored: `localStorage.getItem('accessToken')`
   - Check token is being sent: Network tab → Request Headers → Authorization
   - Try re-login to get fresh token

2. **404 Not Found**
   - Check endpoint path includes `/v1`
   - Verify backend route is mounted correctly
   - Check Swagger docs: `http://localhost:3000/api-docs`

3. **CORS Error**
   - Ensure backend CORS is configured for frontend URL
   - Check `CORS_ORIGIN` in backend `.env`
   - Verify frontend is running on `localhost:5173`

4. **Rate Limit Error (429)**
   - Wait for rate limit window to expire (15 minutes for auth)
   - Check Redis is running: `redis-cli ping`
   - Clear rate limit: `redis-cli FLUSHDB` (dev only)

---

## ✅ Success Criteria

All endpoints should:
- ✅ Return 200/201 status codes for successful requests
- ✅ Return proper error messages for failures
- ✅ Include authentication tokens where required
- ✅ Maintain consistent response structure
- ✅ Handle pagination correctly
- ✅ Validate input data
- ✅ Respect rate limits

---

**Last Updated:** February 1, 2026  
**Backend:** http://localhost:3000  
**Frontend:** http://localhost:5173  
**Swagger Docs:** http://localhost:3000/api-docs
