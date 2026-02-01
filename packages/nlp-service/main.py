from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from dotenv import load_dotenv
import httpx
import json
import time
import os
import fitz  # PyMuPDF for PDF extraction
import tempfile

# Load environment variables from .env file
load_dotenv()

app = FastAPI(
    title="NLP Service",
    description="Quiz generation service using OpenRouter API",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenRouter API configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.2-3b-instruct:free")

# Models
class QuestionRequest(BaseModel):
    text: str = Field(..., min_length=50, max_length=50000)
    count: int = Field(default=10, ge=5, le=50)
    difficulty: Optional[str] = Field(default="medium")

class Question(BaseModel):
    type: str
    difficulty: str
    question_text: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: Optional[str] = None
    quality_score: float

class QuestionResponse(BaseModel):
    questions: List[Question]
    processing_time: float

class ExtractionResponse(BaseModel):
    success: bool
    page_count: int
    text_length: int
    metadata: dict
    extracted_text: str

class GenerateQuestionsResponse(BaseModel):
    success: bool
    questions: List[dict]

# Routes
@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "nlp-service",
        "status": "healthy",
        "version": "1.0.0"
    }

@app.get("/health")
async def health():
    """Detailed health check"""
    try:
        api_key_status = "configured" if OPENROUTER_API_KEY else "missing"
        
        return {
            "status": "healthy",
            "api": "OpenRouter",
            "api_key_status": api_key_status,
            "model": OPENROUTER_MODEL,
            "timestamp": time.time()
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@app.post("/api/v1/extract", response_model=ExtractionResponse)
async def extract_pdf(file: UploadFile = File(...)):
    """Extract text from uploaded PDF file"""
    try:
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")
        
        # Read file content
        content = await file.read()
        
        # Open PDF with PyMuPDF
        doc = fitz.open(stream=content, filetype="pdf")
        
        # Extract text from all pages
        extracted_text = ""
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            extracted_text += page.get_text() + "\n"
        
        # Get metadata
        metadata = doc.metadata or {}
        
        page_count = len(doc)
        text_length = len(extracted_text)
        
        doc.close()
        
        return ExtractionResponse(
            success=True,
            page_count=page_count,
            text_length=text_length,
            metadata={
                "title": metadata.get("title", ""),
                "author": metadata.get("author", ""),
                "subject": metadata.get("subject", ""),
                "keywords": metadata.get("keywords", "").split(",") if metadata.get("keywords") else []
            },
            extracted_text=extracted_text.strip()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction failed: {str(e)}")

@app.post("/api/v1/generate-questions", response_model=GenerateQuestionsResponse)
async def generate_questions_v1(request: QuestionRequest):
    """Generate quiz questions from text using OpenRouter API (versioned endpoint)"""
    return await _generate_questions_internal(request)

@app.post("/generate-questions", response_model=QuestionResponse)
async def generate_questions(request: QuestionRequest):
    """Generate quiz questions from text using OpenRouter API"""
    start_time = time.time()
    result = await _generate_questions_internal(request)
    processing_time = time.time() - start_time
    
    # Convert to original response format
    questions = []
    for q in result.questions:
        questions.append(Question(
            type=q.get("type", "multiple_choice"),
            difficulty=q.get("difficulty", request.difficulty),
            question_text=q.get("question_text", ""),
            options=q.get("options"),
            correct_answer=q.get("correct_answer", ""),
            explanation=q.get("explanation"),
            quality_score=q.get("quality_score", 0.7)
        ))
    
    return QuestionResponse(questions=questions, processing_time=processing_time)

async def _generate_questions_internal(request: QuestionRequest) -> GenerateQuestionsResponse:
    """Internal function to generate questions"""
    try:
        if not OPENROUTER_API_KEY:
            raise HTTPException(status_code=500, detail="OpenRouter API key not configured")
        
        # Create prompt for OpenRouter
        prompt = f"""Generate {request.count} quiz questions from the following text. 
        Difficulty level: {request.difficulty}
        
        Text: {request.text[:8000]}
        
        Return ONLY a JSON array with this exact structure (no other text):
        [
          {{
            "type": "multiple_choice",
            "difficulty": "{request.difficulty}",
            "question_text": "question here?",
            "options": {{"A": "option1", "B": "option2", "C": "option3", "D": "option4"}},
            "correct_option": "A",
            "explanation": "why this is correct",
            "page_reference": 1,
            "quality_score": 0.8
          }}
        ]
        
        Make questions clear, relevant, and well-formatted. Include 4 options for multiple choice.
        """
        
        # Call OpenRouter API
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.getenv("FRONTEND_URL", "http://localhost:5173"),
            "X-Title": "QuizGenius"
        }
        
        payload = {
            "model": OPENROUTER_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a helpful quiz generator. Always respond with valid JSON arrays only, no additional text."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "top_p": 0.9,
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(OPENROUTER_API_URL, headers=headers, json=payload)
            response.raise_for_status()
            result = response.json()
        
        # Parse response
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        # Try to extract JSON from response
        try:
            # Find JSON array in response
            start_idx = content.find('[')
            end_idx = content.rfind(']') + 1
            if start_idx != -1 and end_idx != 0:
                json_str = content[start_idx:end_idx]
                questions_data = json.loads(json_str)
            else:
                # Fallback: create sample questions
                questions_data = create_sample_questions(request.count, request.difficulty)
        except json.JSONDecodeError:
            # Fallback to sample questions if parsing fails
            questions_data = create_sample_questions(request.count, request.difficulty)
        
        return GenerateQuestionsResponse(
            success=True,
            questions=questions_data[:request.count]
        )
        
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"OpenRouter API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

def create_sample_questions(count: int, difficulty: str) -> List[dict]:
    """Create sample questions as fallback"""
    questions = []
    for i in range(count):
        questions.append({
            "type": "multiple_choice",
            "difficulty": difficulty,
            "question_text": f"Sample question {i + 1} about the content?",
            "options": {
                "A": f"Option A for question {i + 1}",
                "B": f"Option B for question {i + 1}",
                "C": f"Option C for question {i + 1}",
                "D": f"Option D for question {i + 1}"
            },
            "correct_option": "A",
            "explanation": "This is a sample explanation for the correct answer.",
            "page_reference": 1,
            "quality_score": 0.6
        })
    return questions

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("NLP_SERVICE_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

