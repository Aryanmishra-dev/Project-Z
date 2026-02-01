"""
PDF Text Extraction Service
Uses PyMuPDF (fitz) for text extraction with header/footer filtering
"""
import re
import time
from pathlib import Path
from typing import Any
from datetime import datetime
from io import BytesIO

import fitz  # PyMuPDF

from app.utils.logger import logger
from app.utils.errors import PDFExtractionError, OCRRequiredError
from app.models.pdf import PDFMetadata, PDFExtractionResponse


class PDFExtractor:
    """
    Extracts text from PDF documents using PyMuPDF.
    
    Features:
    - Text extraction from all pages
    - Header/footer detection and filtering
    - Metadata extraction
    - Text cleaning and normalization
    - Scanned PDF detection
    """
    
    # Patterns to identify headers/footers
    HEADER_FOOTER_PATTERNS = [
        r"^page\s*\d+",
        r"^\d+\s*$",
        r"^\d+\s*of\s*\d+",
        r"^chapter\s+\d+",
        r"^table of contents",
        r"©\s*\d{4}",
        r"^all rights reserved",
        r"^confidential",
        r"^\s*-\s*\d+\s*-\s*$",
    ]
    
    # Minimum text density (chars per page) to consider non-scanned
    MIN_TEXT_DENSITY = 100
    
    def __init__(self, filter_headers_footers: bool = True):
        """
        Initialize the PDF extractor.
        
        Args:
            filter_headers_footers: Whether to filter out detected headers/footers
        """
        self.filter_headers_footers = filter_headers_footers
        self._header_footer_regex = re.compile(
            "|".join(self.HEADER_FOOTER_PATTERNS),
            re.IGNORECASE | re.MULTILINE
        )
    
    def extract_from_path(self, file_path: str | Path) -> PDFExtractionResponse:
        """
        Extract text from a PDF file path.
        
        Args:
            file_path: Path to the PDF file
            
        Returns:
            PDFExtractionResponse with extracted text and metadata
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise PDFExtractionError(f"File not found: {file_path}")
        
        if not file_path.suffix.lower() == ".pdf":
            raise PDFExtractionError(f"Not a PDF file: {file_path}")
        
        with open(file_path, "rb") as f:
            content = f.read()
        
        return self.extract_from_bytes(
            content,
            filename=file_path.name,
            file_size=file_path.stat().st_size
        )
    
    def extract_from_bytes(
        self,
        content: bytes,
        filename: str = "document.pdf",
        file_size: int = 0
    ) -> PDFExtractionResponse:
        """
        Extract text from PDF bytes.
        
        Args:
            content: PDF file content as bytes
            filename: Original filename
            file_size: File size in bytes
            
        Returns:
            PDFExtractionResponse with extracted text and metadata
        """
        start_time = time.time()
        
        try:
            doc = fitz.open(stream=content, filetype="pdf")
        except Exception as e:
            raise PDFExtractionError(f"Failed to open PDF: {e}")
        
        try:
            return self._extract_from_document(
                doc,
                filename=filename,
                file_size=file_size or len(content),
                start_time=start_time
            )
        finally:
            doc.close()
    
    def _extract_from_document(
        self,
        doc: fitz.Document,
        filename: str,
        file_size: int,
        start_time: float
    ) -> PDFExtractionResponse:
        """
        Extract text from an open PyMuPDF document.
        """
        pages: list[dict[str, Any]] = []
        all_text_parts: list[str] = []
        total_chars = 0
        has_images = False
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # Extract text
            page_text = page.get_text("text")
            
            # Check for images
            if page.get_images():
                has_images = True
            
            # Track character count
            total_chars += len(page_text)
            
            # Clean and filter the page text
            cleaned_text = self._clean_page_text(page_text, page_num)
            
            pages.append({
                "pageNumber": page_num + 1,
                "text": cleaned_text,
                "charCount": len(cleaned_text),
                "wordCount": len(cleaned_text.split()),
            })
            
            if cleaned_text.strip():
                all_text_parts.append(cleaned_text)
        
        # Check if PDF appears to be scanned
        avg_chars_per_page = total_chars / len(doc) if len(doc) > 0 else 0
        is_scanned = avg_chars_per_page < self.MIN_TEXT_DENSITY
        
        if is_scanned and len(doc) > 0:
            raise OCRRequiredError(page_count=len(doc))
        
        # Combine all text
        full_text = "\n\n".join(all_text_parts)
        full_text = self._normalize_text(full_text)
        
        # Extract metadata
        metadata = self._extract_metadata(doc, filename, file_size, full_text, is_scanned, has_images)
        
        extraction_time = int((time.time() - start_time) * 1000)
        
        logger.info(
            "PDF extraction completed",
            data={
                "filename": filename,
                "pages": len(doc),
                "words": metadata.word_count,
                "time_ms": extraction_time,
            }
        )
        
        return PDFExtractionResponse(
            text=full_text,
            metadata=metadata,
            pages=pages,
            extraction_time_ms=extraction_time,
            success=True,
        )
    
    def _clean_page_text(self, text: str, page_num: int) -> str:
        """
        Clean text from a single page.
        
        Args:
            text: Raw page text
            page_num: Page number (0-indexed)
            
        Returns:
            Cleaned text
        """
        if not text:
            return ""
        
        lines = text.split("\n")
        cleaned_lines: list[str] = []
        
        for i, line in enumerate(lines):
            line = line.strip()
            
            if not line:
                continue
            
            # Skip if line matches header/footer pattern
            if self.filter_headers_footers and self._is_header_footer(line, i, len(lines)):
                continue
            
            cleaned_lines.append(line)
        
        return "\n".join(cleaned_lines)
    
    def _is_header_footer(self, line: str, line_idx: int, total_lines: int) -> bool:
        """
        Detect if a line is likely a header or footer.
        
        Args:
            line: The text line
            line_idx: Index of the line (0-based)
            total_lines: Total number of lines on the page
            
        Returns:
            True if line appears to be a header/footer
        """
        # Check position (first 3 or last 3 lines)
        is_edge = line_idx < 3 or line_idx >= total_lines - 3
        
        if not is_edge:
            return False
        
        # Check against patterns
        if self._header_footer_regex.search(line):
            return True
        
        # Very short lines at edges are likely page numbers
        if len(line) < 20 and line_idx >= total_lines - 2:
            # Check if it's just a number
            if re.match(r"^\d+$", line.strip()):
                return True
        
        return False
    
    def _normalize_text(self, text: str) -> str:
        """
        Normalize extracted text.
        
        Args:
            text: Raw extracted text
            
        Returns:
            Normalized text
        """
        # Replace multiple newlines with double newline
        text = re.sub(r"\n{3,}", "\n\n", text)
        
        # Replace multiple spaces with single space
        text = re.sub(r"[ \t]+", " ", text)
        
        # Fix hyphenated words split across lines
        text = re.sub(r"(\w+)-\n(\w+)", r"\1\2", text)
        
        # Remove form feed characters
        text = text.replace("\f", "\n\n")
        
        # Strip leading/trailing whitespace
        text = text.strip()
        
        return text
    
    def _extract_metadata(
        self,
        doc: fitz.Document,
        filename: str,
        file_size: int,
        text: str,
        is_scanned: bool,
        has_images: bool
    ) -> PDFMetadata:
        """
        Extract metadata from PDF document.
        """
        doc_metadata = doc.metadata or {}
        
        # Parse creation date
        creation_date = None
        if doc_metadata.get("creationDate"):
            try:
                date_str = doc_metadata["creationDate"]
                # PDF date format: D:YYYYMMDDHHmmSS
                if date_str.startswith("D:"):
                    date_str = date_str[2:16]
                    creation_date = datetime.strptime(date_str, "%Y%m%d%H%M%S")
            except (ValueError, IndexError):
                pass
        
        words = text.split()
        
        return PDFMetadata(
            filename=filename,
            page_count=len(doc),
            word_count=len(words),
            char_count=len(text),
            title=doc_metadata.get("title") or None,
            author=doc_metadata.get("author") or None,
            creation_date=creation_date,
            file_size_bytes=file_size,
            has_images=has_images,
            is_scanned=is_scanned,
        )
