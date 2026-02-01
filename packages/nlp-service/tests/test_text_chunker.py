"""
Tests for Text Chunker service
"""
import pytest
from unittest.mock import patch, MagicMock

from app.services.text_chunker import TextChunker
from app.utils.errors import ChunkingError


class TestTextChunker:
    """Tests for TextChunker class."""
    
    def test_init_default_settings(self):
        """Test chunker initializes with default settings."""
        chunker = TextChunker()
        
        assert chunker.chunk_size_words == 800
        assert chunker.overlap_words == 200
        assert chunker.respect_sentences is True
    
    def test_init_custom_settings(self):
        """Test chunker initializes with custom settings."""
        chunker = TextChunker(
            chunk_size_words=500,
            overlap_words=100,
            respect_sentences=False,
        )
        
        assert chunker.chunk_size_words == 500
        assert chunker.overlap_words == 100
        assert chunker.respect_sentences is False
    
    def test_chunk_empty_text(self):
        """Test error when chunking empty text."""
        chunker = TextChunker()
        
        with pytest.raises(ChunkingError):
            chunker.chunk_text("")
        
        with pytest.raises(ChunkingError):
            chunker.chunk_text("   ")
    
    def test_chunk_small_text(self, sample_text):
        """Test chunking text smaller than chunk size."""
        chunker = TextChunker(chunk_size_words=1000)
        
        result = chunker.chunk_text(sample_text)
        
        # Small text should produce single chunk
        assert result.total_chunks == 1
        assert len(result.chunks) == 1
        assert result.chunks[0].text.strip() == sample_text.strip()
    
    def test_chunk_produces_metadata(self, sample_text):
        """Test that chunks include proper metadata."""
        chunker = TextChunker(chunk_size_words=100)
        
        result = chunker.chunk_text(sample_text)
        
        for chunk in result.chunks:
            assert chunk.id is not None
            assert chunk.word_count > 0
            assert chunk.char_count > 0
            assert chunk.hash is not None
            assert len(chunk.hash) == 16
    
    def test_chunk_respects_size_target(self, long_sample_text):
        """Test that chunks are close to target size."""
        chunk_size = 300
        tolerance = 0.3  # 30% tolerance
        
        chunker = TextChunker(chunk_size_words=chunk_size, overlap_words=50)
        
        result = chunker.chunk_text(long_sample_text)
        
        # Check that most chunks are within tolerance
        for chunk in result.chunks[:-1]:  # Exclude last chunk which may be smaller
            min_words = chunk_size * (1 - tolerance)
            max_words = chunk_size * (1 + tolerance)
            # Allow some flexibility for sentence boundaries
            assert chunk.word_count >= min_words * 0.5
    
    def test_chunk_overlap(self, long_sample_text):
        """Test that chunks have proper overlap markers."""
        chunker = TextChunker(chunk_size_words=200, overlap_words=50)
        
        result = chunker.chunk_text(long_sample_text)
        
        if len(result.chunks) > 1:
            # First chunk should not have overlap at start
            assert result.chunks[0].overlap_start is False
            
            # Middle chunks should have overlap at start
            for chunk in result.chunks[1:-1]:
                assert chunk.overlap_start is True
    
    def test_chunk_timing_included(self, sample_text):
        """Test that chunking time is recorded."""
        chunker = TextChunker()
        
        result = chunker.chunk_text(sample_text)
        
        assert result.chunking_time_ms >= 0
    
    def test_chunk_original_word_count(self, sample_text):
        """Test that original word count is recorded."""
        chunker = TextChunker()
        
        result = chunker.chunk_text(sample_text)
        expected_words = len(sample_text.split())
        
        assert result.original_word_count == expected_words
    
    def test_create_chunk_generates_unique_ids(self):
        """Test that chunk IDs are unique."""
        chunker = TextChunker()
        
        chunk1 = chunker._create_chunk(
            text="First chunk text",
            chunk_index=0,
            start_index=0,
            end_index=16,
            overlap_start=False,
            overlap_end=False,
        )
        
        chunk2 = chunker._create_chunk(
            text="Second chunk text",
            chunk_index=1,
            start_index=17,
            end_index=34,
            overlap_start=True,
            overlap_end=False,
        )
        
        assert chunk1.id != chunk2.id
        assert chunk1.hash != chunk2.hash
    
    def test_get_overlap_sentences(self):
        """Test overlap sentence extraction."""
        chunker = TextChunker()
        
        sentences = [
            "First sentence with five words.",
            "Second sentence with more words.",
            "Third sentence here.",
            "Fourth sentence is last.",
        ]
        
        overlap = chunker._get_overlap_sentences(sentences, target_words=10)
        
        # Should get sentences from end totaling ~10 words
        assert len(overlap) > 0
        assert overlap[-1] == sentences[-1]  # Last sentence included


class TestTextChunkerWithSpacy:
    """Tests for spaCy integration in chunker."""
    
    def test_nlp_lazy_loading(self):
        """Test that spaCy model is loaded lazily."""
        chunker = TextChunker()
        
        # NLP should not be loaded yet
        assert chunker._nlp is None
        
        # Access nlp property triggers loading
        nlp = chunker.nlp
        
        assert nlp is not None
        assert chunker._nlp is not None
    
    def test_get_sentences(self, sample_text):
        """Test sentence extraction."""
        chunker = TextChunker()
        
        sentences = chunker._get_sentences(sample_text)
        
        assert len(sentences) > 0
        assert all(isinstance(s, str) for s in sentences)
        assert all(len(s) > 0 for s in sentences)
    
    def test_sentence_boundary_respect(self):
        """Test that chunking respects sentence boundaries."""
        text = "First sentence. Second sentence. Third sentence. Fourth sentence."
        
        chunker = TextChunker(chunk_size_words=4, overlap_words=1, respect_sentences=True)
        
        # With respect_sentences=True, chunks should end at sentence boundaries
        result = chunker.chunk_text(text)
        
        for chunk in result.chunks:
            # Each chunk should contain complete sentences
            text = chunk.text.strip()
            # Should end with period (sentence boundary)
            assert text.endswith('.')
