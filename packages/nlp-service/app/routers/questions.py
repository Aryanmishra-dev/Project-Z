"""
Question generation endpoints
Handles MCQ generation from text
"""
from typing import Annotated
from fastapi import APIRouter, HTTPException, status, Depends, Body
from pydantic import BaseModel, Field

from app.config import settings
from app.utils.logger import logger
from app.utils.errors import LLMError, ChunkingError
from app.models.question import (
    DifficultyLevel,
    QuestionGenerationRequest,
    QuestionGenerationResponse,
)
from app.services.question_generator import QuestionGenerator


router = APIRouter(prefix="/api/v1/questions", tags=["Questions"])


# Dependency to get question generator
async def get_generator() -> QuestionGenerator:
    """Get question generator instance."""
    return QuestionGenerator()


class QuestionGenerateBody(BaseModel):
    """Request body for question generation."""
    
    text: str = Field(
        ...,
        min_length=100,
        max_length=50000,
        description="Text content to generate questions from",
        json_schema_extra={
            "example": "Mitochondria are membrane-bound organelles found in the cytoplasm of eukaryotic cells. They are often referred to as the 'powerhouse of the cell' because they generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy."
        }
    )
    difficulty: DifficultyLevel = Field(
        default=DifficultyLevel.MEDIUM,
        description="Desired difficulty level for generated questions"
    )
    count: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Number of questions to generate"
    )
    use_cache: bool = Field(
        default=True,
        alias="useCache",
        description="Whether to use cached results if available"
    )
    
    model_config = {
        "populate_by_name": True,
    }


@router.post(
    "/generate",
    response_model=QuestionGenerationResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate questions from text",
    description="""
Generate multiple choice questions from the provided text content.

The text will be:
1. Chunked into semantic segments (~800 words each)
2. Processed through the LLM with difficulty-specific prompts
3. Validated for quality (structure, length, semantic consistency)
4. Optionally cached for future requests

**Difficulty Levels:**
- `easy`: Basic recall and recognition questions
- `medium`: Comprehension and application questions
- `hard`: Analysis, synthesis, and evaluation questions

**Quality Validation:**
- Each question goes through 4-stage validation
- Questions must score above the quality threshold (0.4) to be included
- Quality score ranges from 0.0 to 1.0
    """,
    responses={
        200: {
            "description": "Questions generated successfully",
            "content": {
                "application/json": {
                    "example": {
                        "questions": [
                            {
                                "questionText": "What is the primary function of mitochondria?",
                                "options": [
                                    {"id": "A", "text": "Protein synthesis"},
                                    {"id": "B", "text": "ATP production"},
                                    {"id": "C", "text": "Cell division"},
                                    {"id": "D", "text": "DNA replication"},
                                ],
                                "correctAnswer": "B",
                                "explanation": "Mitochondria produce ATP through cellular respiration.",
                                "difficulty": "medium",
                                "qualityScore": 0.85,
                                "validationPassed": True,
                            }
                        ],
                        "totalGenerated": 3,
                        "totalValid": 3,
                        "fromCache": False,
                        "chunkCount": 1,
                        "processingTimeMs": 2500,
                    }
                }
            }
        },
        400: {"description": "Invalid request parameters"},
        500: {"description": "Internal server error"},
        503: {"description": "LLM service unavailable"},
    }
)
async def generate_questions(
    body: Annotated[QuestionGenerateBody, Body()],
    generator: Annotated[QuestionGenerator, Depends(get_generator)],
) -> QuestionGenerationResponse:
    """
    Generate multiple choice questions from text.
    
    Args:
        body: Request body with text and generation parameters
        generator: Question generator service
        
    Returns:
        Generated questions with metadata
    """
    logger.info(
        "Question generation request",
        data={
            "text_length": len(body.text),
            "difficulty": body.difficulty.value,
            "count": body.count,
        }
    )
    
    try:
        # Build request
        request = QuestionGenerationRequest(
            text=body.text,
            difficulty=body.difficulty,
            count=body.count,
            use_cache=body.use_cache,
        )
        
        # Generate questions
        response = await generator.generate(request)
        
        # Close generator resources
        await generator.close()
        
        return response
        
    except ChunkingError as e:
        logger.error(f"Chunking error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.to_dict(),
        )
    
    except LLMError as e:
        logger.error(f"LLM error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=e.to_dict(),
        )
    
    except Exception as e:
        logger.error(f"Unexpected error in question generation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "INTERNAL_ERROR", "message": str(e)}},
        )


@router.get(
    "/difficulties",
    response_model=list[str],
    summary="List available difficulty levels",
    description="Returns all available difficulty levels for question generation.",
)
async def list_difficulties() -> list[str]:
    """Get list of available difficulty levels."""
    return [level.value for level in DifficultyLevel]
