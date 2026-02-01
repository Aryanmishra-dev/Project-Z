"""
Custom exception classes for NLP Service
Provides structured error handling throughout the application
"""
from typing import Any


class NLPServiceError(Exception):
    """Base exception for NLP Service errors."""
    
    def __init__(
        self, 
        message: str, 
        code: str = "NLP_ERROR",
        details: dict[str, Any] | None = None
    ):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> dict[str, Any]:
        """Convert exception to dictionary for API responses."""
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }


class PDFExtractionError(NLPServiceError):
    """Error during PDF text extraction."""
    
    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="PDF_EXTRACTION_ERROR",
            details=details,
        )


class OCRRequiredError(PDFExtractionError):
    """PDF appears to be scanned and requires OCR."""
    
    def __init__(self, page_count: int = 0):
        super().__init__(
            message="PDF appears to be scanned or image-based. OCR processing is required.",
            details={"page_count": page_count, "requires_ocr": True},
        )


class ChunkingError(NLPServiceError):
    """Error during text chunking."""
    
    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="CHUNKING_ERROR",
            details=details,
        )


class LLMError(NLPServiceError):
    """Base error for LLM-related issues."""
    
    def __init__(
        self, 
        message: str, 
        code: str = "LLM_ERROR",
        details: dict[str, Any] | None = None
    ):
        super().__init__(message=message, code=code, details=details)


class LLMTimeoutError(LLMError):
    """LLM request timed out."""
    
    def __init__(self, timeout: int, attempt: int = 1):
        super().__init__(
            message=f"LLM request timed out after {timeout} seconds",
            code="LLM_TIMEOUT",
            details={"timeout_seconds": timeout, "attempt": attempt},
        )


class LLMConnectionError(LLMError):
    """Failed to connect to LLM service."""
    
    def __init__(self, url: str, reason: str = "Connection refused"):
        super().__init__(
            message=f"Failed to connect to LLM service: {reason}",
            code="LLM_CONNECTION_ERROR",
            details={"url": url, "reason": reason},
        )


class LLMResponseError(LLMError):
    """Invalid response from LLM."""
    
    def __init__(self, message: str, response: str | None = None):
        super().__init__(
            message=message,
            code="LLM_RESPONSE_ERROR",
            details={"raw_response": response[:500] if response else None},
        )


class JSONParseError(LLMError):
    """Failed to parse JSON from LLM response."""
    
    def __init__(self, response: str, parse_error: str):
        super().__init__(
            message="Failed to parse JSON from LLM response",
            code="JSON_PARSE_ERROR",
            details={
                "parse_error": parse_error,
                "response_preview": response[:200] if response else None,
            },
        )


class ValidationError(NLPServiceError):
    """Error during question validation."""
    
    def __init__(self, message: str, field_errors: dict[str, list[str]] | None = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            details={"field_errors": field_errors or {}},
        )


class CacheError(NLPServiceError):
    """Error with cache operations."""
    
    def __init__(self, message: str, operation: str = "unknown"):
        super().__init__(
            message=message,
            code="CACHE_ERROR",
            details={"operation": operation},
        )
