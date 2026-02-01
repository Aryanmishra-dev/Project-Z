"""
Tests for FastAPI routers
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from io import BytesIO

from app.main import app


class TestHealthRoutes:
    """Tests for health check endpoints."""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_health_check(self, client):
        """Test basic health check endpoint."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "nlp-service"
    
    def test_liveness_check(self, client):
        """Test liveness check endpoint."""
        response = client.get("/health/live")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "alive"
    
    def test_readiness_check(self, client):
        """Test readiness check includes dependencies."""
        with patch('app.routers.health.get_cache') as mock_cache, \
             patch('app.routers.health.OllamaClient') as mock_llm:
            
            # Mock cache
            mock_cache_instance = MagicMock()
            mock_cache_instance.is_connected.return_value = True
            mock_cache.return_value = mock_cache_instance
            
            # Mock LLM client
            mock_llm_instance = AsyncMock()
            mock_llm_instance.check_health = AsyncMock(return_value={
                "healthy": True,
                "model_available": True,
            })
            mock_llm_instance.close = AsyncMock()
            mock_llm.return_value = mock_llm_instance
            
            response = client.get("/health/ready")
        
        assert response.status_code == 200
        data = response.json()
        assert "dependencies" in data
        assert "redis" in data["dependencies"]
        assert "ollama" in data["dependencies"]


class TestQuestionRoutes:
    """Tests for question generation endpoints."""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_list_difficulties(self, client):
        """Test listing available difficulties."""
        response = client.get("/api/v1/questions/difficulties")
        
        assert response.status_code == 200
        data = response.json()
        assert "easy" in data
        assert "medium" in data
        assert "hard" in data
    
    def test_generate_questions_validation_error(self, client):
        """Test validation error for short text."""
        response = client.post(
            "/api/v1/questions/generate",
            json={
                "text": "Too short",  # Less than 100 chars
                "difficulty": "medium",
                "count": 3,
            }
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_generate_questions_invalid_difficulty(self, client):
        """Test validation error for invalid difficulty."""
        response = client.post(
            "/api/v1/questions/generate",
            json={
                "text": "a" * 200,
                "difficulty": "invalid",
                "count": 3,
            }
        )
        
        assert response.status_code == 422
    
    def test_generate_questions_invalid_count(self, client):
        """Test validation error for invalid count."""
        response = client.post(
            "/api/v1/questions/generate",
            json={
                "text": "a" * 200,
                "difficulty": "medium",
                "count": 100,  # Max is 10
            }
        )
        
        assert response.status_code == 422


class TestPDFRoutes:
    """Tests for PDF processing endpoints."""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_extract_pdf_no_file(self, client):
        """Test error when no file provided."""
        response = client.post("/api/v1/pdf/extract")
        
        assert response.status_code == 422
    
    def test_extract_pdf_wrong_file_type(self, client):
        """Test error for non-PDF file."""
        response = client.post(
            "/api/v1/pdf/extract",
            files={"file": ("test.txt", b"not a pdf", "text/plain")},
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "INVALID_FILE_TYPE" in str(data)
    
    def test_chunk_text_success(self, client):
        """Test successful text chunking."""
        long_text = "This is a test sentence. " * 100
        
        response = client.post(
            "/api/v1/pdf/chunk",
            json={
                "text": long_text,
                "chunkSizeWords": 50,
                "overlapWords": 10,
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "chunks" in data
        assert data["totalChunks"] > 0
    
    def test_chunk_text_empty(self, client):
        """Test error for empty text."""
        response = client.post(
            "/api/v1/pdf/chunk",
            json={
                "text": "",
            }
        )
        
        assert response.status_code == 422
    
    def test_chunk_text_invalid_params(self, client):
        """Test validation for invalid chunking parameters."""
        response = client.post(
            "/api/v1/pdf/chunk",
            json={
                "text": "Some text here",
                "chunkSizeWords": 50,  # Min is 100
            }
        )
        
        # Should fail validation for chunk size below minimum
        assert response.status_code == 422


class TestRootEndpoint:
    """Tests for root endpoint."""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_root_returns_info(self, client):
        """Test root endpoint returns service info."""
        response = client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert "docs" in data
        assert "health" in data


class TestErrorHandling:
    """Tests for error handling."""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_404_not_found(self, client):
        """Test 404 for unknown endpoint."""
        response = client.get("/api/v1/unknown")
        
        assert response.status_code == 404
    
    def test_method_not_allowed(self, client):
        """Test 405 for wrong HTTP method."""
        response = client.put("/health")
        
        assert response.status_code == 405
