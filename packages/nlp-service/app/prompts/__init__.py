"""
Prompt templates for question generation
Provides system and user prompts for different difficulty levels
"""
from app.models.question import DifficultyLevel


SYSTEM_PROMPT = """You are an expert educational content creator specializing in creating high-quality multiple choice questions (MCQs) for learning assessments.

Your task is to generate clear, pedagogically sound questions that test understanding rather than mere recall.

Guidelines for question creation:
1. Questions should be clear, unambiguous, and grammatically correct
2. All answer options should be plausible and similar in length
3. The correct answer must be definitively correct based on the source text
4. Distractors (wrong answers) should represent common misconceptions or partial understanding
5. Explanations should teach the concept, not just state why an answer is correct
6. Avoid "all of the above" or "none of the above" options
7. Avoid negative phrasing like "which is NOT" when possible

You must respond with valid JSON only, no additional text."""


DIFFICULTY_PROMPTS = {
    DifficultyLevel.EASY: """Generate {count} EASY difficulty multiple choice questions from the following text.

EASY questions should:
- Test basic recall and recognition of key facts
- Have clearly distinct answer options
- Use straightforward, simple language
- Focus on main ideas and explicit information
- Be answerable by someone with basic familiarity with the topic

Output Format (respond with ONLY this JSON structure):
{{
    "questions": [
        {{
            "questionText": "Clear question testing basic understanding?",
            "options": [
                {{"id": "A", "text": "First option"}},
                {{"id": "B", "text": "Second option"}},
                {{"id": "C", "text": "Third option"}},
                {{"id": "D", "text": "Fourth option"}}
            ],
            "correctAnswer": "B",
            "explanation": "Explanation of why B is correct and helps reinforce learning",
            "difficulty": "easy"
        }}
    ]
}}""",
    
    DifficultyLevel.MEDIUM: """Generate {count} MEDIUM difficulty multiple choice questions from the following text.

MEDIUM questions should:
- Test comprehension and application of concepts
- Require understanding relationships between ideas
- Have options that require careful consideration
- May involve applying knowledge to scenarios
- Test understanding beyond surface-level facts

Output Format (respond with ONLY this JSON structure):
{{
    "questions": [
        {{
            "questionText": "Question requiring deeper understanding?",
            "options": [
                {{"id": "A", "text": "First option"}},
                {{"id": "B", "text": "Second option"}},
                {{"id": "C", "text": "Third option"}},
                {{"id": "D", "text": "Fourth option"}}
            ],
            "correctAnswer": "C",
            "explanation": "Explanation connecting concepts and deepening understanding",
            "difficulty": "medium"
        }}
    ]
}}""",
    
    DifficultyLevel.HARD: """Generate {count} HARD difficulty multiple choice questions from the following text.

HARD questions should:
- Test analysis, synthesis, and evaluation skills
- Require integrating multiple concepts
- Have nuanced options that require critical thinking
- May present scenarios requiring application of principles
- Test ability to make inferences and draw conclusions
- Challenge even those with good understanding of the topic

Output Format (respond with ONLY this JSON structure):
{{
    "questions": [
        {{
            "questionText": "Complex question requiring analysis and synthesis?",
            "options": [
                {{"id": "A", "text": "First option"}},
                {{"id": "B", "text": "Second option"}},
                {{"id": "C", "text": "Third option"}},
                {{"id": "D", "text": "Fourth option"}}
            ],
            "correctAnswer": "A",
            "explanation": "Detailed explanation of the reasoning and analysis required",
            "difficulty": "hard"
        }}
    ]
}}""",
}


def get_system_prompt() -> str:
    """Get the system prompt for question generation."""
    return SYSTEM_PROMPT


def get_user_prompt(difficulty: DifficultyLevel, count: int = 3) -> str:
    """
    Get the user prompt for a specific difficulty level.
    
    Args:
        difficulty: Question difficulty level
        count: Number of questions to generate
        
    Returns:
        Formatted user prompt
    """
    template = DIFFICULTY_PROMPTS.get(difficulty, DIFFICULTY_PROMPTS[DifficultyLevel.MEDIUM])
    return template.format(count=count)


def get_full_prompt(
    text: str,
    difficulty: DifficultyLevel,
    count: int = 3
) -> tuple[str, str]:
    """
    Get both system and user prompts for question generation.
    
    Args:
        text: Text to generate questions from
        difficulty: Question difficulty level
        count: Number of questions to generate
        
    Returns:
        Tuple of (system_prompt, user_prompt)
    """
    system = get_system_prompt()
    user = get_user_prompt(difficulty, count)
    return system, user
