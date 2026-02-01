"""
NLP Service routers package
"""
from app.routers.health import router as health_router
from app.routers.questions import router as questions_router
from app.routers.pdf import router as pdf_router

__all__ = [
    "health_router",
    "questions_router",
    "pdf_router",
]
