#!/bin/bash
#
# Database Backup Script for PDF Quiz Generator
#
# Usage:
#   ./backup-db.sh                    # Full backup with default settings
#   ./backup-db.sh --skip-uploads     # Backup database only, skip uploads
#   ./backup-db.sh --restore FILE     # Restore from backup file
#   ./backup-db.sh --list             # List available backups
#   ./backup-db.sh --cleanup          # Remove old backups
#
# Schedule with cron:
#   0 2 * * * /opt/apps/pdfquiz/scripts/backup-db.sh >> /opt/apps/pdfquiz/logs/backup.log 2>&1
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(dirname $(dirname "$SCRIPT_DIR"))}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
UPLOAD_DIR="${UPLOAD_DIR:-$PROJECT_ROOT/uploads}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATE=$(date +%Y%m%d_%H%M%S)

# Database configuration (from environment or defaults)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-pdfquiz_prod}"
DB_USER="${DB_USER:-pdfquiz}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create backup directories
setup_dirs() {
    mkdir -p "$BACKUP_DIR/database"
    mkdir -p "$BACKUP_DIR/uploads"
}

# Full database backup
backup_database() {
    local backup_file="$BACKUP_DIR/database/pdfquiz_db_${DATE}.sql.gz"
    
    log_info "Starting database backup..."
    log_info "Database: $DB_NAME@$DB_HOST:$DB_PORT"
    
    # Check if pg_dump is available
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump command not found. Please install PostgreSQL client tools."
        exit 1
    fi
    
    # Perform backup
    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --verbose \
        --format=custom \
        --compress=9 \
        --file="${backup_file%.gz}" \
        2>&1 | tee -a "$PROJECT_ROOT/logs/backup.log"
    
    # Compress if custom format wasn't used
    if [ -f "${backup_file%.gz}" ] && [[ ! "${backup_file%.gz}" =~ \.gz$ ]]; then
        gzip -f "${backup_file%.gz}"
    fi
    
    if [ -f "$backup_file" ] || [ -f "${backup_file%.gz}" ]; then
        local final_file
        if [ -f "$backup_file" ]; then
            final_file="$backup_file"
        else
            final_file="${backup_file%.gz}"
        fi
        local size=$(du -h "$final_file" | cut -f1)
        log_info "Database backup completed: $final_file ($size)"
        echo "$final_file"
    else
        log_error "Database backup failed!"
        exit 1
    fi
}

# Backup uploaded files
backup_uploads() {
    if [ ! -d "$UPLOAD_DIR" ]; then
        log_warn "Upload directory not found: $UPLOAD_DIR"
        return 0
    fi
    
    local backup_file="$BACKUP_DIR/uploads/pdfquiz_uploads_${DATE}.tar.gz"
    
    log_info "Starting uploads backup..."
    log_info "Source: $UPLOAD_DIR"
    
    # Count files
    local file_count=$(find "$UPLOAD_DIR" -type f | wc -l | tr -d ' ')
    log_info "Files to backup: $file_count"
    
    if [ "$file_count" -eq 0 ]; then
        log_warn "No files to backup in uploads directory"
        return 0
    fi
    
    # Create tarball
    tar -czf "$backup_file" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
    
    local size=$(du -h "$backup_file" | cut -f1)
    log_info "Uploads backup completed: $backup_file ($size)"
    echo "$backup_file"
}

# List available backups
list_backups() {
    log_info "Available backups:"
    echo ""
    echo "Database backups:"
    echo "----------------"
    ls -lh "$BACKUP_DIR/database/"*.sql* 2>/dev/null || echo "No database backups found"
    echo ""
    echo "Upload backups:"
    echo "--------------"
    ls -lh "$BACKUP_DIR/uploads/"*.tar.gz 2>/dev/null || echo "No upload backups found"
}

# Cleanup old backups
cleanup_backups() {
    log_info "Removing backups older than $RETENTION_DAYS days..."
    
    # Remove old database backups
    local db_deleted=$(find "$BACKUP_DIR/database" -name "pdfquiz_db_*.sql*" -mtime +$RETENTION_DAYS -delete -print | wc -l)
    log_info "Removed $db_deleted old database backup(s)"
    
    # Remove old upload backups
    local upload_deleted=$(find "$BACKUP_DIR/uploads" -name "pdfquiz_uploads_*.tar.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
    log_info "Removed $upload_deleted old upload backup(s)"
    
    # Show remaining disk usage
    local total_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    log_info "Total backup directory size: $total_size"
}

# Restore from backup
restore_database() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warn "This will OVERWRITE the existing database: $DB_NAME"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Starting database restore from: $backup_file"
    
    # Drop and recreate database
    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d postgres \
        -c "DROP DATABASE IF EXISTS $DB_NAME;"
    
    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d postgres \
        -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    
    # Restore based on file type
    if [[ "$backup_file" =~ \.gz$ ]]; then
        gunzip -c "$backup_file" | PGPASSWORD="${DB_PASSWORD}" pg_restore \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --verbose
    else
        PGPASSWORD="${DB_PASSWORD}" pg_restore \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --verbose \
            "$backup_file"
    fi
    
    log_info "Database restore completed!"
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        log_error "File not found: $backup_file"
        return 1
    fi
    
    log_info "Verifying backup: $backup_file"
    
    if [[ "$backup_file" =~ \.tar\.gz$ ]]; then
        if tar -tzf "$backup_file" > /dev/null 2>&1; then
            log_info "Tarball integrity: OK"
            return 0
        else
            log_error "Tarball integrity: FAILED"
            return 1
        fi
    elif [[ "$backup_file" =~ \.sql\.gz$ ]]; then
        if gzip -t "$backup_file" 2>/dev/null; then
            log_info "Gzip integrity: OK"
            return 0
        else
            log_error "Gzip integrity: FAILED"
            return 1
        fi
    else
        log_warn "Unknown file type, cannot verify"
        return 0
    fi
}

# Main execution
main() {
    setup_dirs
    
    case "${1:-}" in
        --list)
            list_backups
            ;;
        --cleanup)
            cleanup_backups
            ;;
        --restore)
            if [ -z "${2:-}" ]; then
                log_error "Please specify backup file to restore"
                exit 1
            fi
            restore_database "$2"
            ;;
        --verify)
            if [ -z "${2:-}" ]; then
                log_error "Please specify backup file to verify"
                exit 1
            fi
            verify_backup "$2"
            ;;
        --skip-uploads)
            log_info "Starting backup (database only)..."
            backup_database
            cleanup_backups
            log_info "Backup completed!"
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --list          List available backups"
            echo "  --cleanup       Remove old backups"
            echo "  --restore FILE  Restore from backup file"
            echo "  --verify FILE   Verify backup integrity"
            echo "  --skip-uploads  Backup database only"
            echo "  --help          Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  DB_HOST         Database host (default: localhost)"
            echo "  DB_PORT         Database port (default: 5432)"
            echo "  DB_NAME         Database name (default: pdfquiz_prod)"
            echo "  DB_USER         Database user (default: pdfquiz)"
            echo "  DB_PASSWORD     Database password"
            echo "  BACKUP_DIR      Backup directory"
            echo "  RETENTION_DAYS  Days to keep backups (default: 30)"
            ;;
        *)
            log_info "Starting full backup..."
            backup_database
            backup_uploads
            cleanup_backups
            log_info "Full backup completed!"
            ;;
    esac
}

main "$@"
