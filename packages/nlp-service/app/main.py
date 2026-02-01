"""
NLP Service - FastAPI Application Entry Point
Provides PDF text extraction and question generation using Ollama LLM
"""
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.utils.logger import logger
from app.utils.errors import NLPServiceError
from app.utils.cache import get_cache
from app.routers import health_router, questions_router, pdf_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info(
        f"Starting {settings.service_name}",
        data={
            "host": settings.service_host,
            "port": settings.service_port,
            "debug": settings.debug,
        }
    )
    
    # Initialize cache connection
    try:
        cache = get_cache()
        if cache.is_connected():
            logger.info("Redis cache connected")
        else:
            logger.warning("Redis cache not available - caching disabled")
    except Exception as e:
        logger.warning(f"Failed to initialize cache: {e}")
    
    yield
    
    # Shutdown
    logger.info(f"Shutting down {settings.service_name}")
    
    # Close cache connection
    try:
        cache = get_cache()
        cache.close()
    except Exception:
        pass


# Create FastAPI application
app = FastAPI(
    title="NLP Service",
    description="""
## Overview

The NLP Service provides PDF text extraction and AI-powered question generation
using Ollama LLM (Mistral 7B).

## Features

- **PDF Text Extraction**: Extract text from PDF documents with metadata
- **Text Chunking**: Split text into semantic chunks for LLM processing
- **Question Generation**: Generate multiple choice questions at various difficulty levels
- **Quality Validation**: Multi-stage validation with quality scoring
- **Caching**: Redis-based caching for generated questions (30-day TTL)

## Difficulty Levels

- **Easy**: Basic recall and recognition questions
- **Medium**: Comprehension and application questions  
- **Hard**: Analysis, synthesis, and evaluation questions

## API Versioning

All endpoints are versioned under `/api/v1/`.
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler for NLPServiceError
@app.exception_handler(NLPServiceError)
async def nlp_error_handler(request: Request, exc: NLPServiceError) -> JSONResponse:
    """Handle NLP service errors."""
    logger.error(
        f"NLP Service Error: {exc.message}",
        data={"code": exc.code, "details": exc.details}
    )
    return JSONResponse(
        status_code=500,
        content=exc.to_dict(),
    )


# Include routers
app.include_router(health_router)
app.include_router(questions_router)
app.include_router(pdf_router)


@app.get("/", include_in_schema=False)
async def root():
    """Root endpoint - redirects to docs."""
    return {
        "service": settings.service_name,
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


# Development entry point
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.service_host,
        port=settings.service_port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
