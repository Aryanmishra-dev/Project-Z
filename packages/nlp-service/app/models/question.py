"""
Pydantic models for question generation
Defines request/response schemas and validation rules
"""
from enum import Enum
from typing import Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class DifficultyLevel(str, Enum):
    """Question difficulty levels."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class QuestionOption(BaseModel):
    """A single answer option for a multiple choice question."""
    
    id: str = Field(
        ...,
        pattern=r"^[A-D]$",
        description="Option identifier (A, B, C, or D)"
    )
    text: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Option text"
    )
    
    @field_validator("text")
    @classmethod
    def clean_text(cls, v: str) -> str:
        """Clean and normalize option text."""
        return v.strip()


class GeneratedQuestion(BaseModel):
    """A generated multiple choice question."""
    
    question_text: str = Field(
        ...,
        min_length=10,
        max_length=1000,
        alias="questionText",
        description="The question text"
    )
    options: list[QuestionOption] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="Exactly 4 answer options"
    )
    correct_answer: str = Field(
        ...,
        pattern=r"^[A-D]$",
        alias="correctAnswer",
        description="The correct option ID"
    )
    explanation: str = Field(
        ...,
        min_length=10,
        max_length=1000,
        description="Explanation of why the answer is correct"
    )
    difficulty: DifficultyLevel = Field(
        ...,
        description="Question difficulty level"
    )
    quality_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        alias="qualityScore",
        description="Quality score from 0.0 to 1.0"
    )
    validation_passed: bool = Field(
        default=False,
        alias="validationPassed",
        description="Whether the question passed all validation stages"
    )
    
    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "questionText": "What is the primary function of mitochondria in a cell?",
                "options": [
                    {"id": "A", "text": "Protein synthesis"},
                    {"id": "B", "text": "Energy production (ATP)"},
                    {"id": "C", "text": "Cell division"},
                    {"id": "D", "text": "Waste removal"},
                ],
                "correctAnswer": "B",
                "explanation": "Mitochondria are known as the 'powerhouse of the cell' because they produce ATP through cellular respiration.",
                "difficulty": "easy",
                "qualityScore": 0.85,
                "validationPassed": True,
            }
        }
    }
    
    @field_validator("options")
    @classmethod
    def validate_option_ids(cls, v: list[QuestionOption]) -> list[QuestionOption]:
        """Ensure options have unique IDs and include A, B, C, D."""
        ids = {opt.id for opt in v}
        expected_ids = {"A", "B", "C", "D"}
        if ids != expected_ids:
            raise ValueError(f"Options must have IDs A, B, C, D. Got: {ids}")
        return v
    
    @field_validator("correct_answer")
    @classmethod
    def validate_correct_answer(cls, v: str, info) -> str:
        """Ensure correct answer matches one of the options."""
        # This validator runs after options validator
        return v


class QuestionGenerationRequest(BaseModel):
    """Request to generate questions from text."""
    
    text: str = Field(
        ...,
        min_length=100,
        max_length=50000,
        description="Text content to generate questions from"
    )
    difficulty: DifficultyLevel = Field(
        default=DifficultyLevel.MEDIUM,
        description="Desired difficulty level"
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
        "json_schema_extra": {
            "example": {
                "text": "Mitochondria are membrane-bound organelles found in the cytoplasm of eukaryotic cells...",
                "difficulty": "medium",
                "count": 3,
                "useCache": True,
            }
        }
    }


class QuestionGenerationResponse(BaseModel):
    """Response from question generation."""
    
    questions: list[GeneratedQuestion] = Field(
        default_factory=list,
        description="Generated questions"
    )
    total_generated: int = Field(
        default=0,
        alias="totalGenerated",
        description="Total number of questions generated before filtering"
    )
    total_valid: int = Field(
        default=0,
        alias="totalValid",
        description="Number of questions that passed validation"
    )
    from_cache: bool = Field(
        default=False,
        alias="fromCache",
        description="Whether results were retrieved from cache"
    )
    chunk_count: int = Field(
        default=1,
        alias="chunkCount",
        description="Number of text chunks processed"
    )
    processing_time_ms: int = Field(
        default=0,
        alias="processingTimeMs",
        description="Processing time in milliseconds"
    )
    
    model_config = {
        "populate_by_name": True,
    }


class QuestionValidationResult(BaseModel):
    """Result of validating a generated question."""
    
    is_valid: bool = Field(
        default=False,
        alias="isValid",
        description="Whether the question passed all validation stages"
    )
    quality_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        alias="qualityScore",
        description="Overall quality score"
    )
    stage_results: dict[str, bool] = Field(
        default_factory=dict,
        alias="stageResults",
        description="Results of each validation stage"
    )
    issues: list[str] = Field(
        default_factory=list,
        description="List of validation issues found"
    )
    metrics: dict[str, Any] = Field(
        default_factory=dict,
        description="Detailed validation metrics"
    )
    
    model_config = {
        "populate_by_name": True,
    }
