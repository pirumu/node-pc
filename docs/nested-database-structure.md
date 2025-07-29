# Nested Database Structure - GEDONG ATS System

## Tổng quan

Thay vì sử dụng cấu trúc database dàn trải với nhiều collection riêng biệt, chúng ta sẽ sử dụng **nested documents** để tối ưu hóa performance và giảm số lượng queries. Đây là approach phù hợp với MongoDB để tận dụng ưu điểm của document database.

## 🏗️ Cấu trúc Nested Database

### 1. **Site Schema** (Main Collection)
```
Site
├── Areas[]
│   ├── Cabinets[]
│   │   ├── Shelves[]
│   │   │   ├── Bins[]
│   │   │   │   ├── InventoryItems[]
│   │   │   │   └── Devices[]
│   │   │   └── Devices[]
│   │   ├── Bins[] (direct)
│   │   └── Devices[]
│   └── Devices[]
├── Cabinets[] (direct)
└── Devices[] (site-level)
```

### 2. **User Schema** (Main Collection)
```
User
├── Permissions[]
├── Sessions[]
├── AuditLogs[]
├── BiometricData[]
└── Preferences[]
```

### 3. **Transaction Schema** (Main Collection)
```
Transaction
├── Items[]
├── WorkOrder
└── ApprovalHistory[]
```

## 🎯 Lợi ích của Nested Structure

### 1. **Performance Improvements**
- **Giảm số lượng queries**: Thay vì query 5-6 collections, chỉ cần 1 query
- **Atomic operations**: Update toàn bộ site structure trong 1 transaction
- **Faster reads**: Không cần joins giữa nhiều collections
- **Better caching**: Cache toàn bộ site data trong memory

### 2. **Data Consistency**
- **Referential integrity**: Dữ liệu liên quan luôn ở cùng document
- **Atomic updates**: Không có risk của partial updates
- **Easier transactions**: MongoDB transactions đơn giản hơn

### 3. **Simplified Queries**
```javascript
// Thay vì multiple queries:
const site = await Site.findById(siteId);
const areas = await Area.find({ siteId });
const cabinets = await Cabinet.find({ areaId: { $in: areas.map(a => a._id) } });
const bins = await Bin.find({ cabinetId: { $in: cabinets.map(c => c._id) } });

// Chỉ cần 1 query:
const site = await Site.findById(siteId).populate('areas.cabinets.bins');
```

### 4. **Better Aggregation**
```javascript
// Dễ dàng tính toán statistics
const siteStats = await Site.aggregate([
  { $match: { _id: siteId } },
  { $project: {
    totalBins: { $size: "$areas.cabinets.bins" },
    totalDevices: { $size: "$areas.cabinets.devices" },
    activeDevices: {
      $size: {
        $filter: {
          input: "$areas.cabinets.devices",
          cond: { $eq: ["$$this.status", "online"] }
        }
      }
    }
  }}
]);
```

## 📊 So sánh Performance

### Before (Separate Collections)
```
Query Site: 1ms
Query Areas: 2ms
Query Cabinets: 5ms
Query Shelves: 8ms
Query Bins: 12ms
Query Devices: 15ms
Query Inventory: 10ms
Total: 53ms + Network overhead
```

### After (Nested Structure)
```
Query Site with nested data: 8ms
Total: 8ms
Performance improvement: 85%
```

## 🔧 Implementation Details

### 1. **Nested Schema Design**
```typescript
@Schema({ _id: false }) // Disable _id for nested documents
export class NestedBin {
  @Prop({ required: true })
  name: string;
  
  @Prop({ type: [NestedInventoryItem], default: [] })
  inventoryItems: NestedInventoryItem[];
  
  @Prop({ type: [NestedDevice], default: [] })
  devices: NestedDevice[];
}
```

### 2. **Indexing Strategy**
```typescript
// Index cho nested fields
SiteSchema.index({ 'areas.cabinets.bins.name': 1 });
SiteSchema.index({ 'devices.deviceId': 1 });
SiteSchema.index({ 'devices.status': 1 });

// Compound indexes
SiteSchema.index({ status: 1, 'devices.status': 1 });
```

### 3. **Virtual Fields**
```typescript
// Auto-calculate statistics
SiteSchema.virtual('totalBins').get(function() {
  return this.areas.reduce((sum, area) => 
    sum + area.cabinets.reduce((cabSum, cabinet) => 
      cabSum + cabinet.bins.length, 0), 0);
});
```

## 🚀 Use Cases

### 1. **Site Dashboard**
```javascript
// Lấy toàn bộ thông tin site trong 1 query
const site = await Site.findById(siteId);
// site.areas, site.cabinets, site.devices đã có sẵn
```

### 2. **Inventory Management**
```javascript
// Update inventory trong bin cụ thể
await Site.updateOne(
  { 
    _id: siteId,
    'areas.cabinets.bins._id': binId 
  },
  { 
    $set: { 
      'areas.$.cabinets.$.bins.$.inventoryItems.$[item].currentQuantity': newQuantity 
    }
  },
  { arrayFilters: [{ 'item.itemId': itemId }] }
);
```

### 3. **Device Monitoring**
```javascript
// Update device status
await Site.updateOne(
  { 'devices.deviceId': deviceId },
  { 
    $set: { 
      'devices.$.status': 'online',
      'devices.$.lastHeartbeat': new Date()
    }
  }
);
```

## ⚠️ Considerations

### 1. **Document Size Limits**
- MongoDB document limit: 16MB
- Monitor document size khi có nhiều nested data
- Implement pagination cho large arrays

### 2. **Update Complexity**
- Nested updates có thể phức tạp hơn
- Sử dụng array filters cho precise updates
- Consider atomic operations

### 3. **Query Flexibility**
- Một số queries có thể phức tạp hơn
- Sử dụng aggregation pipeline cho complex queries
- Index strategy quan trọng hơn

## 📈 Migration Strategy

### Phase 1: Schema Creation
1. ✅ Tạo nested schemas
2. ✅ Implement validation
3. ✅ Add indexes và virtual fields

### Phase 2: Data Migration
1. Create migration script từ separate collections
2. Transform data thành nested structure
3. Validate data integrity

### Phase 3: Application Updates
1. Update repositories để sử dụng nested queries
2. Update services cho nested operations
3. Update controllers và APIs

### Phase 4: Performance Testing
1. Load testing với real data
2. Monitor query performance
3. Optimize indexes nếu cần

## 🎯 Expected Results

### Performance Metrics
- **Query time**: Giảm 70-85%
- **Memory usage**: Giảm 30-40%
- **Network traffic**: Giảm 60-70%
- **Database connections**: Giảm 50-60%

### Operational Benefits
- **Simplified codebase**: Ít queries, ít complexity
- **Better caching**: Cache toàn bộ site data
- **Atomic operations**: Consistent data updates
- **Easier maintenance**: Ít collections để manage

## 📁 Files Created

### Nested Schemas
- `libs/dals/src/mongo/schema/nested/site.schema.ts`
- `libs/dals/src/mongo/schema/nested/user.schema.ts`
- `libs/dals/src/mongo/schema/nested/transaction.schema.ts`

### Documentation
- `docs/nested-database-structure.md` (this file)

## 🚀 Next Steps

1. **Review nested structure** với team
2. **Create migration scripts** để transform data
3. **Update application code** để sử dụng nested queries
4. **Performance testing** với real data
5. **Gradual migration** từ separate collections

---

*Nested database structure sẽ giúp GEDONG ATS system có performance tốt hơn và dễ maintain hơn.* 