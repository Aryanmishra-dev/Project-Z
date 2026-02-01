"""
Pydantic models for PDF processing
Defines schemas for extraction and chunking operations
"""
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field, field_validator


class PDFMetadata(BaseModel):
    """Metadata extracted from a PDF document."""
    
    filename: str = Field(
        default="",
        description="Original filename"
    )
    page_count: int = Field(
        default=0,
        alias="pageCount",
        ge=0,
        description="Total number of pages"
    )
    word_count: int = Field(
        default=0,
        alias="wordCount",
        ge=0,
        description="Total word count of extracted text"
    )
    char_count: int = Field(
        default=0,
        alias="charCount",
        ge=0,
        description="Total character count"
    )
    title: str | None = Field(
        default=None,
        description="Document title from metadata"
    )
    author: str | None = Field(
        default=None,
        description="Document author from metadata"
    )
    creation_date: datetime | None = Field(
        default=None,
        alias="creationDate",
        description="Document creation date"
    )
    file_size_bytes: int = Field(
        default=0,
        alias="fileSizeBytes",
        ge=0,
        description="File size in bytes"
    )
    has_images: bool = Field(
        default=False,
        alias="hasImages",
        description="Whether the PDF contains images"
    )
    is_scanned: bool = Field(
        default=False,
        alias="isScanned",
        description="Whether the PDF appears to be scanned"
    )
    
    model_config = {
        "populate_by_name": True,
    }


class PDFExtractionRequest(BaseModel):
    """Request to extract text from a PDF."""
    
    file_path: str | None = Field(
        default=None,
        alias="filePath",
        description="Path to the PDF file"
    )
    file_content: bytes | None = Field(
        default=None,
        alias="fileContent",
        description="PDF file content as bytes"
    )
    include_metadata: bool = Field(
        default=True,
        alias="includeMetadata",
        description="Whether to include document metadata"
    )
    filter_headers_footers: bool = Field(
        default=True,
        alias="filterHeadersFooters",
        description="Whether to filter out headers and footers"
    )
    
    model_config = {
        "populate_by_name": True,
    }
    
    @field_validator("file_path", "file_content", mode="after")
    @classmethod
    def validate_input(cls, v, info):
        """Ensure at least one input method is provided."""
        return v


class PDFExtractionResponse(BaseModel):
    """Response from PDF text extraction."""
    
    text: str = Field(
        default="",
        description="Extracted text content"
    )
    metadata: PDFMetadata = Field(
        default_factory=PDFMetadata,
        description="Document metadata"
    )
    pages: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Per-page extraction results"
    )
    extraction_time_ms: int = Field(
        default=0,
        alias="extractionTimeMs",
        description="Extraction time in milliseconds"
    )
    success: bool = Field(
        default=True,
        description="Whether extraction was successful"
    )
    error_message: str | None = Field(
        default=None,
        alias="errorMessage",
        description="Error message if extraction failed"
    )
    
    model_config = {
        "populate_by_name": True,
    }


class TextChunk(BaseModel):
    """A chunk of text with metadata."""
    
    id: str = Field(
        ...,
        description="Unique chunk identifier"
    )
    text: str = Field(
        ...,
        min_length=1,
        description="Chunk text content"
    )
    word_count: int = Field(
        default=0,
        alias="wordCount",
        ge=0,
        description="Number of words in the chunk"
    )
    char_count: int = Field(
        default=0,
        alias="charCount",
        ge=0,
        description="Number of characters in the chunk"
    )
    start_index: int = Field(
        default=0,
        alias="startIndex",
        ge=0,
        description="Start position in original text"
    )
    end_index: int = Field(
        default=0,
        alias="endIndex",
        ge=0,
        description="End position in original text"
    )
    chunk_index: int = Field(
        default=0,
        alias="chunkIndex",
        ge=0,
        description="Index of this chunk (0-based)"
    )
    overlap_start: bool = Field(
        default=False,
        alias="overlapStart",
        description="Whether chunk starts with overlap text"
    )
    overlap_end: bool = Field(
        default=False,
        alias="overlapEnd",
        description="Whether chunk ends with overlap text"
    )
    hash: str = Field(
        default="",
        description="Hash of chunk text for caching"
    )
    
    model_config = {
        "populate_by_name": True,
    }


class ChunkingRequest(BaseModel):
    """Request to chunk text."""
    
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


class ChunkingResponse(BaseModel):
    """Response from text chunking."""
    
    chunks: list[TextChunk] = Field(
        default_factory=list,
        description="List of text chunks"
    )
    total_chunks: int = Field(
        default=0,
        alias="totalChunks",
        ge=0,
        description="Total number of chunks created"
    )
    original_word_count: int = Field(
        default=0,
        alias="originalWordCount",
        ge=0,
        description="Word count of original text"
    )
    chunking_time_ms: int = Field(
        default=0,
        alias="chunkingTimeMs",
        description="Chunking time in milliseconds"
    )
    
    model_config = {
        "populate_by_name": True,
    }
