#!/bin/bash

DB_NAME="ast"
BSON_DIR="/Users/nat/Desktop/freelance/gedong-ats/server/drk_local"
MONGO_URI="mongodb://localhost:27017"
MONGO_USER="admin"
MONGO_PASS="admin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

check_mongorestore() {
    if ! command -v mongorestore &> /dev/null; then
        error "mongorestore không tìm thấy. Vui lòng cài đặt MongoDB Tools:"
        echo "brew install mongodb/brew/mongodb-database-tools"
        exit 1
    fi

    # Kiểm tra version
    version=$(mongorestore --version | head -n1)
    success "mongorestore đã sẵn sàng: $version"
}

# Kiểm tra thư mục BSON
check_bson_directory() {
    if [ ! -d "$BSON_DIR" ]; then
        error "Thư mục BSON không tồn tại: $BSON_DIR"
        exit 1
    fi

    bson_count=$(find "$BSON_DIR" -name "*.bson" | wc -l)
    if [ $bson_count -eq 0 ]; then
        error "Không tìm thấy file .bson nào trong: $BSON_DIR"
        exit 1
    fi

    success "Tìm thấy $bson_count file(s) .bson"
}

# Tạo MongoDB URI với authentication
build_mongo_uri() {
    if [ -n "$MONGO_USER" ] && [ -n "$MONGO_PASS" ]; then
        # URI với authentication
        MONGO_URI="mongodb://${MONGO_USER}:${MONGO_PASS}@localhost:27017"
    else
        # URI không authentication
        MONGO_URI="mongodb://localhost:27017"
    fi
    log "MongoDB URI: ${MONGO_URI//${MONGO_PASS}/***}"
}

# Kiểm tra kết nối MongoDB
check_mongo_connection() {
    log "Kiểm tra kết nối MongoDB..."

    if command -v mongosh &> /dev/null; then
        mongo_cmd="mongosh '$MONGO_URI' --eval 'db.runCommand({ping: 1})'"
    elif command -v mongo &> /dev/null; then
        mongo_cmd="mongo '$MONGO_URI' --eval 'db.runCommand({ping: 1})'"
    else
        warn "Không tìm thấy mongosh hoặc mongo client. Bỏ qua kiểm tra kết nối."
        return 0
    fi

    if eval $mongo_cmd &> /dev/null; then
        success "Kết nối MongoDB thành công"
    else
        error "Không thể kết nối MongoDB. Kiểm tra lại cấu hình."
        exit 1
    fi
}

# Import individual BSON files
import_bson_files() {
    log "Bắt đầu import individual BSON files..."

    # Đếm tổng số files
    total_files=$(find "$BSON_DIR" -name "*.bson" | wc -l | tr -d ' ')
    current_file=0

    # Duyệt qua tất cả files .bson
    find "$BSON_DIR" -name "*.bson" | while read -r bson_file; do
        current_file=$((current_file + 1))
        collection_name=$(basename "$bson_file" .bson)

        log "[$current_file/$total_files] Import collection: $collection_name"

        # Command mongorestore với syntax mới
        if mongorestore \
            --uri="$MONGO_URI" \
            --db="$DB_NAME" \
            --collection="$collection_name" \
            --authenticationDatabase="admin" \
            --drop "$bson_file"; \
        then
            success "✓ Import thành công: $collection_name"
        else
            error "✗ Import thất bại: $collection_name"
        fi
    done
}

# Import toàn bộ dump directory
import_dump_directory() {
    log "Import từ dump directory..."

    if mongorestore \
        --uri="$MONGO_URI" \
        --db="$DB_NAME" \
        --drop \
        "$BSON_DIR"; then
        success "Import dump directory thành công"
    else
        error "Import dump directory thất bại"
        return 1
    fi
}

# Import với cấu trúc MongoDB dump chuẩn
import_standard_dump() {
    log "Import từ standard MongoDB dump..."

    if mongorestore \
        --uri="$MONGO_URI" \
        --drop \
        "$BSON_DIR"; then
        success "Import standard dump thành công"
    else
        error "Import standard dump thất bại"
        return 1
    fi
}

# Hiển thị thống kê sau import
show_statistics() {
    log "Hiển thị thống kê collections:"

    if command -v mongosh &> /dev/null; then
        mongosh "$MONGO_URI" --eval "
            use $DB_NAME;
            print('Collections in $DB_NAME:');
            db.getCollectionNames().forEach(function(collection) {
                var count = db[collection].countDocuments();
                print('  ' + collection + ': ' + count + ' documents');
            });
        "
    elif command -v mongo &> /dev/null; then
        mongo "$MONGO_URI" --eval "
            use $DB_NAME;
            print('Collections in $DB_NAME:');
            db.getCollectionNames().forEach(function(collection) {
                var count = db[collection].count();
                print('  ' + collection + ': ' + count + ' documents');
            });
        "
    else
        warn "Không thể hiển thị thống kê (không tìm thấy mongo client)"
    fi
}

# Main function
main() {
    echo "============================================="
    echo "   MongoDB BSON Import Script (Fixed)"
    echo "============================================="

    # Xây dựng URI
    build_mongo_uri

    log "Database: $DB_NAME"
    log "BSON Directory: $BSON_DIR"
    log "MongoDB URI: ${MONGO_URI//${MONGO_PASS}/***}"

    # Kiểm tra các điều kiện
    check_mongorestore
    check_bson_directory
    check_mongo_connection

    # Hỏi xác nhận
    echo ""
    read -p "Bạn có muốn tiếp tục import? (y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        warn "Hủy bỏ import"
        exit 0
    fi

    # Phát hiện cấu trúc và import
    if [ -d "$BSON_DIR/$DB_NAME" ]; then
        log "Phát hiện dump directory với tên database"
        import_dump_directory
    elif ls "$BSON_DIR"/*/*.bson 1> /dev/null 2>&1; then
        log "Phát hiện standard MongoDB dump structure"
        import_standard_dump
    else
        log "Import individual BSON files"
        import_bson_files
    fi

    success "Hoàn thành import!"

    # Hiển thị thống kê
    show_statistics
}

# Chạy script
main "$@"
