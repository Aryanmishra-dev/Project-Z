"""
Structured logging configuration for NLP Service
JSON-formatted logs for production, colored console for development
"""
import logging
import sys
import json
from datetime import datetime, timezone
from typing import Any
from app.config import settings


class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging."""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_data: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add extra fields if present
        if hasattr(record, "extra_data"):
            log_data["data"] = record.extra_data
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_data, default=str)


class ColoredFormatter(logging.Formatter):
    """Colored formatter for development console output."""
    
    COLORS = {
        "DEBUG": "\033[36m",    # Cyan
        "INFO": "\033[32m",     # Green
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",    # Red
        "CRITICAL": "\033[35m", # Magenta
    }
    RESET = "\033[0m"
    
    def format(self, record: logging.LogRecord) -> str:
        """Format with colors for terminal output."""
        color = self.COLORS.get(record.levelname, self.RESET)
        
        # Format timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Build message
        message = f"{color}{timestamp} | {record.levelname:8s}{self.RESET} | {record.name} | {record.getMessage()}"
        
        # Add extra data if present
        if hasattr(record, "extra_data") and record.extra_data:
            message += f" | {record.extra_data}"
        
        # Add exception if present
        if record.exc_info:
            message += f"\n{self.formatException(record.exc_info)}"
        
        return message


class ContextLogger(logging.Logger):
    """Logger with context data support."""
    
    def _log_with_extra(
        self, 
        level: int, 
        msg: str, 
        args: tuple,
        extra_data: dict[str, Any] | None = None,
        **kwargs: Any
    ) -> None:
        """Log with extra context data."""
        if extra_data:
            kwargs.setdefault("extra", {})["extra_data"] = extra_data
        super()._log(level, msg, args, **kwargs)
    
    def debug(self, msg: str, *args: Any, data: dict[str, Any] | None = None, **kwargs: Any) -> None:
        self._log_with_extra(logging.DEBUG, msg, args, data, **kwargs)
    
    def info(self, msg: str, *args: Any, data: dict[str, Any] | None = None, **kwargs: Any) -> None:
        self._log_with_extra(logging.INFO, msg, args, data, **kwargs)
    
    def warning(self, msg: str, *args: Any, data: dict[str, Any] | None = None, **kwargs: Any) -> None:
        self._log_with_extra(logging.WARNING, msg, args, data, **kwargs)
    
    def error(self, msg: str, *args: Any, data: dict[str, Any] | None = None, **kwargs: Any) -> None:
        self._log_with_extra(logging.ERROR, msg, args, data, **kwargs)
    
    def critical(self, msg: str, *args: Any, data: dict[str, Any] | None = None, **kwargs: Any) -> None:
        self._log_with_extra(logging.CRITICAL, msg, args, data, **kwargs)


def setup_logging() -> ContextLogger:
    """
    Configure and return the application logger.
    Uses JSON format in production, colored console in development.
    """
    # Register custom logger class
    logging.setLoggerClass(ContextLogger)
    
    # Create logger
    log = logging.getLogger("nlp-service")
    log.setLevel(getattr(logging, settings.log_level.upper()))
    
    # Clear existing handlers
    log.handlers.clear()
    
    # Create console handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(getattr(logging, settings.log_level.upper()))
    
    # Use appropriate formatter
    if settings.debug:
        formatter = ColoredFormatter()
    else:
        formatter = JSONFormatter()
    
    handler.setFormatter(formatter)
    log.addHandler(handler)
    
    # Prevent propagation to root logger
    log.propagate = False
    
    return log  # type: ignore


# Create and export logger instance
logger = setup_logging()
