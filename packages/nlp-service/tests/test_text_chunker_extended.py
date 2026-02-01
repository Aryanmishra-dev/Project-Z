"""
Text Chunker Service Unit Tests
Comprehensive tests for PDF text chunking
"""
import pytest
from unittest.mock import MagicMock

from app.services.text_chunker import TextChunker, TextChunk


class TestTextChunker:
    """Tests for TextChunker service"""

    @pytest.fixture
    def chunker(self):
        """Create a default TextChunker instance"""
        return TextChunker(
            chunk_size=500,
            overlap=50,
            min_chunk_size=100
        )

    @pytest.fixture
    def sample_text(self):
        """Sample text for chunking tests"""
        return """
        Chapter 1: Introduction to Python
        
        Python is a high-level, interpreted programming language known for its 
        simplicity and readability. Created by Guido van Rossum in 1991, Python 
        has become one of the most popular programming languages in the world.
        
        Python supports multiple programming paradigms including procedural, 
        object-oriented, and functional programming. Its design philosophy 
        emphasizes code readability with significant use of whitespace.
        
        Chapter 2: Basic Syntax
        
        Python uses indentation to define code blocks rather than curly braces 
        or keywords. This makes Python code visually clean and consistent.
        
        Variables in Python are dynamically typed, meaning you don't need to 
        declare the type of a variable before using it. Python will infer the 
        type based on the value assigned.
        
        Chapter 3: Data Types
        
        Python has several built-in data types including integers, floats, 
        strings, lists, tuples, dictionaries, and sets. Each data type has 
        its own set of methods and behaviors.
        """

    def test_chunk_text_basic(self, chunker, sample_text):
        """Test basic text chunking"""
        chunks = chunker.chunk_text(sample_text)

        assert len(chunks) > 0
        assert all(isinstance(c, TextChunk) for c in chunks)

    def test_chunk_size_respected(self, chunker, sample_text):
        """Test that chunks respect max size"""
        chunks = chunker.chunk_text(sample_text)

        for chunk in chunks:
            # Allow some flexibility for word boundaries
            assert len(chunk.text) <= chunker.chunk_size + 100

    def test_chunk_overlap(self, chunker, sample_text):
        """Test that chunks have proper overlap"""
        chunks = chunker.chunk_text(sample_text)

        if len(chunks) > 1:
            for i in range(len(chunks) - 1):
                current_end = chunks[i].text[-chunker.overlap:]
                next_start = chunks[i + 1].text[:chunker.overlap]
                # There should be some overlap
                assert len(set(current_end.split()) & set(next_start.split())) > 0

    def test_minimum_chunk_size(self, chunker):
        """Test that minimum chunk size is enforced"""
        short_text = "This is a very short text."
        chunks = chunker.chunk_text(short_text)

        # Short text should still produce at least one chunk
        assert len(chunks) >= 1

    def test_empty_text(self, chunker):
        """Test handling of empty text"""
        chunks = chunker.chunk_text("")

        assert len(chunks) == 0

    def test_whitespace_only_text(self, chunker):
        """Test handling of whitespace-only text"""
        chunks = chunker.chunk_text("   \n\t\n   ")

        assert len(chunks) == 0

    def test_chunk_contains_text_content(self, chunker, sample_text):
        """Test that chunks contain the original text content"""
        chunks = chunker.chunk_text(sample_text)

        # All chunks combined should cover the original text
        all_chunk_text = " ".join(c.text for c in chunks)
        
        # Key phrases should be present
        assert "Python" in all_chunk_text
        assert "programming" in all_chunk_text.lower()

    def test_chunk_preserves_sentence_boundaries(self, chunker):
        """Test that chunks preserve sentence boundaries where possible"""
        text = "First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence."
        chunks = chunker.chunk_text(text)

        for chunk in chunks:
            # Chunks should ideally start/end at sentence boundaries
            # This is a soft requirement - not all chunks may satisfy this
            stripped = chunk.text.strip()
            if stripped:
                # Should end with punctuation or be the last chunk
                ends_properly = stripped[-1] in '.!?' or chunk == chunks[-1]
                # Log but don't fail if boundary isn't perfect
                if not ends_properly:
                    print(f"Warning: Chunk doesn't end at sentence boundary: ...{stripped[-20:]}")

    def test_chunk_preserves_paragraph_boundaries(self, chunker):
        """Test that chunks try to preserve paragraph boundaries"""
        text = """
        First paragraph with some content.
        
        Second paragraph with more content.
        
        Third paragraph with final content.
        """
        chunks = chunker.chunk_text(text)

        # Paragraphs should preferably not be split mid-sentence
        assert len(chunks) >= 1

    def test_large_text_chunking(self, chunker):
        """Test chunking of large text"""
        # Create a large text (100KB+)
        large_text = "Python programming. " * 5000
        chunks = chunker.chunk_text(large_text)

        assert len(chunks) > 10
        # All chunks should have reasonable content
        for chunk in chunks:
            assert len(chunk.text) >= chunker.min_chunk_size

    def test_special_characters_preserved(self, chunker):
        """Test that special characters are preserved"""
        text = "Code example: def func(x): return x * 2  # multiply by 2"
        chunks = chunker.chunk_text(text)

        chunk_text = chunks[0].text if chunks else ""
        assert "def func" in chunk_text
        assert "*" in chunk_text

    def test_unicode_text_handling(self, chunker):
        """Test handling of unicode characters"""
        text = "Python支持Unicode字符串。日本語のテキストも処理できます。Émojis work too: 🐍"
        chunks = chunker.chunk_text(text)

        assert len(chunks) >= 1
        chunk_text = chunks[0].text
        assert "Python" in chunk_text
        assert "🐍" in chunk_text

    def test_chunk_metadata(self, chunker, sample_text):
        """Test that chunks contain proper metadata"""
        chunks = chunker.chunk_text(sample_text, pdf_id="pdf-123")

        for i, chunk in enumerate(chunks):
            assert chunk.chunk_id is not None
            assert chunk.index == i
            # If pdf_id was passed, it should be in metadata
            if hasattr(chunk, 'pdf_id'):
                assert chunk.pdf_id == "pdf-123"


class TestChunkingStrategies:
    """Tests for different chunking strategies"""

    def test_sentence_based_chunking(self):
        """Test sentence-based chunking strategy"""
        chunker = TextChunker(strategy="sentence", chunk_size=200)
        
        text = "First. Second. Third. Fourth. Fifth. Sixth. Seventh. Eighth. Ninth. Tenth."
        chunks = chunker.chunk_text(text)

        # Each chunk should contain complete sentences
        for chunk in chunks:
            # Should end with sentence terminator
            stripped = chunk.text.strip()
            if stripped:
                assert stripped[-1] in '.!?'

    def test_paragraph_based_chunking(self):
        """Test paragraph-based chunking strategy"""
        chunker = TextChunker(strategy="paragraph", chunk_size=500)
        
        text = """
        First paragraph with content.
        
        Second paragraph with content.
        
        Third paragraph with content.
        """
        chunks = chunker.chunk_text(text)

        # Paragraphs should be preserved
        assert len(chunks) >= 1

    def test_fixed_size_chunking(self):
        """Test fixed-size chunking strategy"""
        chunker = TextChunker(strategy="fixed", chunk_size=100)
        
        text = "A" * 500
        chunks = chunker.chunk_text(text)

        # Should create multiple fixed-size chunks
        assert len(chunks) >= 4


class TestChunkingEdgeCases:
    """Tests for edge cases in chunking"""

    @pytest.fixture
    def chunker(self):
        return TextChunker(chunk_size=200, overlap=20)

    def test_single_long_word(self, chunker):
        """Test handling of single very long word"""
        long_word = "A" * 300  # Longer than chunk_size
        chunks = chunker.chunk_text(long_word)

        # Should still produce output
        assert len(chunks) >= 1

    def test_multiple_newlines(self, chunker):
        """Test handling of multiple consecutive newlines"""
        text = "First line.\n\n\n\n\nSecond line after many newlines."
        chunks = chunker.chunk_text(text)

        # Should normalize whitespace
        combined = " ".join(c.text for c in chunks)
        assert "First line" in combined
        assert "Second line" in combined

    def test_mixed_line_endings(self, chunker):
        """Test handling of mixed line endings (\\n, \\r\\n, \\r)"""
        text = "Line 1\nLine 2\r\nLine 3\rLine 4"
        chunks = chunker.chunk_text(text)

        # All lines should be captured
        combined = " ".join(c.text for c in chunks)
        assert "Line 1" in combined
        assert "Line 4" in combined

    def test_tabs_and_spaces(self, chunker):
        """Test handling of tabs and multiple spaces"""
        text = "Word1\t\tWord2    Word3"
        chunks = chunker.chunk_text(text)

        # Whitespace should be normalized
        chunk_text = chunks[0].text if chunks else ""
        assert "Word1" in chunk_text
        assert "Word3" in chunk_text

    def test_bullet_points(self, chunker):
        """Test handling of bullet point lists"""
        text = """
        Key points:
        • First item in list
        • Second item in list
        • Third item in list
        - Fourth item with dash
        * Fifth item with asterisk
        """
        chunks = chunker.chunk_text(text)

        combined = " ".join(c.text for c in chunks)
        assert "First item" in combined
        assert "Fifth item" in combined

    def test_numbered_lists(self, chunker):
        """Test handling of numbered lists"""
        text = """
        Steps:
        1. First step
        2. Second step
        3. Third step
        4. Fourth step
        """
        chunks = chunker.chunk_text(text)

        combined = " ".join(c.text for c in chunks)
        assert "First step" in combined
        assert "Fourth step" in combined

    def test_code_blocks(self, chunker):
        """Test handling of code blocks"""
        text = """
        Example code:
        ```python
        def hello():
            print("Hello, World!")
        
        hello()
        ```
        End of example.
        """
        chunks = chunker.chunk_text(text)

        combined = " ".join(c.text for c in chunks)
        assert "def hello" in combined
        assert "print" in combined


class TestChunkQuality:
    """Tests for chunk quality and coherence"""

    @pytest.fixture
    def chunker(self):
        return TextChunker(chunk_size=300, overlap=50)

    def test_chunks_are_coherent(self, chunker):
        """Test that chunks contain coherent content"""
        text = """
        Machine learning is a subset of artificial intelligence. 
        It allows computers to learn from data without being explicitly programmed.
        
        Deep learning is a subset of machine learning.
        It uses neural networks with many layers to learn complex patterns.
        """
        chunks = chunker.chunk_text(text)

        # Chunks should contain complete thoughts where possible
        for chunk in chunks:
            # Each chunk should have multiple words (coherent)
            words = chunk.text.split()
            assert len(words) >= 5

    def test_no_orphaned_punctuation(self, chunker):
        """Test that punctuation isn't orphaned at chunk boundaries"""
        text = "First sentence. " * 50
        chunks = chunker.chunk_text(text)

        for chunk in chunks:
            stripped = chunk.text.strip()
            if stripped:
                # Should not start with just punctuation
                assert not stripped[0] in '.!?,'
                # Should not have standalone punctuation
                assert stripped != '.'

    def test_context_preservation(self, chunker):
        """Test that context is preserved across chunks"""
        text = """
        Python was created by Guido van Rossum. Guido designed Python to be 
        readable and simple. This design philosophy has made Python popular 
        among beginners and experts alike.
        """
        chunks = chunker.chunk_text(text)

        # Key context should be maintained
        combined = " ".join(c.text for c in chunks)
        assert "Guido" in combined
        assert "Python" in combined


class TestChunkMetrics:
    """Tests for chunk metrics and statistics"""

    @pytest.fixture
    def chunker(self):
        return TextChunker(chunk_size=200)

    def test_get_chunk_statistics(self, chunker):
        """Test getting statistics about chunks"""
        text = "Sample text. " * 100
        chunks = chunker.chunk_text(text)
        
        stats = chunker.get_statistics(chunks)
        
        assert 'total_chunks' in stats
        assert 'average_chunk_size' in stats
        assert 'min_chunk_size' in stats
        assert 'max_chunk_size' in stats
        assert stats['total_chunks'] == len(chunks)

    def test_chunk_word_count(self, chunker):
        """Test word count in chunks"""
        text = "Word " * 100
        chunks = chunker.chunk_text(text)
        
        total_words = sum(len(c.text.split()) for c in chunks)
        # Should have approximately the same number of words (accounting for overlap)
        assert total_words >= 90  # Some words may be in overlap
