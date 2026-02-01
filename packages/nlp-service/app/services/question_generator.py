"""
Question Generation Service
Orchestrates the full pipeline: chunk -> prompt -> LLM -> validate -> cache
"""
import time
from typing import Any

from app.config import settings
from app.utils.logger import logger
from app.utils.cache import get_cache, RedisCache
from app.models.question import (
    DifficultyLevel,
    GeneratedQuestion,
    QuestionGenerationRequest,
    QuestionGenerationResponse,
)
from app.models.pdf import TextChunk
from app.services.text_chunker import TextChunker
from app.services.llm_client import OllamaClient
from app.services.question_validator import QuestionValidator
from app.prompts import get_system_prompt, get_user_prompt


class QuestionGenerator:
    """
    Orchestrates question generation from text.
    
    Pipeline:
    1. Chunk text into semantic segments
    2. For each chunk: check cache -> generate -> validate
    3. Cache valid results
    4. Return aggregated questions
    """
    
    def __init__(
        self,
        chunker: TextChunker | None = None,
        llm_client: OllamaClient | None = None,
        validator: QuestionValidator | None = None,
        cache: RedisCache | None = None,
    ):
        """
        Initialize the question generator.
        
        Args:
            chunker: Text chunker (created if not provided)
            llm_client: LLM client (created if not provided)
            validator: Question validator (created if not provided)
            cache: Redis cache (uses global if not provided)
        """
        self.chunker = chunker or TextChunker()
        self.llm_client = llm_client or OllamaClient()
        self.validator = validator or QuestionValidator()
        self.cache = cache or get_cache()
    
    async def generate(
        self,
        request: QuestionGenerationRequest
    ) -> QuestionGenerationResponse:
        """
        Generate questions from text.
        
        Args:
            request: Question generation request
            
        Returns:
            QuestionGenerationResponse with generated questions
        """
        start_time = time.time()
        
        logger.info(
            "Starting question generation",
            data={
                "text_length": len(request.text),
                "difficulty": request.difficulty.value,
                "count": request.count,
                "use_cache": request.use_cache,
            }
        )
        
        # Chunk the text
        chunking_result = self.chunker.chunk_text(request.text)
        chunks = chunking_result.chunks
        
        logger.debug(f"Created {len(chunks)} chunks from input text")
        
        # Generate questions from each chunk
        all_questions: list[GeneratedQuestion] = []
        total_generated = 0
        from_cache = False
        
        # Calculate questions per chunk
        questions_per_chunk = max(1, request.count // len(chunks)) if chunks else request.count
        
        for chunk in chunks:
            # Check cache first
            if request.use_cache:
                cached = self._get_from_cache(chunk, request.difficulty)
                if cached:
                    all_questions.extend(cached)
                    total_generated += len(cached)
                    from_cache = True
                    continue
            
            # Generate questions for this chunk
            chunk_questions, generated_count = await self._generate_for_chunk(
                chunk=chunk,
                difficulty=request.difficulty,
                count=questions_per_chunk,
            )
            
            total_generated += generated_count
            
            if chunk_questions:
                all_questions.extend(chunk_questions)
                
                # Cache the results
                if request.use_cache:
                    self._save_to_cache(chunk, request.difficulty, chunk_questions)
        
        # Limit to requested count
        if len(all_questions) > request.count:
            all_questions = all_questions[:request.count]
        
        processing_time = int((time.time() - start_time) * 1000)
        
        logger.info(
            "Question generation completed",
            data={
                "total_generated": total_generated,
                "valid_questions": len(all_questions),
                "chunks_processed": len(chunks),
                "from_cache": from_cache,
                "processing_time_ms": processing_time,
            }
        )
        
        return QuestionGenerationResponse(
            questions=all_questions,
            total_generated=total_generated,
            total_valid=len(all_questions),
            from_cache=from_cache,
            chunk_count=len(chunks),
            processing_time_ms=processing_time,
        )
    
    async def _generate_for_chunk(
        self,
        chunk: TextChunk,
        difficulty: DifficultyLevel,
        count: int,
    ) -> tuple[list[GeneratedQuestion], int]:
        """
        Generate and validate questions for a single chunk.
        
        Args:
            chunk: Text chunk
            difficulty: Difficulty level
            count: Number of questions to generate
            
        Returns:
            Tuple of (valid_questions, total_generated)
        """
        try:
            # Get prompts
            system_prompt = get_system_prompt()
            user_prompt = get_user_prompt(difficulty, count)
            
            # Generate with LLM
            result = await self.llm_client.generate_questions(
                text_chunk=chunk.text,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                count=count,
            )
            
            # Parse questions from response
            response_data = result.get("response", {})
            questions_data = response_data.get("questions", [])
            
            if not questions_data:
                logger.warning(
                    "No questions in LLM response",
                    data={"chunk_id": chunk.id}
                )
                return [], 0
            
            # Validate each question
            valid_questions: list[GeneratedQuestion] = []
            
            for q_data in questions_data:
                validation_result, validated_question = self.validator.validate(
                    question_data=q_data,
                    difficulty=difficulty,
                    source_text=chunk.text,
                )
                
                if validation_result.is_valid and validated_question:
                    valid_questions.append(validated_question)
                else:
                    logger.debug(
                        "Question failed validation",
                        data={
                            "chunk_id": chunk.id,
                            "score": validation_result.quality_score,
                            "issues": validation_result.issues[:3],
                        }
                    )
            
            return valid_questions, len(questions_data)
            
        except Exception as e:
            logger.error(
                f"Failed to generate questions for chunk: {e}",
                data={"chunk_id": chunk.id, "error": str(e)}
            )
            return [], 0
    
    def _get_from_cache(
        self,
        chunk: TextChunk,
        difficulty: DifficultyLevel
    ) -> list[GeneratedQuestion] | None:
        """
        Get questions from cache.
        
        Args:
            chunk: Text chunk
            difficulty: Difficulty level
            
        Returns:
            List of cached questions or None
        """
        try:
            cached_data = self.cache.get_questions(chunk.text, difficulty.value)
            
            if cached_data and "questions" in cached_data:
                questions = []
                for q_data in cached_data["questions"]:
                    try:
                        question = GeneratedQuestion(**q_data)
                        questions.append(question)
                    except Exception:
                        continue
                
                if questions:
                    logger.debug(
                        "Cache hit",
                        data={
                            "chunk_hash": chunk.hash[:8],
                            "difficulty": difficulty.value,
                            "count": len(questions),
                        }
                    )
                    return questions
            
            return None
            
        except Exception as e:
            logger.warning(f"Cache get failed: {e}")
            return None
    
    def _save_to_cache(
        self,
        chunk: TextChunk,
        difficulty: DifficultyLevel,
        questions: list[GeneratedQuestion]
    ) -> None:
        """
        Save questions to cache.
        
        Args:
            chunk: Text chunk
            difficulty: Difficulty level
            questions: Questions to cache
        """
        try:
            cache_data = {
                "questions": [
                    q.model_dump(by_alias=True, mode="json")
                    for q in questions
                ],
                "chunk_hash": chunk.hash,
                "difficulty": difficulty.value,
            }
            
            self.cache.set_questions(chunk.text, difficulty.value, cache_data)
            
        except Exception as e:
            logger.warning(f"Cache save failed: {e}")
    
    async def close(self) -> None:
        """Close resources."""
        await self.llm_client.close()
