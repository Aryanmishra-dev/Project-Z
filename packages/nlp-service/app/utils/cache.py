"""
Redis caching utilities for NLP Service
Handles question caching with TTL and hash-based keys
"""
import hashlib
import json
from typing import Any
from functools import lru_cache

import redis
from redis.exceptions import RedisError

from app.config import settings
from app.utils.logger import logger


class RedisCache:
    """Redis cache client with NLP-specific helpers."""
    
    def __init__(self):
        """Initialize Redis connection."""
        self._client: redis.Redis | None = None
        self._connected = False
    
    @property
    def client(self) -> redis.Redis:
        """Get or create Redis client."""
        if self._client is None:
            self._client = redis.Redis(
                host=settings.redis_host,
                port=settings.redis_port,
                password=settings.redis_password or None,
                db=settings.redis_db,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
            )
        return self._client
    
    def is_connected(self) -> bool:
        """Check if Redis is connected and responsive."""
        try:
            return self.client.ping()
        except RedisError as e:
            logger.warning(f"Redis connection check failed: {e}")
            return False
    
    def _build_key(self, *parts: str) -> str:
        """Build a cache key with prefix."""
        return f"{settings.cache_key_prefix}{''.join(parts)}"
    
    @staticmethod
    def hash_text(text: str) -> str:
        """Generate SHA256 hash of text, truncated to 16 chars."""
        return hashlib.sha256(text.encode()).hexdigest()[:16]
    
    def get_question_cache_key(self, chunk_text: str, difficulty: str) -> str:
        """
        Generate cache key for question generation.
        Format: nlp:questions:v1:{chunk_hash}:{difficulty}
        """
        chunk_hash = self.hash_text(chunk_text)
        return self._build_key(f"questions:v1:{chunk_hash}:{difficulty}")
    
    def get(self, key: str) -> Any | None:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value (JSON parsed) or None if not found
        """
        try:
            value = self.client.get(key)
            if value is not None:
                return json.loads(value)
            return None
        except RedisError as e:
            logger.error(f"Cache get error: {e}", data={"key": key})
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Cache JSON decode error: {e}", data={"key": key})
            return None
    
    def set(
        self, 
        key: str, 
        value: Any, 
        ttl: int | None = None
    ) -> bool:
        """
        Set value in cache with optional TTL.
        
        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl: Time-to-live in seconds (defaults to config value)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            ttl = ttl or settings.cache_ttl_seconds
            serialized = json.dumps(value, default=str)
            self.client.setex(key, ttl, serialized)
            return True
        except RedisError as e:
            logger.error(f"Cache set error: {e}", data={"key": key})
            return False
        except (TypeError, json.JSONEncodeError) as e:
            logger.error(f"Cache serialization error: {e}", data={"key": key})
            return False
    
    def delete(self, key: str) -> bool:
        """Delete a key from cache."""
        try:
            self.client.delete(key)
            return True
        except RedisError as e:
            logger.error(f"Cache delete error: {e}", data={"key": key})
            return False
    
    def get_questions(self, chunk_text: str, difficulty: str) -> dict[str, Any] | None:
        """
        Get cached questions for a chunk.
        
        Args:
            chunk_text: The text chunk
            difficulty: Difficulty level
            
        Returns:
            Cached question data or None
        """
        key = self.get_question_cache_key(chunk_text, difficulty)
        data = self.get(key)
        
        if data:
            logger.debug("Cache hit for questions", data={
                "difficulty": difficulty,
                "chunk_hash": self.hash_text(chunk_text),
            })
        
        return data
    
    def set_questions(
        self, 
        chunk_text: str, 
        difficulty: str, 
        questions_data: dict[str, Any]
    ) -> bool:
        """
        Cache generated questions.
        
        Args:
            chunk_text: The text chunk
            difficulty: Difficulty level
            questions_data: Question generation result
            
        Returns:
            True if cached successfully
        """
        key = self.get_question_cache_key(chunk_text, difficulty)
        success = self.set(key, questions_data)
        
        if success:
            logger.debug("Cached questions", data={
                "difficulty": difficulty,
                "chunk_hash": self.hash_text(chunk_text),
                "question_count": len(questions_data.get("questions", [])),
            })
        
        return success
    
    def close(self) -> None:
        """Close Redis connection."""
        if self._client:
            self._client.close()
            self._client = None


# Singleton cache instance
_cache_instance: RedisCache | None = None


def get_cache() -> RedisCache:
    """Get the singleton cache instance."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = RedisCache()
    return _cache_instance
