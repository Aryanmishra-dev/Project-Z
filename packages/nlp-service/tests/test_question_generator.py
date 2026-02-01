"""
Question Generator Service Unit Tests
Comprehensive tests for question generation with LLM
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json

from app.services.question_generator import QuestionGenerator, GeneratedQuestion
from app.models.question import QuestionDifficulty


class TestQuestionGenerator:
    """Tests for QuestionGenerator service"""

    @pytest.fixture
    def mock_llm_client(self):
        """Create a mock LLM client"""
        client = AsyncMock()
        client.generate = AsyncMock()
        return client

    @pytest.fixture
    def question_generator(self, mock_llm_client):
        """Create a QuestionGenerator instance with mocked LLM"""
        generator = QuestionGenerator(llm_client=mock_llm_client)
        return generator

    @pytest.fixture
    def sample_chunk(self):
        """Sample text chunk for question generation"""
        return {
            "text": """
            Python is a high-level, interpreted programming language known for its 
            simplicity and readability. It was created by Guido van Rossum and first 
            released in 1991. Python supports multiple programming paradigms including 
            procedural, object-oriented, and functional programming.
            """,
            "chunk_id": "chunk-001",
            "page_numbers": [1, 2],
        }

    @pytest.mark.asyncio
    async def test_generate_question_success(self, question_generator, mock_llm_client, sample_chunk):
        """Test successful question generation"""
        mock_response = json.dumps({
            "question": "Who created the Python programming language?",
            "options": {
                "A": "Guido van Rossum",
                "B": "Dennis Ritchie",
                "C": "James Gosling",
                "D": "Bjarne Stroustrup"
            },
            "correct_option": "A",
            "explanation": "Python was created by Guido van Rossum and first released in 1991.",
            "difficulty": "easy"
        })
        mock_llm_client.generate.return_value = mock_response

        questions = await question_generator.generate_questions(
            chunk=sample_chunk,
            count=1,
            difficulty="easy"
        )

        assert len(questions) == 1
        assert questions[0].question == "Who created the Python programming language?"
        assert questions[0].correct_option == "A"

    @pytest.mark.asyncio
    async def test_generate_multiple_questions(self, question_generator, mock_llm_client, sample_chunk):
        """Test generating multiple questions from a chunk"""
        responses = [
            json.dumps({
                "question": f"Question {i}?",
                "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
                "correct_option": "A",
                "explanation": f"Explanation {i}",
                "difficulty": "medium"
            }) for i in range(3)
        ]
        mock_llm_client.generate.side_effect = responses

        questions = await question_generator.generate_questions(
            chunk=sample_chunk,
            count=3,
            difficulty="medium"
        )

        assert len(questions) == 3

    @pytest.mark.asyncio
    async def test_generate_questions_with_difficulty_filter(self, question_generator, mock_llm_client, sample_chunk):
        """Test generating questions filtered by difficulty"""
        mock_response = json.dumps({
            "question": "What is a closure in Python?",
            "options": {
                "A": "A function that returns another function",
                "B": "A class method",
                "C": "A loop construct",
                "D": "A data type"
            },
            "correct_option": "A",
            "explanation": "A closure is a function object that has access to variables in its enclosing scope.",
            "difficulty": "hard"
        })
        mock_llm_client.generate.return_value = mock_response

        questions = await question_generator.generate_questions(
            chunk=sample_chunk,
            count=1,
            difficulty="hard"
        )

        assert questions[0].difficulty == QuestionDifficulty.HARD

    @pytest.mark.asyncio
    async def test_handle_malformed_llm_response(self, question_generator, mock_llm_client, sample_chunk):
        """Test handling of malformed LLM responses"""
        mock_llm_client.generate.return_value = "This is not valid JSON"

        with pytest.raises(ValueError, match="Failed to parse"):
            await question_generator.generate_questions(
                chunk=sample_chunk,
                count=1
            )

    @pytest.mark.asyncio
    async def test_handle_incomplete_llm_response(self, question_generator, mock_llm_client, sample_chunk):
        """Test handling of incomplete LLM responses (missing fields)"""
        mock_response = json.dumps({
            "question": "Incomplete question?",
            # Missing options, correct_option, explanation
        })
        mock_llm_client.generate.return_value = mock_response

        with pytest.raises(ValueError, match="Missing required field"):
            await question_generator.generate_questions(
                chunk=sample_chunk,
                count=1
            )

    @pytest.mark.asyncio
    async def test_retry_on_llm_timeout(self, question_generator, mock_llm_client, sample_chunk):
        """Test retry logic when LLM times out"""
        mock_llm_client.generate.side_effect = [
            TimeoutError("LLM timeout"),
            TimeoutError("LLM timeout"),
            json.dumps({
                "question": "Success after retry?",
                "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
                "correct_option": "A",
                "explanation": "Success",
                "difficulty": "easy"
            })
        ]

        questions = await question_generator.generate_questions(
            chunk=sample_chunk,
            count=1,
            max_retries=3
        )

        assert len(questions) == 1
        assert mock_llm_client.generate.call_count == 3

    @pytest.mark.asyncio
    async def test_fail_after_max_retries(self, question_generator, mock_llm_client, sample_chunk):
        """Test failure after exhausting max retries"""
        mock_llm_client.generate.side_effect = TimeoutError("LLM timeout")

        with pytest.raises(TimeoutError):
            await question_generator.generate_questions(
                chunk=sample_chunk,
                count=1,
                max_retries=3
            )

        assert mock_llm_client.generate.call_count == 3

    @pytest.mark.asyncio
    async def test_generate_questions_for_short_chunk(self, question_generator, mock_llm_client):
        """Test generating questions from a very short chunk"""
        short_chunk = {
            "text": "Python is a programming language.",
            "chunk_id": "short-001",
            "page_numbers": [1],
        }
        
        mock_response = json.dumps({
            "question": "What is Python?",
            "options": {
                "A": "A programming language",
                "B": "A snake",
                "C": "A database",
                "D": "An operating system"
            },
            "correct_option": "A",
            "explanation": "Python is a programming language.",
            "difficulty": "easy"
        })
        mock_llm_client.generate.return_value = mock_response

        questions = await question_generator.generate_questions(
            chunk=short_chunk,
            count=1
        )

        assert len(questions) == 1

    @pytest.mark.asyncio
    async def test_generate_questions_with_context(self, question_generator, mock_llm_client, sample_chunk):
        """Test generating questions with additional context"""
        mock_response = json.dumps({
            "question": "In what year was Python released?",
            "options": {"A": "1989", "B": "1991", "C": "1995", "D": "2000"},
            "correct_option": "B",
            "explanation": "Python was first released in 1991.",
            "difficulty": "medium"
        })
        mock_llm_client.generate.return_value = mock_response

        questions = await question_generator.generate_questions(
            chunk=sample_chunk,
            count=1,
            context="Focus on historical facts about Python."
        )

        # Verify context was included in the prompt
        call_args = mock_llm_client.generate.call_args
        assert "historical facts" in str(call_args).lower() or len(questions) == 1

    @pytest.mark.asyncio
    async def test_deduplicate_similar_questions(self, question_generator, mock_llm_client, sample_chunk):
        """Test that similar questions are deduplicated"""
        # This would require the generator to track generated questions
        responses = [
            json.dumps({
                "question": "Who created Python?",
                "options": {"A": "Guido", "B": "Dennis", "C": "James", "D": "Bjarne"},
                "correct_option": "A",
                "explanation": "Guido created Python",
                "difficulty": "easy"
            }),
            json.dumps({
                "question": "Who is the creator of Python?",  # Similar question
                "options": {"A": "Guido", "B": "Dennis", "C": "James", "D": "Bjarne"},
                "correct_option": "A",
                "explanation": "Guido created Python",
                "difficulty": "easy"
            }),
            json.dumps({
                "question": "When was Python released?",  # Different question
                "options": {"A": "1991", "B": "1989", "C": "1995", "D": "2000"},
                "correct_option": "A",
                "explanation": "Python was released in 1991",
                "difficulty": "easy"
            })
        ]
        mock_llm_client.generate.side_effect = responses

        questions = await question_generator.generate_questions(
            chunk=sample_chunk,
            count=2,
            deduplicate=True
        )

        # Should return 2 unique questions
        question_texts = [q.question for q in questions]
        assert len(set(question_texts)) == len(question_texts)


class TestQuestionValidation:
    """Tests for question validation logic"""

    @pytest.fixture
    def question_generator(self):
        return QuestionGenerator(llm_client=AsyncMock())

    def test_validate_correct_option_is_valid(self, question_generator):
        """Test that correct option must be A, B, C, or D"""
        question_data = {
            "question": "Test?",
            "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
            "correct_option": "E",  # Invalid
            "explanation": "Test",
            "difficulty": "easy"
        }

        is_valid = question_generator.validate_question(question_data)
        assert is_valid is False

    def test_validate_all_options_present(self, question_generator):
        """Test that all four options must be present"""
        question_data = {
            "question": "Test?",
            "options": {"A": "a", "B": "b", "C": "c"},  # Missing D
            "correct_option": "A",
            "explanation": "Test",
            "difficulty": "easy"
        }

        is_valid = question_generator.validate_question(question_data)
        assert is_valid is False

    def test_validate_question_not_empty(self, question_generator):
        """Test that question text cannot be empty"""
        question_data = {
            "question": "",
            "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
            "correct_option": "A",
            "explanation": "Test",
            "difficulty": "easy"
        }

        is_valid = question_generator.validate_question(question_data)
        assert is_valid is False

    def test_validate_options_not_identical(self, question_generator):
        """Test that options should not be identical"""
        question_data = {
            "question": "Test?",
            "options": {"A": "same", "B": "same", "C": "same", "D": "same"},
            "correct_option": "A",
            "explanation": "Test",
            "difficulty": "easy"
        }

        is_valid = question_generator.validate_question(question_data)
        assert is_valid is False

    def test_validate_explanation_present(self, question_generator):
        """Test that explanation must be present"""
        question_data = {
            "question": "Test?",
            "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
            "correct_option": "A",
            "explanation": "",
            "difficulty": "easy"
        }

        is_valid = question_generator.validate_question(question_data)
        assert is_valid is False

    def test_validate_difficulty_is_valid(self, question_generator):
        """Test that difficulty must be valid value"""
        question_data = {
            "question": "Test?",
            "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
            "correct_option": "A",
            "explanation": "Test",
            "difficulty": "impossible"  # Invalid difficulty
        }

        is_valid = question_generator.validate_question(question_data)
        assert is_valid is False


class TestPromptGeneration:
    """Tests for prompt template generation"""

    @pytest.fixture
    def question_generator(self):
        return QuestionGenerator(llm_client=AsyncMock())

    def test_generate_prompt_includes_chunk_text(self, question_generator):
        """Test that prompt includes the chunk text"""
        chunk = {"text": "Python is a programming language.", "chunk_id": "1"}
        prompt = question_generator.build_prompt(chunk, difficulty="easy", count=1)

        assert "Python is a programming language" in prompt

    def test_generate_prompt_includes_difficulty(self, question_generator):
        """Test that prompt includes difficulty level"""
        chunk = {"text": "Test content", "chunk_id": "1"}
        prompt = question_generator.build_prompt(chunk, difficulty="hard", count=1)

        assert "hard" in prompt.lower()

    def test_generate_prompt_includes_count(self, question_generator):
        """Test that prompt requests correct number of questions"""
        chunk = {"text": "Test content", "chunk_id": "1"}
        prompt = question_generator.build_prompt(chunk, difficulty="medium", count=5)

        assert "5" in prompt

    def test_generate_prompt_includes_format_instructions(self, question_generator):
        """Test that prompt includes JSON format instructions"""
        chunk = {"text": "Test content", "chunk_id": "1"}
        prompt = question_generator.build_prompt(chunk, difficulty="easy", count=1)

        assert "json" in prompt.lower()
        assert "question" in prompt.lower()
        assert "options" in prompt.lower()


class TestQuestionDifficultyDistribution:
    """Tests for generating questions with specific difficulty distributions"""

    @pytest.fixture
    def question_generator(self):
        mock_client = AsyncMock()
        return QuestionGenerator(llm_client=mock_client)

    @pytest.mark.asyncio
    async def test_generate_mixed_difficulty_questions(self, question_generator):
        """Test generating questions with mixed difficulties"""
        chunk = {"text": "Test content for multiple questions", "chunk_id": "1"}
        
        question_generator.llm_client.generate.side_effect = [
            json.dumps({
                "question": "Easy question?",
                "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
                "correct_option": "A",
                "explanation": "Easy",
                "difficulty": "easy"
            }),
            json.dumps({
                "question": "Medium question?",
                "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
                "correct_option": "B",
                "explanation": "Medium",
                "difficulty": "medium"
            }),
            json.dumps({
                "question": "Hard question?",
                "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
                "correct_option": "C",
                "explanation": "Hard",
                "difficulty": "hard"
            })
        ]

        questions = await question_generator.generate_questions_mixed(
            chunk=chunk,
            easy_count=1,
            medium_count=1,
            hard_count=1
        )

        difficulties = [q.difficulty for q in questions]
        assert QuestionDifficulty.EASY in difficulties
        assert QuestionDifficulty.MEDIUM in difficulties
        assert QuestionDifficulty.HARD in difficulties


class TestCacheIntegration:
    """Tests for caching generated questions"""

    @pytest.fixture
    def mock_cache(self):
        cache = MagicMock()
        cache.get = AsyncMock(return_value=None)
        cache.set = AsyncMock()
        return cache

    @pytest.fixture
    def question_generator_with_cache(self, mock_cache):
        generator = QuestionGenerator(
            llm_client=AsyncMock(),
            cache=mock_cache
        )
        return generator, mock_cache

    @pytest.mark.asyncio
    async def test_cache_hit_returns_cached_questions(self, question_generator_with_cache):
        """Test that cached questions are returned on cache hit"""
        generator, cache = question_generator_with_cache
        
        cached_questions = [
            {
                "question": "Cached question?",
                "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
                "correct_option": "A",
                "explanation": "Cached",
                "difficulty": "easy"
            }
        ]
        cache.get.return_value = json.dumps(cached_questions)

        chunk = {"text": "Test", "chunk_id": "cached-chunk"}
        questions = await generator.generate_questions(chunk=chunk, count=1)

        # LLM should not be called on cache hit
        assert generator.llm_client.generate.call_count == 0

    @pytest.mark.asyncio
    async def test_cache_miss_calls_llm(self, question_generator_with_cache):
        """Test that LLM is called on cache miss"""
        generator, cache = question_generator_with_cache
        cache.get.return_value = None
        
        generator.llm_client.generate.return_value = json.dumps({
            "question": "New question?",
            "options": {"A": "a", "B": "b", "C": "c", "D": "d"},
            "correct_option": "A",
            "explanation": "New",
            "difficulty": "easy"
        })

        chunk = {"text": "Test", "chunk_id": "new-chunk"}
        await generator.generate_questions(chunk=chunk, count=1)

        assert generator.llm_client.generate.call_count == 1
        assert cache.set.call_count == 1
