"""
Tests for PDF Extractor service
"""
import pytest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch, MagicMock

from app.services.pdf_extractor import PDFExtractor
from app.utils.errors import PDFExtractionError, OCRRequiredError


class TestPDFExtractor:
    """Tests for PDFExtractor class."""
    
    def test_init_default_settings(self):
        """Test extractor initializes with default settings."""
        extractor = PDFExtractor()
        assert extractor.filter_headers_footers is True
    
    def test_init_custom_settings(self):
        """Test extractor initializes with custom settings."""
        extractor = PDFExtractor(filter_headers_footers=False)
        assert extractor.filter_headers_footers is False
    
    def test_extract_from_path_file_not_found(self):
        """Test error when file doesn't exist."""
        extractor = PDFExtractor()
        
        with pytest.raises(PDFExtractionError) as exc_info:
            extractor.extract_from_path("/nonexistent/file.pdf")
        
        assert "File not found" in str(exc_info.value.message)
    
    def test_extract_from_path_not_pdf(self, tmp_path):
        """Test error when file is not a PDF."""
        # Create a non-PDF file
        txt_file = tmp_path / "test.txt"
        txt_file.write_text("Not a PDF")
        
        extractor = PDFExtractor()
        
        with pytest.raises(PDFExtractionError) as exc_info:
            extractor.extract_from_path(str(txt_file))
        
        assert "Not a PDF file" in str(exc_info.value.message)
    
    def test_is_header_footer_page_number(self):
        """Test header/footer detection for page numbers."""
        extractor = PDFExtractor()
        
        # Page numbers at the end should be detected
        assert extractor._is_header_footer("42", 98, 100) is True
        assert extractor._is_header_footer("Page 5", 99, 100) is True
        
        # Content in the middle should not be detected
        assert extractor._is_header_footer("42", 50, 100) is False
    
    def test_is_header_footer_patterns(self):
        """Test header/footer detection for common patterns."""
        extractor = PDFExtractor()
        
        # Common header/footer patterns at edges
        assert extractor._is_header_footer("Chapter 1", 0, 50) is True
        assert extractor._is_header_footer("© 2024 Company", 48, 50) is True
        assert extractor._is_header_footer("All Rights Reserved", 49, 50) is True
        
        # Same content in middle shouldn't match
        assert extractor._is_header_footer("© 2024 Company", 25, 50) is False
    
    def test_normalize_text(self):
        """Test text normalization."""
        extractor = PDFExtractor()
        
        # Test multiple newlines
        text = "Line 1\n\n\n\nLine 2"
        normalized = extractor._normalize_text(text)
        assert "\n\n\n" not in normalized
        
        # Test multiple spaces
        text = "Word    another    word"
        normalized = extractor._normalize_text(text)
        assert "    " not in normalized
        
        # Test hyphenated words
        text = "hyphen-\nated"
        normalized = extractor._normalize_text(text)
        assert "hyphenated" in normalized
    
    def test_clean_page_text_empty(self):
        """Test cleaning empty page text."""
        extractor = PDFExtractor()
        
        result = extractor._clean_page_text("", 0)
        assert result == ""
        
        result = extractor._clean_page_text("   \n  \n  ", 0)
        assert result == ""
    
    def test_clean_page_text_with_content(self):
        """Test cleaning page text preserves content."""
        extractor = PDFExtractor(filter_headers_footers=False)
        
        text = "Line 1\nLine 2\nLine 3"
        result = extractor._clean_page_text(text, 0)
        
        assert "Line 1" in result
        assert "Line 2" in result
        assert "Line 3" in result


class TestPDFExtractorWithMocks:
    """Tests for PDF extraction using mocked PDF content."""
    
    @patch('app.services.pdf_extractor.fitz')
    def test_extract_from_bytes_success(self, mock_fitz):
        """Test successful extraction from bytes."""
        # Setup mock document
        mock_doc = MagicMock()
        mock_doc.__len__ = MagicMock(return_value=2)
        mock_doc.metadata = {"title": "Test Doc", "author": "Test Author"}
        
        # Setup mock pages
        mock_page1 = MagicMock()
        mock_page1.get_text.return_value = "Page 1 content with some text."
        mock_page1.get_images.return_value = []
        
        mock_page2 = MagicMock()
        mock_page2.get_text.return_value = "Page 2 content with more text."
        mock_page2.get_images.return_value = []
        
        mock_doc.__iter__ = MagicMock(return_value=iter([0, 1]))
        mock_doc.__getitem__ = MagicMock(side_effect=[mock_page1, mock_page2])
        
        mock_fitz.open.return_value = mock_doc
        
        # Run extraction
        extractor = PDFExtractor()
        result = extractor.extract_from_bytes(
            content=b"fake pdf content",
            filename="test.pdf",
            file_size=1000,
        )
        
        # Verify results
        assert result.success is True
        assert result.metadata.filename == "test.pdf"
        assert result.metadata.page_count == 2
        assert "Page 1 content" in result.text or len(result.text) > 0
    
    @patch('app.services.pdf_extractor.fitz')
    def test_extract_from_bytes_invalid_pdf(self, mock_fitz):
        """Test extraction fails for invalid PDF."""
        mock_fitz.open.side_effect = Exception("Invalid PDF")
        
        extractor = PDFExtractor()
        
        with pytest.raises(PDFExtractionError) as exc_info:
            extractor.extract_from_bytes(b"invalid content")
        
        assert "Failed to open PDF" in str(exc_info.value.message)
    
    @patch('app.services.pdf_extractor.fitz')
    def test_extract_detects_scanned_pdf(self, mock_fitz):
        """Test detection of scanned/image PDFs."""
        # Setup mock document with very little text (scanned)
        mock_doc = MagicMock()
        mock_doc.__len__ = MagicMock(return_value=5)
        mock_doc.metadata = {}
        
        # Pages with minimal text
        mock_page = MagicMock()
        mock_page.get_text.return_value = "a"  # Very little text
        mock_page.get_images.return_value = [("img1",)]
        
        mock_doc.__iter__ = MagicMock(return_value=iter(range(5)))
        mock_doc.__getitem__ = MagicMock(return_value=mock_page)
        
        mock_fitz.open.return_value = mock_doc
        
        extractor = PDFExtractor()
        
        with pytest.raises(OCRRequiredError) as exc_info:
            extractor.extract_from_bytes(b"scanned pdf")
        
        assert exc_info.value.details.get("requires_ocr") is True
