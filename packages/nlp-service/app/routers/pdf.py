"""
PDF processing endpoints
Handles PDF text extraction and chunking
"""
from typing import Annotated
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel, Field

from app.config import settings
from app.utils.logger import logger
from app.utils.errors import PDFExtractionError, OCRRequiredError, ChunkingError
from app.models.pdf import (
    PDFExtractionResponse,
    ChunkingRequest,
    ChunkingResponse,
)
from app.services.pdf_extractor import PDFExtractor
from app.services.text_chunker import TextChunker


router = APIRouter(prefix="/api/v1/pdf", tags=["PDF"])


# Maximum file size (50 MB)
MAX_FILE_SIZE = 50 * 1024 * 1024


class ChunkTextBody(BaseModel):
    """Request body for text chunking."""
    
    text: str = Field(
        ...,
        min_length=1,
        description="Text to chunk"
    )
    chunk_size_words: int = Field(
        default=800,
        alias="chunkSizeWords",
        ge=100,
        le=2000,
        description="Target chunk size in words"
    )
    overlap_words: int = Field(
        default=200,
        alias="overlapWords",
        ge=0,
        le=500,
        description="Number of words to overlap between chunks"
    )
    respect_sentences: bool = Field(
        default=True,
        alias="respectSentences",
        description="Whether to respect sentence boundaries"
    )
    
    model_config = {
        "populate_by_name": True,
    }


@router.post(
    "/extract",
    response_model=PDFExtractionResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract text from PDF",
    description="""
Extract text content from a PDF file.

**Features:**
- Extracts text from all pages
- Filters headers and footers (optional)
- Extracts document metadata (title, author, dates)
- Detects scanned/image-based PDFs

**Limitations:**
- Maximum file size: 50 MB
- Scanned PDFs require OCR (not currently supported)
    """,
    responses={
        200: {"description": "Text extracted successfully"},
        400: {"description": "Invalid PDF file or extraction error"},
        413: {"description": "File too large"},
        422: {"description": "PDF requires OCR processing"},
    }
)
async def extract_pdf(
    file: Annotated[UploadFile, File(description="PDF file to extract text from")],
    filter_headers_footers: Annotated[
        bool, 
        Form(alias="filterHeadersFooters", description="Filter out headers and footers")
    ] = True,
    include_metadata: Annotated[
        bool,
        Form(alias="includeMetadata", description="Include document metadata")
    ] = True,
) -> PDFExtractionResponse:
    """
    Extract text from an uploaded PDF file.
    
    Args:
        file: Uploaded PDF file
        filter_headers_footers: Whether to filter headers/footers
        include_metadata: Whether to include metadata
        
    Returns:
        Extracted text and metadata
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_FILE_TYPE", "message": "File must be a PDF"}},
        )
    
    # Read file content
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "FILE_READ_ERROR", "message": str(e)}},
        )
    
    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": {
                    "code": "FILE_TOO_LARGE",
                    "message": f"File size exceeds {MAX_FILE_SIZE // (1024*1024)} MB limit",
                }
            },
        )
    
    logger.info(
        "PDF extraction request",
        data={
            "filename": file.filename,
            "size_bytes": len(content),
            "filter_headers": filter_headers_footers,
        }
    )
    
    try:
        extractor = PDFExtractor(filter_headers_footers=filter_headers_footers)
        
        response = extractor.extract_from_bytes(
            content=content,
            filename=file.filename or "document.pdf",
            file_size=len(content),
        )
        
        # Optionally strip metadata
        if not include_metadata:
            response.metadata.title = None
            response.metadata.author = None
            response.metadata.creation_date = None
        
        return response
        
    except OCRRequiredError as e:
        logger.warning(f"PDF requires OCR: {file.filename}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.to_dict(),
        )
    
    except PDFExtractionError as e:
        logger.error(f"PDF extraction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.to_dict(),
        )
    
    except Exception as e:
        logger.error(f"Unexpected error in PDF extraction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "INTERNAL_ERROR", "message": str(e)}},
        )


@router.post(
    "/chunk",
    response_model=ChunkingResponse,
    status_code=status.HTTP_200_OK,
    summary="Chunk text into segments",
    description="""
Split text into semantic chunks suitable for LLM processing.

**Chunking Strategy:**
- Target size: 800 words (±10%)
- Overlap: 200 words between chunks
- Respects sentence boundaries using spaCy

**Use Cases:**
- Preparing text for question generation
- Breaking down large documents for processing
    """,
)
async def chunk_text(
    body: ChunkTextBody,
) -> ChunkingResponse:
    """
    Chunk text into semantic segments.
    
    Args:
        body: Chunking request parameters
        
    Returns:
        List of text chunks with metadata
    """
    logger.info(
        "Text chunking request",
        data={
            "text_length": len(body.text),
            "chunk_size": body.chunk_size_words,
            "overlap": body.overlap_words,
        }
    )
    
    try:
        chunker = TextChunker(
            chunk_size_words=body.chunk_size_words,
            overlap_words=body.overlap_words,
            respect_sentences=body.respect_sentences,
        )
        
        response = chunker.chunk_text(body.text)
        
        return response
        
    except ChunkingError as e:
        logger.error(f"Chunking error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.to_dict(),
        )
    
    except Exception as e:
        logger.error(f"Unexpected error in chunking: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "INTERNAL_ERROR", "message": str(e)}},
        )
