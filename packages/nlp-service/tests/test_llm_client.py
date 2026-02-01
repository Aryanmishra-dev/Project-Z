"""
Tests for Ollama LLM Client
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from app.services.llm_client import OllamaClient
from app.utils.errors import LLMTimeoutError, LLMConnectionError, LLMResponseError, JSONParseError


class TestOllamaClient:
    """Tests for OllamaClient class."""
    
    def test_init_default_settings(self):
        """Test client initializes with default settings."""
        client = OllamaClient()
        
        assert "localhost:11434" in client.base_url
        assert client.model is not None
        assert client.timeout > 0
    
    def test_init_custom_settings(self):
        """Test client initializes with custom settings."""
        client = OllamaClient(
            base_url="http://custom:8080",
            model="custom-model",
            timeout=60,
        )
        
        assert client.base_url == "http://custom:8080"
        assert client.model == "custom-model"
        assert client.timeout == 60
    
    @pytest.mark.asyncio
    async def test_close_client(self):
        """Test client closes properly."""
        client = OllamaClient()
        
        # Access client to create it
        _ = client.client
        assert client._client is not None
        
        await client.close()
        
        # After close, internal client should be None
        assert client._client is None


class TestOllamaClientHealthCheck:
    """Tests for health check functionality."""
    
    @pytest.mark.asyncio
    async def test_check_health_success(self):
        """Test health check when Ollama is healthy."""
        client = OllamaClient()
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "models": [
                {"name": "mistral:7b-instruct-q4_K_M"},
                {"name": "llama2:7b"},
            ]
        }
        mock_response.raise_for_status = MagicMock()
        
        with patch.object(client.client, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            
            result = await client.check_health()
        
        assert result["healthy"] is True
        assert len(result["models"]) == 2
        await client.close()
    
    @pytest.mark.asyncio
    async def test_check_health_connection_error(self):
        """Test health check when Ollama is unreachable."""
        client = OllamaClient()
        
        with patch.object(client.client, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = httpx.ConnectError("Connection refused")
            
            result = await client.check_health()
        
        assert result["healthy"] is False
        assert "error" in result
        await client.close()


class TestOllamaClientGenerate:
    """Tests for generate functionality."""
    
    @pytest.mark.asyncio
    async def test_generate_success(self, mock_llm_response):
        """Test successful generation."""
        client = OllamaClient()
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": '{"questions": []}',
            "model": "mistral",
            "total_duration": 1000,
        }
        mock_response.raise_for_status = MagicMock()
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            
            result = await client.generate(
                prompt="Generate a question",
                system_prompt="You are helpful",
            )
        
        assert "response" in result
        assert "elapsed_ms" in result
        await client.close()
    
    @pytest.mark.asyncio
    async def test_generate_timeout(self):
        """Test generation timeout handling."""
        client = OllamaClient(timeout=1)
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.TimeoutException("Timeout")
            
            with pytest.raises(LLMTimeoutError):
                await client.generate(prompt="Test")
        
        await client.close()
    
    @pytest.mark.asyncio
    async def test_generate_connection_error(self):
        """Test generation connection error handling."""
        client = OllamaClient()
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.ConnectError("Connection refused")
            
            with pytest.raises(LLMConnectionError):
                await client.generate(prompt="Test")
        
        await client.close()
    
    @pytest.mark.asyncio
    async def test_generate_invalid_json_response(self):
        """Test handling of invalid JSON response."""
        client = OllamaClient()
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": "not valid json {",
            "model": "mistral",
        }
        mock_response.raise_for_status = MagicMock()
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            
            with pytest.raises(JSONParseError):
                await client.generate(prompt="Test", json_mode=True)
        
        await client.close()
    
    @pytest.mark.asyncio
    async def test_generate_empty_response(self):
        """Test handling of empty response."""
        client = OllamaClient()
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": "",
            "model": "mistral",
        }
        mock_response.raise_for_status = MagicMock()
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            
            with pytest.raises(LLMResponseError):
                await client.generate(prompt="Test")
        
        await client.close()


class TestOllamaClientRetry:
    """Tests for retry logic."""
    
    @pytest.mark.asyncio
    async def test_retry_on_timeout(self):
        """Test that client retries on timeout."""
        client = OllamaClient()
        
        # First two calls timeout, third succeeds
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "response": '{"result": "success"}',
            "model": "mistral",
        }
        mock_response.raise_for_status = MagicMock()
        
        call_count = 0
        async def mock_post(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise httpx.TimeoutException("Timeout")
            return mock_response
        
        with patch.object(client.client, 'post', side_effect=mock_post):
            with patch('asyncio.sleep', new_callable=AsyncMock):
                result = await client.generate(prompt="Test")
        
        assert call_count == 3
        assert "response" in result
        await client.close()
    
    @pytest.mark.asyncio
    async def test_retry_exhausted(self):
        """Test that error is raised after retries exhausted."""
        client = OllamaClient()
        
        with patch.object(client.client, 'post', new_callable=AsyncMock) as mock_post:
            mock_post.side_effect = httpx.TimeoutException("Timeout")
            
            with patch('asyncio.sleep', new_callable=AsyncMock):
                with pytest.raises(LLMTimeoutError):
                    await client.generate(prompt="Test")
        
        await client.close()
