"""
NLP Service Pydantic models package
"""
from app.models.question import (
    DifficultyLevel,
    QuestionOption,
    GeneratedQuestion,
    QuestionGenerationRequest,
    QuestionGenerationResponse,
    QuestionValidationResult,
)
from app.models.pdf import (
    PDFMetadata,
    PDFExtractionRequest,
    PDFExtractionResponse,
    TextChunk,
    ChunkingRequest,
    ChunkingResponse,
)

__all__ = [
    # Question models
    "DifficultyLevel",
    "QuestionOption",
    "GeneratedQuestion",
    "QuestionGenerationRequest",
    "QuestionGenerationResponse",
    "QuestionValidationResult",
    # PDF models
    "PDFMetadata",
    "PDFExtractionRequest",
    "PDFExtractionResponse",
    "TextChunk",
    "ChunkingRequest",
    "ChunkingResponse",
]
