"""
Tests for Question Validator service
"""
import pytest

from app.services.question_validator import QuestionValidator
from app.models.question import DifficultyLevel


class TestQuestionValidator:
    """Tests for QuestionValidator class."""
    
    @pytest.fixture
    def validator(self):
        """Create a validator instance."""
        return QuestionValidator()
    
    def test_init_loads_settings(self, validator):
        """Test validator initializes with settings."""
        assert validator.min_quality_score > 0
        assert validator.auto_approve_score > validator.min_quality_score
    
    def test_validate_valid_question(self, validator, sample_question_data):
        """Test validation of a valid question."""
        result, question = validator.validate(sample_question_data)
        
        assert result.is_valid is True
        assert result.quality_score > 0
        assert question is not None
        assert question.question_text == sample_question_data["questionText"]
    
    def test_validate_missing_required_field(self, validator):
        """Test validation fails for missing required fields."""
        # Missing questionText
        data = {
            "options": [
                {"id": "A", "text": "Option A"},
                {"id": "B", "text": "Option B"},
                {"id": "C", "text": "Option C"},
                {"id": "D", "text": "Option D"},
            ],
            "correctAnswer": "A",
            "explanation": "This is the explanation.",
        }
        
        result, question = validator.validate(data)
        
        assert result.is_valid is False
        assert result.stage_results["schema"] is False
        assert any("Missing required field" in issue for issue in result.issues)
    
    def test_validate_wrong_option_count(self, validator):
        """Test validation fails for wrong number of options."""
        data = {
            "questionText": "What is the answer?",
            "options": [
                {"id": "A", "text": "Option A"},
                {"id": "B", "text": "Option B"},
                {"id": "C", "text": "Option C"},
                # Missing option D
            ],
            "correctAnswer": "A",
            "explanation": "This is the explanation for the correct answer.",
        }
        
        result, question = validator.validate(data)
        
        assert any("Expected 4 options" in issue for issue in result.issues)
    
    def test_validate_invalid_correct_answer(self, validator):
        """Test validation fails for invalid correct answer."""
        data = {
            "questionText": "What is the answer to this question?",
            "options": [
                {"id": "A", "text": "Option A"},
                {"id": "B", "text": "Option B"},
                {"id": "C", "text": "Option C"},
                {"id": "D", "text": "Option D"},
            ],
            "correctAnswer": "E",  # Invalid
            "explanation": "This is the explanation for the answer.",
        }
        
        result, question = validator.validate(data)
        
        assert any("Invalid correct answer" in issue for issue in result.issues)
    
    def test_validate_question_too_short(self, validator):
        """Test validation flags short questions."""
        data = {
            "questionText": "Short?",  # Too short
            "options": [
                {"id": "A", "text": "Option A"},
                {"id": "B", "text": "Option B"},
                {"id": "C", "text": "Option C"},
                {"id": "D", "text": "Option D"},
            ],
            "correctAnswer": "A",
            "explanation": "This is a valid explanation.",
        }
        
        result, question = validator.validate(data)
        
        assert any("too short" in issue.lower() for issue in result.issues)
    
    def test_validate_explanation_too_short(self, validator):
        """Test validation flags short explanations."""
        data = {
            "questionText": "What is the answer to this question?",
            "options": [
                {"id": "A", "text": "Option A"},
                {"id": "B", "text": "Option B"},
                {"id": "C", "text": "Option C"},
                {"id": "D", "text": "Option D"},
            ],
            "correctAnswer": "A",
            "explanation": "Short",  # Too short
        }
        
        result, question = validator.validate(data)
        
        assert any("explanation" in issue.lower() and "short" in issue.lower() 
                   for issue in result.issues)
    
    def test_validate_duplicate_options(self, validator):
        """Test validation detects duplicate options."""
        data = {
            "questionText": "What is the answer to this question?",
            "options": [
                {"id": "A", "text": "Same option text"},
                {"id": "B", "text": "Same option text"},  # Duplicate
                {"id": "C", "text": "Different option"},
                {"id": "D", "text": "Another option"},
            ],
            "correctAnswer": "A",
            "explanation": "This is the explanation for the answer.",
        }
        
        result, question = validator.validate(data)
        
        assert any("duplicate" in issue.lower() for issue in result.issues)
    
    def test_validate_all_none_of_above(self, validator):
        """Test validation flags 'all/none of the above' options."""
        data = {
            "questionText": "What is the answer to this question?",
            "options": [
                {"id": "A", "text": "Option A"},
                {"id": "B", "text": "Option B"},
                {"id": "C", "text": "Option C"},
                {"id": "D", "text": "All of the above"},
            ],
            "correctAnswer": "A",
            "explanation": "This is the explanation for why A is correct.",
        }
        
        result, question = validator.validate(data)
        
        assert any("all/none of the above" in issue.lower() for issue in result.issues)
    
    def test_validate_question_not_ending_with_question_mark(self, validator):
        """Test validation flags questions without question mark."""
        data = {
            "questionText": "This is a statement not a question",
            "options": [
                {"id": "A", "text": "Option A"},
                {"id": "B", "text": "Option B"},
                {"id": "C", "text": "Option C"},
                {"id": "D", "text": "Option D"},
            ],
            "correctAnswer": "A",
            "explanation": "This is the explanation for why the answer is A.",
        }
        
        result, question = validator.validate(data)
        
        assert any("?" in issue for issue in result.issues)
    
    def test_validate_with_source_text(self, validator, sample_question_data, sample_text):
        """Test validation with source text for semantic checks."""
        result, question = validator.validate(
            sample_question_data,
            source_text=sample_text,
        )
        
        assert "semantic" in result.stage_results
        assert "term_coverage" in result.metrics.get("semantic", {})
    
    def test_validate_sets_difficulty(self, validator, sample_question_data):
        """Test that difficulty is set correctly."""
        result, question = validator.validate(
            sample_question_data,
            difficulty=DifficultyLevel.HARD,
        )
        
        if question:
            assert question.difficulty == DifficultyLevel.HARD
    
    def test_batch_validate(self, validator, sample_question_data):
        """Test batch validation of multiple questions."""
        questions = [sample_question_data, sample_question_data]
        
        results = validator.batch_validate(questions)
        
        assert len(results) == 2
        assert all(isinstance(r[0].is_valid, bool) for r in results)
    
    def test_quality_score_range(self, validator, sample_question_data):
        """Test that quality score is within valid range."""
        result, question = validator.validate(sample_question_data)
        
        assert 0.0 <= result.quality_score <= 1.0
    
    def test_stage_results_present(self, validator, sample_question_data):
        """Test that all validation stages are present in results."""
        result, question = validator.validate(sample_question_data)
        
        expected_stages = ["schema", "length", "quality", "semantic"]
        for stage in expected_stages:
            assert stage in result.stage_results


class TestValidationSchemaStage:
    """Tests specifically for schema validation stage."""
    
    @pytest.fixture
    def validator(self):
        return QuestionValidator()
    
    def test_schema_valid(self, validator, sample_question_data):
        """Test schema validation passes for valid data."""
        is_valid, issues, score = validator._validate_schema(sample_question_data)
        
        assert is_valid is True
        assert score > 0.5
        assert len(issues) == 0
    
    def test_schema_missing_all_fields(self, validator):
        """Test schema validation fails for empty data."""
        is_valid, issues, score = validator._validate_schema({})
        
        assert is_valid is False
        assert score < 0.5
        assert len(issues) == 4  # All 4 required fields missing
    
    def test_schema_wrong_option_ids(self, validator):
        """Test schema validation catches wrong option IDs."""
        data = {
            "questionText": "Question?",
            "options": [
                {"id": "1", "text": "Option 1"},
                {"id": "2", "text": "Option 2"},
                {"id": "3", "text": "Option 3"},
                {"id": "4", "text": "Option 4"},
            ],
            "correctAnswer": "1",
            "explanation": "Explanation",
        }
        
        is_valid, issues, score = validator._validate_schema(data)
        
        assert any("option IDs" in issue.lower() for issue in issues)
