"""
Question Validation Service
Multi-stage validation with quality scoring for generated questions
"""
import re
from typing import Any

from app.config import settings
from app.utils.logger import logger
from app.models.question import (
    GeneratedQuestion,
    QuestionValidationResult,
    DifficultyLevel,
)


class QuestionValidator:
    """
    Validates generated questions through multiple stages.
    
    Validation Stages:
    1. Schema validation - Correct structure and required fields
    2. Length validation - Question and option text lengths
    3. Quality validation - Content quality checks
    4. Semantic validation - Logical consistency checks
    
    Produces quality score from 0.0 to 1.0
    """
    
    # Length constraints
    MIN_QUESTION_LENGTH = 10
    MAX_QUESTION_LENGTH = 500
    MIN_OPTION_LENGTH = 1
    MAX_OPTION_LENGTH = 200
    MIN_EXPLANATION_LENGTH = 20
    MAX_EXPLANATION_LENGTH = 500
    
    # Quality scoring weights
    WEIGHTS = {
        "schema": 0.20,
        "length": 0.20,
        "quality": 0.35,
        "semantic": 0.25,
    }
    
    def __init__(self):
        """Initialize the validator."""
        self.min_quality_score = settings.min_quality_score
        self.auto_approve_score = settings.auto_approve_score
    
    def validate(
        self,
        question_data: dict[str, Any],
        difficulty: DifficultyLevel | None = None,
        source_text: str | None = None,
    ) -> tuple[QuestionValidationResult, GeneratedQuestion | None]:
        """
        Validate a question through all stages.
        
        Args:
            question_data: Raw question data from LLM
            difficulty: Expected difficulty level
            source_text: Original text for semantic validation
            
        Returns:
            Tuple of (validation_result, validated_question or None)
        """
        issues: list[str] = []
        stage_results: dict[str, bool] = {}
        stage_scores: dict[str, float] = {}
        metrics: dict[str, Any] = {}
        
        # Stage 1: Schema Validation
        schema_valid, schema_issues, schema_score = self._validate_schema(question_data)
        stage_results["schema"] = schema_valid
        stage_scores["schema"] = schema_score
        issues.extend(schema_issues)
        
        if not schema_valid:
            # Can't proceed without valid schema
            return QuestionValidationResult(
                is_valid=False,
                quality_score=0.0,
                stage_results=stage_results,
                issues=issues,
                metrics={"stage_scores": stage_scores},
            ), None
        
        # Stage 2: Length Validation
        length_valid, length_issues, length_score, length_metrics = self._validate_lengths(question_data)
        stage_results["length"] = length_valid
        stage_scores["length"] = length_score
        issues.extend(length_issues)
        metrics["length"] = length_metrics
        
        # Stage 3: Quality Validation
        quality_valid, quality_issues, quality_score, quality_metrics = self._validate_quality(question_data)
        stage_results["quality"] = quality_valid
        stage_scores["quality"] = quality_score
        issues.extend(quality_issues)
        metrics["quality"] = quality_metrics
        
        # Stage 4: Semantic Validation
        semantic_valid, semantic_issues, semantic_score, semantic_metrics = self._validate_semantic(
            question_data, source_text
        )
        stage_results["semantic"] = semantic_valid
        stage_scores["semantic"] = semantic_score
        issues.extend(semantic_issues)
        metrics["semantic"] = semantic_metrics
        
        # Calculate overall quality score
        overall_score = sum(
            stage_scores[stage] * self.WEIGHTS[stage]
            for stage in self.WEIGHTS
        )
        
        metrics["stage_scores"] = stage_scores
        
        # Determine if valid
        is_valid = overall_score >= self.min_quality_score and all([
            schema_valid,
            length_valid or length_score >= 0.5,  # Allow some length flexibility
        ])
        
        # Create validated question if valid
        validated_question = None
        if schema_valid:
            try:
                # Set the difficulty from input or question data
                q_difficulty = difficulty or DifficultyLevel(question_data.get("difficulty", "medium"))
                
                validated_question = GeneratedQuestion(
                    question_text=question_data["questionText"],
                    options=[
                        {"id": opt["id"], "text": opt["text"]}
                        for opt in question_data["options"]
                    ],
                    correct_answer=question_data["correctAnswer"],
                    explanation=question_data["explanation"],
                    difficulty=q_difficulty,
                    quality_score=overall_score,
                    validation_passed=is_valid,
                )
            except Exception as e:
                logger.warning(f"Failed to create validated question: {e}")
                is_valid = False
                issues.append(f"Model creation failed: {e}")
        
        logger.debug(
            "Question validation completed",
            data={
                "is_valid": is_valid,
                "quality_score": round(overall_score, 3),
                "stage_results": stage_results,
                "issue_count": len(issues),
            }
        )
        
        return QuestionValidationResult(
            is_valid=is_valid,
            quality_score=overall_score,
            stage_results=stage_results,
            issues=issues,
            metrics=metrics,
        ), validated_question
    
    def _validate_schema(self, data: dict[str, Any]) -> tuple[bool, list[str], float]:
        """
        Validate question schema.
        
        Returns:
            Tuple of (is_valid, issues, score)
        """
        issues: list[str] = []
        score = 1.0
        
        # Check required fields
        required_fields = ["questionText", "options", "correctAnswer", "explanation"]
        for field in required_fields:
            if field not in data:
                issues.append(f"Missing required field: {field}")
                score -= 0.25
        
        if score < 0.5:
            return False, issues, max(0, score)
        
        # Validate options structure
        options = data.get("options", [])
        if not isinstance(options, list):
            issues.append("Options must be a list")
            return False, issues, 0.0
        
        if len(options) != 4:
            issues.append(f"Expected 4 options, got {len(options)}")
            score -= 0.2
        
        # Check option structure
        option_ids = set()
        for i, opt in enumerate(options):
            if not isinstance(opt, dict):
                issues.append(f"Option {i} is not a dict")
                score -= 0.1
                continue
            
            if "id" not in opt:
                issues.append(f"Option {i} missing 'id'")
                score -= 0.05
            else:
                option_ids.add(opt["id"])
            
            if "text" not in opt:
                issues.append(f"Option {i} missing 'text'")
                score -= 0.05
        
        # Check for A, B, C, D
        expected_ids = {"A", "B", "C", "D"}
        if option_ids != expected_ids:
            missing = expected_ids - option_ids
            extra = option_ids - expected_ids
            if missing:
                issues.append(f"Missing option IDs: {missing}")
            if extra:
                issues.append(f"Unexpected option IDs: {extra}")
            score -= 0.1
        
        # Validate correct answer
        correct = data.get("correctAnswer", "")
        if correct not in expected_ids:
            issues.append(f"Invalid correct answer: {correct}")
            score -= 0.2
        
        is_valid = score >= 0.5 and len([i for i in issues if "Missing required" in i]) == 0
        return is_valid, issues, max(0, score)
    
    def _validate_lengths(self, data: dict[str, Any]) -> tuple[bool, list[str], float, dict]:
        """
        Validate text lengths.
        
        Returns:
            Tuple of (is_valid, issues, score, metrics)
        """
        issues: list[str] = []
        score = 1.0
        metrics: dict[str, Any] = {}
        
        # Question length
        question_text = data.get("questionText", "")
        q_len = len(question_text)
        metrics["question_length"] = q_len
        
        if q_len < self.MIN_QUESTION_LENGTH:
            issues.append(f"Question too short ({q_len} chars, min {self.MIN_QUESTION_LENGTH})")
            score -= 0.3
        elif q_len > self.MAX_QUESTION_LENGTH:
            issues.append(f"Question too long ({q_len} chars, max {self.MAX_QUESTION_LENGTH})")
            score -= 0.1
        
        # Option lengths
        options = data.get("options", [])
        option_lengths: list[int] = []
        
        for opt in options:
            if isinstance(opt, dict) and "text" in opt:
                opt_len = len(opt["text"])
                option_lengths.append(opt_len)
                
                if opt_len < self.MIN_OPTION_LENGTH:
                    issues.append(f"Option {opt.get('id', '?')} too short")
                    score -= 0.1
                elif opt_len > self.MAX_OPTION_LENGTH:
                    issues.append(f"Option {opt.get('id', '?')} too long")
                    score -= 0.05
        
        metrics["option_lengths"] = option_lengths
        
        # Check option length variance (should be similar)
        if option_lengths:
            avg_len = sum(option_lengths) / len(option_lengths)
            variance = sum((l - avg_len) ** 2 for l in option_lengths) / len(option_lengths)
            metrics["option_length_variance"] = variance
            
            # High variance suggests obvious answer (short correct, long distractors)
            if variance > 2000:  # Threshold for high variance
                issues.append("Large variance in option lengths (may reveal answer)")
                score -= 0.1
        
        # Explanation length
        explanation = data.get("explanation", "")
        exp_len = len(explanation)
        metrics["explanation_length"] = exp_len
        
        if exp_len < self.MIN_EXPLANATION_LENGTH:
            issues.append(f"Explanation too short ({exp_len} chars)")
            score -= 0.2
        elif exp_len > self.MAX_EXPLANATION_LENGTH:
            # Just a warning, not a hard failure
            pass
        
        is_valid = score >= 0.6
        return is_valid, issues, max(0, score), metrics
    
    def _validate_quality(self, data: dict[str, Any]) -> tuple[bool, list[str], float, dict]:
        """
        Validate content quality.
        
        Returns:
            Tuple of (is_valid, issues, score, metrics)
        """
        issues: list[str] = []
        score = 1.0
        metrics: dict[str, Any] = {}
        
        question_text = data.get("questionText", "").lower()
        options = data.get("options", [])
        explanation = data.get("explanation", "").lower()
        
        # Check for question quality markers
        # Questions should end with ?
        if not data.get("questionText", "").strip().endswith("?"):
            issues.append("Question should end with '?'")
            score -= 0.1
        
        # Check for "all/none of the above" patterns
        for opt in options:
            opt_text = opt.get("text", "").lower() if isinstance(opt, dict) else ""
            if "all of the above" in opt_text or "none of the above" in opt_text:
                issues.append("Avoid 'all/none of the above' options")
                score -= 0.15
                break
        
        # Check for negative phrasing
        negative_patterns = [
            r"\bnot\b",
            r"\bexcept\b",
            r"\bnever\b",
            r"\bnone\b",
        ]
        for pattern in negative_patterns:
            if re.search(pattern, question_text):
                issues.append("Consider avoiding negative phrasing in questions")
                score -= 0.05
                metrics["has_negative_phrasing"] = True
                break
        
        # Check for duplicate options
        option_texts = [
            opt.get("text", "").lower().strip()
            for opt in options
            if isinstance(opt, dict)
        ]
        if len(option_texts) != len(set(option_texts)):
            issues.append("Duplicate options detected")
            score -= 0.3
            metrics["has_duplicates"] = True
        
        # Check explanation references correct answer
        correct_answer = data.get("correctAnswer", "")
        if correct_answer:
            correct_option = next(
                (opt for opt in options if isinstance(opt, dict) and opt.get("id") == correct_answer),
                None
            )
            if correct_option:
                correct_text = correct_option.get("text", "").lower()
                # Check if explanation mentions something from correct answer
                words_in_common = set(correct_text.split()) & set(explanation.split())
                meaningful_words = [w for w in words_in_common if len(w) > 3]
                if len(meaningful_words) < 1:
                    issues.append("Explanation may not clearly relate to correct answer")
                    score -= 0.1
        
        metrics["quality_score"] = score
        is_valid = score >= 0.5
        return is_valid, issues, max(0, score), metrics
    
    def _validate_semantic(
        self,
        data: dict[str, Any],
        source_text: str | None
    ) -> tuple[bool, list[str], float, dict]:
        """
        Validate semantic consistency.
        
        Returns:
            Tuple of (is_valid, issues, score, metrics)
        """
        issues: list[str] = []
        score = 1.0
        metrics: dict[str, Any] = {}
        
        # If no source text, skip detailed semantic validation
        if not source_text:
            return True, issues, score, metrics
        
        source_lower = source_text.lower()
        question_text = data.get("questionText", "")
        
        # Extract key terms from question
        question_words = set(
            word.lower() for word in re.findall(r'\b\w{4,}\b', question_text)
        )
        
        # Check if question terms appear in source
        terms_in_source = sum(1 for word in question_words if word in source_lower)
        term_coverage = terms_in_source / len(question_words) if question_words else 0
        
        metrics["term_coverage"] = term_coverage
        metrics["question_terms"] = len(question_words)
        metrics["terms_found"] = terms_in_source
        
        if term_coverage < 0.3:
            issues.append("Question may not be well-grounded in source text")
            score -= 0.2
        
        # Check correct answer plausibility
        correct_answer = data.get("correctAnswer", "")
        correct_option = next(
            (opt for opt in data.get("options", [])
             if isinstance(opt, dict) and opt.get("id") == correct_answer),
            None
        )
        
        if correct_option:
            correct_text = correct_option.get("text", "").lower()
            correct_words = set(
                word for word in re.findall(r'\b\w{4,}\b', correct_text)
            )
            
            correct_terms_in_source = sum(1 for word in correct_words if word in source_lower)
            correct_coverage = correct_terms_in_source / len(correct_words) if correct_words else 0
            
            metrics["correct_answer_coverage"] = correct_coverage
            
            if correct_coverage < 0.2:
                issues.append("Correct answer may not be supported by source text")
                score -= 0.15
        
        is_valid = score >= 0.5
        return is_valid, issues, max(0, score), metrics
    
    def batch_validate(
        self,
        questions_data: list[dict[str, Any]],
        difficulty: DifficultyLevel | None = None,
        source_text: str | None = None,
    ) -> list[tuple[QuestionValidationResult, GeneratedQuestion | None]]:
        """
        Validate multiple questions.
        
        Args:
            questions_data: List of raw question data
            difficulty: Expected difficulty level
            source_text: Original text for semantic validation
            
        Returns:
            List of validation results
        """
        return [
            self.validate(q, difficulty, source_text)
            for q in questions_data
        ]
