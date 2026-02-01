"""
Health check endpoint
Provides service health status and dependency checks
"""
from typing import Any
from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.config import settings
from app.utils.logger import logger
from app.utils.cache import get_cache
from app.services.llm_client import OllamaClient


router = APIRouter(tags=["Health"])


class HealthStatus(BaseModel):
    """Health check response model."""
    
    status: str = Field(description="Overall health status")
    service: str = Field(description="Service name")
    version: str = Field(description="Service version")
    checks: dict[str, Any] = Field(default_factory=dict, description="Individual health checks")


class DetailedHealthStatus(HealthStatus):
    """Detailed health check with dependency statuses."""
    
    dependencies: dict[str, Any] = Field(default_factory=dict, description="Dependency health details")


@router.get(
    "/health",
    response_model=HealthStatus,
    status_code=status.HTTP_200_OK,
    summary="Basic health check",
    description="Returns basic service health status. Used for load balancer health checks.",
)
async def health_check() -> HealthStatus:
    """
    Basic health check endpoint.
    
    Returns service status without checking external dependencies.
    Suitable for Kubernetes liveness probes.
    """
    return HealthStatus(
        status="healthy",
        service=settings.service_name,
        version="1.0.0",
        checks={
            "api": True,
        },
    )


@router.get(
    "/health/ready",
    response_model=DetailedHealthStatus,
    status_code=status.HTTP_200_OK,
    summary="Readiness check",
    description="Returns detailed health status including dependency checks.",
)
async def readiness_check() -> DetailedHealthStatus:
    """
    Readiness check endpoint.
    
    Checks all external dependencies (Redis, Ollama).
    Suitable for Kubernetes readiness probes.
    """
    dependencies: dict[str, Any] = {}
    all_healthy = True
    
    # Check Redis
    try:
        cache = get_cache()
        redis_healthy = cache.is_connected()
        dependencies["redis"] = {
            "healthy": redis_healthy,
            "host": settings.redis_host,
            "port": settings.redis_port,
        }
        if not redis_healthy:
            all_healthy = False
    except Exception as e:
        dependencies["redis"] = {
            "healthy": False,
            "error": str(e),
        }
        all_healthy = False
    
    # Check Ollama
    try:
        llm_client = OllamaClient()
        ollama_health = await llm_client.check_health()
        await llm_client.close()
        
        dependencies["ollama"] = {
            "healthy": ollama_health.get("healthy", False),
            "model": settings.ollama_model,
            "model_available": ollama_health.get("model_available", False),
            "url": settings.ollama_base_url,
        }
        if not ollama_health.get("healthy"):
            all_healthy = False
    except Exception as e:
        dependencies["ollama"] = {
            "healthy": False,
            "error": str(e),
        }
        all_healthy = False
    
    status_str = "healthy" if all_healthy else "degraded"
    
    logger.debug(
        "Readiness check completed",
        data={"status": status_str, "dependencies": dependencies}
    )
    
    return DetailedHealthStatus(
        status=status_str,
        service=settings.service_name,
        version="1.0.0",
        checks={
            "api": True,
            "all_dependencies": all_healthy,
        },
        dependencies=dependencies,
    )


@router.get(
    "/health/live",
    response_model=HealthStatus,
    status_code=status.HTTP_200_OK,
    summary="Liveness check",
    description="Simple liveness check for container orchestration.",
)
async def liveness_check() -> HealthStatus:
    """
    Liveness check endpoint.
    
    Simple check to verify the service is running.
    Does not check external dependencies.
    """
    return HealthStatus(
        status="alive",
        service=settings.service_name,
        version="1.0.0",
        checks={
            "process": True,
        },
    )
