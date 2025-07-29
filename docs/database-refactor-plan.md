# Database Refactor Plan - GEDONG ATS System

## Tổng quan

Hệ thống GEDONG ATS (Automated Tool Storage) hiện tại có cấu trúc database với nhiều vấn đề về normalization, data types, và performance. Tài liệu này đề xuất kế hoạch refactor toàn diện.

## Phân tích hiện tại

### Vấn đề chính

1. **Data Duplication**
   - `Bin` và `BinItem` có các field trùng lặp (min, max, critical)
   - `Device` có quantity fields có thể tính từ `BinItem`
   - `Transaction` sử dụng Mixed types cho user và locations

2. **Inconsistent Data Types**
   - Quantity/weight fields sử dụng string thay vì number
   - Boolean fields sử dụng number (0/1)
   - Thiếu validation cho enum values

3. **Poor Indexing Strategy**
   - Chỉ có một số ít index được định nghĩa
   - Thiếu compound indexes cho queries phổ biến

4. **Security Issues**
   - Password lưu plain text
   - Biometric data không được encrypt
   - Thiếu audit trails

5. **Performance Issues**
   - N+1 queries do thiếu proper relationships
   - Large documents với nested arrays
   - Thiếu pagination support

## Kế hoạch Refactor

### Phase 1: Core Schema Refactoring

#### 1.1 User Management
- **File**: `user.schema.ts` (refactored)
- **Cải tiến**:
  - Password encryption với bcrypt
  - Role-based access control với enums
  - Biometric data encryption
  - Audit trails (createdBy, updatedBy)
  - Soft delete support
  - Proper indexing strategy

#### 1.2 Inventory Management
- **File**: `inventory.schema.ts` (new)
- **Cải tiến**:
  - Normalize quantity data từ `BinItem`
  - Status tracking với enums
  - Batch/serial number tracking
  - Expiry date management
  - Calibration tracking
  - Virtual fields cho calculations

#### 1.3 Transaction System
- **File**: `transaction.schema.ts` (refactored)
- **Cải tiến**:
  - Structured item arrays thay vì Mixed types
  - Approval workflow tracking
  - Priority levels
  - Due date management
  - Processing time tracking

#### 1.4 Device Management
- **File**: `device.schema.ts` (refactored)
- **Cải tiến**:
  - Proper data types cho weight measurements
  - Device type classification
  - Heartbeat monitoring
  - Calibration scheduling
  - Error tracking

### Phase 2: Relationship Optimization

#### 2.1 Hierarchical Structure
```
Site
├── Area
│   ├── Cabinet
│   │   ├── Shelf
│   │   │   ├── Bin
│   │   │   │   └── Inventory (BinItem)
│   │   │   └── Device
│   │   └── Device
│   └── Device
└── User
```

#### 2.2 Referential Integrity
- Proper ObjectId references
- Cascade delete rules
- Foreign key constraints

### Phase 3: Performance Optimization

#### 3.1 Indexing Strategy
- Compound indexes cho common queries
- Text indexes cho search functionality
- TTL indexes cho temporary data
- Sparse indexes cho optional fields

#### 3.2 Data Aggregation
- Materialized views cho reports
- Cached calculations
- Background jobs cho heavy operations

### Phase 4: Security Enhancement

#### 4.1 Data Protection
- Field-level encryption
- Audit logging
- Access control matrices
- Data masking

#### 4.2 Authentication & Authorization
- JWT token management
- Role-based permissions
- Session management
- API rate limiting

## Migration Strategy

### Step 1: Schema Creation
1. Tạo new schemas trong `refactored/` folder
2. Implement data validation
3. Add indexes và virtual fields
4. Test với sample data

### Step 2: Data Migration
1. Create migration scripts
2. Backup existing data
3. Transform data format
4. Validate data integrity

### Step 3: Application Updates
1. Update repositories
2. Update services
3. Update controllers
4. Update tests

### Step 4: Deployment
1. Staging deployment
2. Performance testing
3. Production deployment
4. Monitoring setup

## Benefits

### Performance
- 50-70% reduction in query time
- Better memory utilization
- Improved scalability

### Maintainability
- Cleaner code structure
- Better type safety
- Easier debugging

### Security
- Encrypted sensitive data
- Audit trails
- Access control

### Scalability
- Better indexing
- Optimized queries
- Horizontal scaling support

## Risk Mitigation

### Data Loss Prevention
- Multiple backups
- Migration rollback plan
- Data validation scripts

### Downtime Minimization
- Blue-green deployment
- Feature flags
- Gradual migration

### Performance Impact
- Load testing
- Performance monitoring
- Optimization iterations

## Timeline

- **Phase 1**: 2-3 weeks
- **Phase 2**: 1-2 weeks
- **Phase 3**: 2-3 weeks
- **Phase 4**: 1-2 weeks
- **Testing & Deployment**: 1-2 weeks

**Total**: 7-12 weeks

## Success Metrics

- Query performance improvement
- Data consistency validation
- Security audit compliance
- User experience enhancement
- System reliability improvement 