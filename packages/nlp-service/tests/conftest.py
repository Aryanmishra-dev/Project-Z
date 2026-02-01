"""
Pytest configuration and fixtures for NLP Service tests
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.config import Settings
from app.models.question import DifficultyLevel, GeneratedQuestion, QuestionOption
from app.models.pdf import TextChunk


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def mock_settings():
    """Create mock settings for testing."""
    return Settings(
        service_name="nlp-service-test",
        debug=True,
        log_level="DEBUG",
        ollama_base_url="http://localhost:11434",
        ollama_model="mistral:7b-instruct-q4_K_M",
        redis_host="localhost",
        redis_port=6379,
        chunk_size_words=800,
        chunk_overlap_words=200,
    )


@pytest.fixture
def sample_text():
    """Sample text for testing."""
    return """
    Mitochondria are membrane-bound organelles found in the cytoplasm of eukaryotic cells. 
    They are often referred to as the 'powerhouse of the cell' because they generate most of 
    the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy.
    
    The mitochondrion has a double membrane structure. The outer membrane is smooth and allows 
    small molecules to pass through. The inner membrane is highly folded into structures called 
    cristae, which increase the surface area for ATP production.
    
    Mitochondria contain their own DNA, known as mitochondrial DNA (mtDNA). This DNA is 
    inherited maternally and encodes some of the proteins needed for mitochondrial function.
    
    The process of ATP production in mitochondria is called cellular respiration. This involves 
    the breakdown of glucose and other nutrients in the presence of oxygen to produce ATP, 
    carbon dioxide, and water.
    """


@pytest.fixture
def long_sample_text():
    """Longer sample text for chunking tests."""
    base_text = """
    The human brain is one of the most complex organs in the known universe. It contains 
    approximately 86 billion neurons, each connected to thousands of other neurons through 
    synapses. This intricate network enables everything from basic survival functions to 
    abstract thinking and creativity.
    
    The brain is divided into several major regions, each responsible for different functions. 
    The cerebrum is the largest part and handles higher cognitive functions such as thinking, 
    learning, and memory. The cerebellum coordinates movement and balance. The brainstem 
    controls vital functions like breathing and heart rate.
    
    Neural plasticity, also known as neuroplasticity, refers to the brain's ability to change 
    and adapt throughout life. This includes forming new neural connections and strengthening 
    existing ones in response to learning and experience.
    """
    # Repeat to create longer text
    return base_text * 10


@pytest.fixture
def sample_question_data():
    """Sample question data as returned by LLM."""
    return {
        "questionText": "What is the primary function of mitochondria in a cell?",
        "options": [
            {"id": "A", "text": "Protein synthesis"},
            {"id": "B", "text": "ATP production"},
            {"id": "C", "text": "Cell division"},
            {"id": "D", "text": "DNA replication"},
        ],
        "correctAnswer": "B",
        "explanation": "Mitochondria are known as the powerhouse of the cell because they produce ATP through cellular respiration.",
        "difficulty": "easy",
    }


@pytest.fixture
def sample_generated_question():
    """Sample GeneratedQuestion object."""
    return GeneratedQuestion(
        question_text="What is the primary function of mitochondria?",
        options=[
            QuestionOption(id="A", text="Protein synthesis"),
            QuestionOption(id="B", text="ATP production"),
            QuestionOption(id="C", text="Cell division"),
            QuestionOption(id="D", text="DNA replication"),
        ],
        correct_answer="B",
        explanation="Mitochondria produce ATP through cellular respiration.",
        difficulty=DifficultyLevel.EASY,
        quality_score=0.85,
        validation_passed=True,
    )


@pytest.fixture
def sample_chunk():
    """Sample TextChunk object."""
    return TextChunk(
        id="chunk_0_abc12345",
        text="Sample chunk text for testing purposes.",
        word_count=7,
        char_count=40,
        start_index=0,
        end_index=40,
        chunk_index=0,
        overlap_start=False,
        overlap_end=False,
        hash="abc12345def67890",
    )


@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    mock = MagicMock()
    mock.ping.return_value = True
    mock.get.return_value = None
    mock.setex.return_value = True
    return mock


@pytest.fixture
def mock_llm_response():
    """Mock LLM response for question generation."""
    return {
        "response": {
            "questions": [
                {
                    "questionText": "What is the primary function of mitochondria?",
                    "options": [
                        {"id": "A", "text": "Protein synthesis"},
                        {"id": "B", "text": "ATP production"},
                        {"id": "C", "text": "Cell division"},
                        {"id": "D", "text": "DNA replication"},
                    ],
                    "correctAnswer": "B",
                    "explanation": "Mitochondria produce ATP through cellular respiration.",
                    "difficulty": "medium",
                }
            ]
        },
        "raw_response": '{"questions": [...]}',
        "model": "mistral:7b-instruct-q4_K_M",
        "elapsed_ms": 1500,
    }


@pytest.fixture
def mock_ollama_client(mock_llm_response):
    """Mock Ollama client."""
    mock = AsyncMock()
    mock.generate.return_value = mock_llm_response
    mock.generate_questions.return_value = mock_llm_response
    mock.check_health.return_value = {
        "healthy": True,
        "models": ["mistral:7b-instruct-q4_K_M"],
        "model_available": True,
    }
    mock.close = AsyncMock()
    return mock
