#!/bin/bash
#
# Log Rotation and Cleanup Script
# 
# Features:
# - Rotates logs daily
# - Keeps 30 days of logs
# - Compresses old logs
# - Monitors error log for critical issues
#
# Usage: ./rotate-logs.sh [--compress-only] [--cleanup-only] [--monitor]
# Add to crontab: 0 0 * * * /path/to/rotate-logs.sh

set -euo pipefail

# Configuration
LOG_DIR="${LOG_DIR:-/var/log/pdfquiz}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
COMPRESS_AFTER_DAYS="${COMPRESS_AFTER_DAYS:-1}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
CRITICAL_PATTERNS="FATAL|CRITICAL|OutOfMemory|ENOSPC|database connection failed|redis connection failed"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create log directory if it doesn't exist
ensure_log_dir() {
    if [[ ! -d "$LOG_DIR" ]]; then
        mkdir -p "$LOG_DIR"
        log_info "Created log directory: $LOG_DIR"
    fi
}

# Compress logs older than COMPRESS_AFTER_DAYS
compress_old_logs() {
    log_info "Compressing logs older than $COMPRESS_AFTER_DAYS days..."
    
    local count=0
    
    # Find uncompressed log files older than threshold
    while IFS= read -r -d '' logfile; do
        if [[ -f "$logfile" && ! "$logfile" =~ \.gz$ ]]; then
            gzip "$logfile"
            ((count++))
            log_info "Compressed: $(basename "$logfile")"
        fi
    done < <(find "$LOG_DIR" -name "*.log" -type f -mtime +$COMPRESS_AFTER_DAYS -print0 2>/dev/null)
    
    log_info "Compressed $count log files"
}

# Delete logs older than RETENTION_DAYS
cleanup_old_logs() {
    log_info "Cleaning up logs older than $RETENTION_DAYS days..."
    
    local count=0
    
    # Find and delete old log files (both compressed and uncompressed)
    while IFS= read -r -d '' logfile; do
        rm -f "$logfile"
        ((count++))
        log_info "Deleted: $(basename "$logfile")"
    done < <(find "$LOG_DIR" -name "*.log*" -type f -mtime +$RETENTION_DAYS -print0 2>/dev/null)
    
    log_info "Deleted $count old log files"
}

# Monitor error logs for critical issues
monitor_error_logs() {
    log_info "Monitoring error logs for critical issues..."
    
    # Find today's error log
    local today=$(date '+%Y-%m-%d')
    local error_log="$LOG_DIR/error-${today}.log"
    
    if [[ ! -f "$error_log" ]]; then
        log_info "No error log found for today"
        return 0
    fi
    
    # Search for critical patterns
    local critical_lines
    critical_lines=$(grep -E "$CRITICAL_PATTERNS" "$error_log" 2>/dev/null || true)
    
    if [[ -n "$critical_lines" ]]; then
        local count=$(echo "$critical_lines" | wc -l)
        log_error "Found $count critical issues in error log!"
        
        # Send alert email if configured
        if [[ -n "$ALERT_EMAIL" ]]; then
            send_alert_email "$critical_lines"
        fi
        
        # Print critical lines
        echo "Critical issues found:"
        echo "$critical_lines"
        
        return 1
    fi
    
    log_info "No critical issues found in error log"
    return 0
}

# Send alert email
send_alert_email() {
    local critical_lines="$1"
    local subject="[CRITICAL] PDF Quiz Generator - Critical Errors Detected"
    local body="Critical errors were detected in the application logs:

$critical_lines

Please investigate immediately.

Server: $(hostname)
Time: $(date)
Log File: $LOG_DIR/error-$(date '+%Y-%m-%d').log"
    
    if command -v mail &> /dev/null; then
        echo "$body" | mail -s "$subject" "$ALERT_EMAIL"
        log_info "Alert email sent to $ALERT_EMAIL"
    else
        log_warn "mail command not available, cannot send alert email"
    fi
}

# Show log statistics
show_stats() {
    log_info "Log Statistics for $LOG_DIR"
    echo "=================================="
    
    # Total size
    local total_size=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)
    echo "Total log size: $total_size"
    
    # File counts
    local total_files=$(find "$LOG_DIR" -name "*.log*" -type f 2>/dev/null | wc -l)
    local compressed=$(find "$LOG_DIR" -name "*.gz" -type f 2>/dev/null | wc -l)
    local uncompressed=$((total_files - compressed))
    
    echo "Total log files: $total_files"
    echo "  - Compressed: $compressed"
    echo "  - Uncompressed: $uncompressed"
    
    # Oldest and newest
    local oldest=$(find "$LOG_DIR" -name "*.log*" -type f -printf '%T+ %p\n' 2>/dev/null | sort | head -1 | cut -d' ' -f2-)
    local newest=$(find "$LOG_DIR" -name "*.log*" -type f -printf '%T+ %p\n' 2>/dev/null | sort -r | head -1 | cut -d' ' -f2-)
    
    echo "Oldest log: ${oldest:-N/A}"
    echo "Newest log: ${newest:-N/A}"
    
    # Error count today
    local today=$(date '+%Y-%m-%d')
    local error_log="$LOG_DIR/error-${today}.log"
    if [[ -f "$error_log" ]]; then
        local error_count=$(wc -l < "$error_log")
        echo "Errors today: $error_count"
    fi
    
    echo "=================================="
}

# Main function
main() {
    ensure_log_dir
    
    case "${1:-all}" in
        --compress-only)
            compress_old_logs
            ;;
        --cleanup-only)
            cleanup_old_logs
            ;;
        --monitor)
            monitor_error_logs
            ;;
        --stats)
            show_stats
            ;;
        all|*)
            compress_old_logs
            cleanup_old_logs
            monitor_error_logs || true
            show_stats
            ;;
    esac
}

main "$@"
