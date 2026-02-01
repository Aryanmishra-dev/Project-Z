"""
Text Chunking Service
Splits text into semantic chunks using spaCy for sentence boundary detection
"""
import hashlib
import time
from typing import Iterator

import spacy
from spacy.language import Language

from app.config import settings
from app.utils.logger import logger
from app.utils.errors import ChunkingError
from app.models.pdf import TextChunk, ChunkingResponse


class TextChunker:
    """
    Chunks text into semantically meaningful segments.
    
    Features:
    - Target chunk size of 800 words (±10%)
    - 200 word overlap between chunks
    - Respects sentence boundaries using spaCy
    - Generates chunk hashes for caching
    """
    
    def __init__(
        self,
        chunk_size_words: int | None = None,
        overlap_words: int | None = None,
        respect_sentences: bool = True,
    ):
        """
        Initialize the text chunker.
        
        Args:
            chunk_size_words: Target chunk size in words (default from config)
            overlap_words: Number of words to overlap between chunks
            respect_sentences: Whether to respect sentence boundaries
        """
        self.chunk_size_words = chunk_size_words or settings.chunk_size_words
        self.overlap_words = overlap_words or settings.chunk_overlap_words
        self.respect_sentences = respect_sentences
        
        # Calculate tolerance (±10%)
        self.min_chunk_words = int(self.chunk_size_words * 0.9)
        self.max_chunk_words = int(self.chunk_size_words * 1.1)
        
        # Load spaCy model lazily
        self._nlp: Language | None = None
    
    @property
    def nlp(self) -> Language:
        """Get or load spaCy model."""
        if self._nlp is None:
            try:
                # Try to load the English model
                self._nlp = spacy.load("en_core_web_sm", disable=["ner", "parser"])
                # Add sentencizer for sentence boundary detection
                if "sentencizer" not in self._nlp.pipe_names:
                    self._nlp.add_pipe("sentencizer")
                logger.info("Loaded spaCy model: en_core_web_sm")
            except OSError:
                # Fall back to blank model with sentencizer
                logger.warning("en_core_web_sm not found, using blank English model")
                self._nlp = spacy.blank("en")
                self._nlp.add_pipe("sentencizer")
        return self._nlp
    
    def chunk_text(self, text: str) -> ChunkingResponse:
        """
        Split text into chunks.
        
        Args:
            text: Text to chunk
            
        Returns:
            ChunkingResponse with list of chunks
        """
        start_time = time.time()
        
        if not text or not text.strip():
            raise ChunkingError("Cannot chunk empty text")
        
        # Count original words
        original_words = text.split()
        original_word_count = len(original_words)
        
        # If text is smaller than min chunk size, return single chunk
        if original_word_count <= self.min_chunk_words:
            chunk = self._create_chunk(
                text=text.strip(),
                chunk_index=0,
                start_index=0,
                end_index=len(text),
                overlap_start=False,
                overlap_end=False,
            )
            return ChunkingResponse(
                chunks=[chunk],
                total_chunks=1,
                original_word_count=original_word_count,
                chunking_time_ms=int((time.time() - start_time) * 1000),
            )
        
        # Get sentences
        if self.respect_sentences:
            sentences = self._get_sentences(text)
        else:
            # Treat each word as a "sentence" for simple word-based chunking
            sentences = text.split()
        
        # Create chunks from sentences
        chunks = list(self._create_chunks_from_sentences(sentences, text))
        
        chunking_time = int((time.time() - start_time) * 1000)
        
        logger.info(
            "Text chunking completed",
            data={
                "original_words": original_word_count,
                "chunks": len(chunks),
                "time_ms": chunking_time,
            }
        )
        
        return ChunkingResponse(
            chunks=chunks,
            total_chunks=len(chunks),
            original_word_count=original_word_count,
            chunking_time_ms=chunking_time,
        )
    
    def _get_sentences(self, text: str) -> list[str]:
        """
        Extract sentences from text using spaCy.
        
        Args:
            text: Input text
            
        Returns:
            List of sentence strings
        """
        # Process with spaCy (increase max_length for large docs)
        self.nlp.max_length = max(len(text) + 1000, 1000000)
        doc = self.nlp(text)
        
        sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]
        
        return sentences
    
    def _create_chunks_from_sentences(
        self,
        sentences: list[str],
        original_text: str
    ) -> Iterator[TextChunk]:
        """
        Create chunks from sentences respecting word count targets.
        
        Args:
            sentences: List of sentences
            original_text: Original full text for position tracking
            
        Yields:
            TextChunk objects
        """
        chunk_index = 0
        current_sentences: list[str] = []
        current_word_count = 0
        overlap_sentences: list[str] = []
        
        text_position = 0
        chunk_start_position = 0
        
        for sentence in sentences:
            sentence_words = len(sentence.split())
            
            # Add sentence to current chunk
            current_sentences.append(sentence)
            current_word_count += sentence_words
            
            # Check if we've reached target chunk size
            if current_word_count >= self.min_chunk_words:
                # Check if we should include the next sentence or stop
                if current_word_count >= self.chunk_size_words:
                    # Create chunk
                    chunk_text = " ".join(current_sentences)
                    
                    # Find position in original text
                    try:
                        chunk_start = original_text.find(current_sentences[0][:50], chunk_start_position)
                        if chunk_start == -1:
                            chunk_start = chunk_start_position
                        chunk_end = chunk_start + len(chunk_text)
                    except:
                        chunk_start = chunk_start_position
                        chunk_end = chunk_start + len(chunk_text)
                    
                    yield self._create_chunk(
                        text=chunk_text,
                        chunk_index=chunk_index,
                        start_index=chunk_start,
                        end_index=chunk_end,
                        overlap_start=chunk_index > 0,
                        overlap_end=True,  # Will be updated for last chunk
                    )
                    
                    chunk_index += 1
                    chunk_start_position = chunk_end
                    
                    # Calculate overlap - get last N words worth of sentences
                    overlap_sentences = self._get_overlap_sentences(
                        current_sentences,
                        self.overlap_words
                    )
                    
                    # Start new chunk with overlap
                    current_sentences = overlap_sentences.copy()
                    current_word_count = sum(len(s.split()) for s in current_sentences)
        
        # Handle remaining sentences
        if current_sentences:
            # Don't create tiny leftover chunks - merge with previous if needed
            if current_word_count < self.min_chunk_words // 2 and chunk_index > 0:
                # Skip this chunk as it's too small
                pass
            else:
                chunk_text = " ".join(current_sentences)
                
                try:
                    chunk_start = original_text.find(current_sentences[0][:50], chunk_start_position)
                    if chunk_start == -1:
                        chunk_start = chunk_start_position
                    chunk_end = len(original_text)
                except:
                    chunk_start = chunk_start_position
                    chunk_end = len(original_text)
                
                yield self._create_chunk(
                    text=chunk_text,
                    chunk_index=chunk_index,
                    start_index=chunk_start,
                    end_index=chunk_end,
                    overlap_start=chunk_index > 0,
                    overlap_end=False,  # Last chunk has no overlap at end
                )
    
    def _get_overlap_sentences(
        self,
        sentences: list[str],
        target_words: int
    ) -> list[str]:
        """
        Get sentences from the end that total approximately target_words.
        
        Args:
            sentences: List of sentences
            target_words: Target word count for overlap
            
        Returns:
            List of sentences for overlap
        """
        overlap: list[str] = []
        word_count = 0
        
        for sentence in reversed(sentences):
            sentence_words = len(sentence.split())
            if word_count + sentence_words > target_words and overlap:
                break
            overlap.insert(0, sentence)
            word_count += sentence_words
        
        return overlap
    
    def _create_chunk(
        self,
        text: str,
        chunk_index: int,
        start_index: int,
        end_index: int,
        overlap_start: bool,
        overlap_end: bool,
    ) -> TextChunk:
        """
        Create a TextChunk object.
        
        Args:
            text: Chunk text
            chunk_index: Index of this chunk
            start_index: Start position in original text
            end_index: End position in original text
            overlap_start: Whether chunk starts with overlap
            overlap_end: Whether chunk ends with overlap
            
        Returns:
            TextChunk object
        """
        words = text.split()
        chunk_hash = hashlib.sha256(text.encode()).hexdigest()[:16]
        
        return TextChunk(
            id=f"chunk_{chunk_index}_{chunk_hash[:8]}",
            text=text,
            word_count=len(words),
            char_count=len(text),
            start_index=start_index,
            end_index=end_index,
            chunk_index=chunk_index,
            overlap_start=overlap_start,
            overlap_end=overlap_end,
            hash=chunk_hash,
        )
