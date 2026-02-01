"""
Ollama LLM Client
HTTP client for Ollama API with retry logic and exponential backoff
"""
import asyncio
import json
import time
from typing import Any

import httpx

from app.config import settings
from app.utils.logger import logger
from app.utils.errors import (
    LLMError,
    LLMTimeoutError,
    LLMConnectionError,
    LLMResponseError,
    JSONParseError,
)


class OllamaClient:
    """
    Client for interacting with Ollama LLM API.
    
    Features:
    - Async HTTP requests with httpx
    - Automatic retry with exponential backoff (2s, 4s, 8s)
    - JSON response parsing
    - Configurable model parameters
    """
    
    # Exponential backoff delays in seconds
    RETRY_DELAYS = [2, 4, 8]
    
    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: int | None = None,
    ):
        """
        Initialize Ollama client.
        
        Args:
            base_url: Ollama API base URL
            model: Model name to use
            timeout: Request timeout in seconds
        """
        self.base_url = base_url or settings.ollama_base_url
        self.model = model or settings.ollama_model
        self.timeout = timeout or settings.ollama_timeout
        
        self._client: httpx.AsyncClient | None = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(self.timeout, connect=10.0),
            )
        return self._client
    
    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
    
    async def check_health(self) -> dict[str, Any]:
        """
        Check if Ollama is healthy and the model is available.
        
        Returns:
            Health status dict with 'healthy' and 'models' keys
        """
        try:
            response = await self.client.get("/api/tags")
            response.raise_for_status()
            
            data = response.json()
            models = [m["name"] for m in data.get("models", [])]
            model_available = any(self.model in m for m in models)
            
            return {
                "healthy": True,
                "models": models,
                "target_model": self.model,
                "model_available": model_available,
            }
        except httpx.ConnectError as e:
            return {
                "healthy": False,
                "error": f"Connection failed: {e}",
                "models": [],
                "model_available": False,
            }
        except Exception as e:
            return {
                "healthy": False,
                "error": str(e),
                "models": [],
                "model_available": False,
            }
    
    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        max_tokens: int | None = None,
        json_mode: bool = True,
    ) -> dict[str, Any]:
        """
        Generate text using Ollama.
        
        Args:
            prompt: User prompt
            system_prompt: System prompt for context
            temperature: Sampling temperature (0-1)
            top_p: Nucleus sampling parameter
            top_k: Top-k sampling parameter
            max_tokens: Maximum tokens to generate
            json_mode: Whether to request JSON format output
            
        Returns:
            Generated response as dict
        """
        # Build request payload
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature or settings.llm_temperature,
                "top_p": top_p or settings.llm_top_p,
                "top_k": top_k or settings.llm_top_k,
                "num_predict": max_tokens or settings.llm_max_tokens,
            },
        }
        
        if system_prompt:
            payload["system"] = system_prompt
        
        if json_mode:
            payload["format"] = "json"
        
        # Execute with retries
        return await self._execute_with_retry(payload)
    
    async def _execute_with_retry(self, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Execute request with exponential backoff retry.
        
        Args:
            payload: Request payload
            
        Returns:
            Parsed response
        """
        last_error: Exception | None = None
        
        for attempt, delay in enumerate(self.RETRY_DELAYS + [0], start=1):
            try:
                return await self._execute_request(payload, attempt)
            except (LLMTimeoutError, LLMConnectionError) as e:
                last_error = e
                
                if attempt < len(self.RETRY_DELAYS) + 1:
                    logger.warning(
                        f"LLM request failed, retrying in {delay}s",
                        data={"attempt": attempt, "error": str(e)}
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        "LLM request failed after all retries",
                        data={"attempts": attempt, "error": str(e)}
                    )
        
        raise last_error or LLMError("Unknown error during LLM request")
    
    async def _execute_request(self, payload: dict[str, Any], attempt: int) -> dict[str, Any]:
        """
        Execute a single request to Ollama.
        
        Args:
            payload: Request payload
            attempt: Current attempt number
            
        Returns:
            Parsed response
        """
        start_time = time.time()
        
        try:
            response = await self.client.post(
                "/api/generate",
                json=payload,
            )
            response.raise_for_status()
            
        except httpx.TimeoutException:
            raise LLMTimeoutError(timeout=self.timeout, attempt=attempt)
        
        except httpx.ConnectError as e:
            raise LLMConnectionError(
                url=f"{self.base_url}/api/generate",
                reason=str(e)
            )
        
        except httpx.HTTPStatusError as e:
            raise LLMResponseError(
                message=f"HTTP {e.response.status_code}: {e.response.text}",
                response=e.response.text
            )
        
        elapsed_ms = int((time.time() - start_time) * 1000)
        
        # Parse response
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            raise JSONParseError(
                response=response.text,
                parse_error=str(e)
            )
        
        # Extract the response text
        response_text = data.get("response", "")
        
        if not response_text:
            raise LLMResponseError(
                message="Empty response from LLM",
                response=response.text
            )
        
        # Parse JSON from response if in JSON mode
        if payload.get("format") == "json":
            try:
                parsed_response = json.loads(response_text)
            except json.JSONDecodeError as e:
                raise JSONParseError(
                    response=response_text,
                    parse_error=str(e)
                )
        else:
            parsed_response = {"text": response_text}
        
        logger.debug(
            "LLM request completed",
            data={
                "model": self.model,
                "attempt": attempt,
                "elapsed_ms": elapsed_ms,
                "tokens": data.get("eval_count", 0),
            }
        )
        
        return {
            "response": parsed_response,
            "raw_response": response_text,
            "model": data.get("model", self.model),
            "total_duration_ns": data.get("total_duration", 0),
            "prompt_eval_count": data.get("prompt_eval_count", 0),
            "eval_count": data.get("eval_count", 0),
            "elapsed_ms": elapsed_ms,
        }
    
    async def generate_questions(
        self,
        text_chunk: str,
        system_prompt: str,
        user_prompt: str,
        count: int = 3,
    ) -> dict[str, Any]:
        """
        Generate questions from a text chunk.
        
        This is a convenience method that combines system and user prompts
        for question generation.
        
        Args:
            text_chunk: The text to generate questions from
            system_prompt: System prompt with instructions
            user_prompt: User prompt with difficulty and format instructions
            count: Number of questions to generate
            
        Returns:
            Generated questions response
        """
        # Build the full prompt
        full_prompt = f"{user_prompt}\n\nText to analyze:\n\n{text_chunk}"
        
        return await self.generate(
            prompt=full_prompt,
            system_prompt=system_prompt,
            json_mode=True,
        )
