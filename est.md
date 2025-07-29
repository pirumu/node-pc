| Task                                      | Est (h) |
|-------------------------------------------|---------|
| Research codebase                         | 8       |
| Create basesource                         | 4       |
| **Authentication + Authorization Module** |         |
| Role & Permission, FaceID, Fingerprint    |         |
| api/users/login-by-pin-pass               |         |
| api/users/login-by-password               |         |
| api/users-session/list                    |         |
| api/users/logout                          |         |
| api/users/v2/list                         | **8**   |
| **User Module**                           |         |
| api/users/me                              |         |
| api/users/list                            |         |
| api/users/update-or-create                |         |
| api/users/check-existing                  |         |
| api/users/id/:id                          |         |
| api/users/get-room-shelf                  |         |
| api/users/upload                          |         |
| api/users/download-list-user              |         |
| api/users/download-template               | **6**   |
| **Bin Module**                            |         |
| api/bins/id/:id                           |         |
| api/bins/open/:id                         |         |
| api/bins/open-all                         |         |
| api/bins/active/:id                       |         |
| api/bins/inactive/:id                     |         |
| api/bins/confirm                          |         |
| api/bins/replace-item/:id                 |         |
| api/bins/remove-item/:id                  | **8**   |
| **Device Module**                         |         |
| api/devices/update                        |         |
| api/devices/list-by-app                   |         |
| api/devices/detail                        |         |
| api/devices/list-by-port                  |         |
| api/devices/unassign                      |         |
| api/devices/active                        |         |
| api/devices/add-label                     |         |
| api/devices/remove-label                  | **12**  |
| **Item Module**                           |         |
| api/items/issue                           |         |
| api/items/return                          |         |
| api/items/types                           |         |
| api/items/return/update-wo                |         |
| api/items/replenish                       |         |
| api/items/configure                       |         |
| api/items/upload                          |         |
| api/items/download-list-item              |         |
| api/items/download-template               | **10**  |
| **Transaction Module**                    |         |
| api/transactions/list                     |         |
| api/transactions/detail/:id               |         |
| api/transactions/get-by-shelf             |         |
| api/transactions/download                 |         |
| api/transactions-new/export-csv           |         |
| api/transactions/list (GET)               | **8**   |
| **Card Module**                           |         |
| api/cards/request                         |         |
| api/cards/update-lockable                 |         |
| api/cards/token                           |         |
| api/cards/delete/:cardId                  |         |
| api/cards/create                          | **6**   |
| **Reader Module**                         |         |
| api/readers/pair/:pairingCode             |         |
| api/readers/connect                       |         |
| api/readers/get-infor                     |         |
| api/readers/setup                         | **4**   |
| **Room Module**                           |         |
| api/rooms/create                          |         |
| api/rooms/get/:roomId                     |         |
| api/rooms/update                          |         |
| api/rooms/remove/:roomId                  | **4**   |
| **Shelf Module**                          |         |
| api/shelf/get/:id                         |         |
| api/shelf/get-bins                        |         |
| api/shelf/get-bins-without-reader         |         |
| api/shelf/create                          |         |
| api/shelf/update                          |         |
| api/shelf/delete/:shelfId                 | **4**   |
| **Site Module**                           |         |
| api/sites/list                            |         |
| api/sites/update-or-create                |         |
| api/sites/delete/:id                      |         |
| api/sites/send-report/:id                 | **4**   |
| **Tablet Module**                         |         |
| api/tablets/create                        | **1**   |
| **JobCard Module**                        |         |
| api/job-cards/verify                      |         |
| api/job-cards/list                        | **2**   |
| **Condition Module**                      |         |
| api/conditions/list                       | **1**   |
| **Log Module**                            |         |
| api/log-api/export-csv                    | **1**   |
| **Oauth Module**                          |         |
| api/oauth/revoke/accessToken              | **1**   |
| **Port Module**                           |         |
| api/ports/list                            |         |
| api/ports/update                          |         |
| api/ports/refresh-name                    | **2**   |





## PM2 Worker/Job Migration Estimate (Chỉ các worker thực sự được sử dụng)

| Task (PM2 Job/Worker)                | Script                        | Main Functionality                        | Est (h) | Gọi mặc định/động |
|--------------------------------------|-------------------------------|--------------------------------------------|---------|-------------------|
| Main App (elocker)                   | bin/www                       | Web server, API, socket, core logic        | 8       | Mặc định (ecosystem.config.js) |
| Health Check Worker                  | check-health.js               | Health check, monitoring                   | 1       | Mặc định (ecosystem.config.js) |
| Sync Data Worker                     | syncDataService.js            | Đồng bộ dữ liệu cloud/local                | 4       | Mặc định (ecosystem.config.js), Động (pm2.js) |
| Check Is Live Port Worker            | check-is-live-port.js         | Kiểm tra cổng serial còn sống              | 1       | Mặc định (app.js, pm2.js) |
| Track Connect Loadcell Worker        | trackConnectLoadcellService.js| Theo dõi kết nối loadcell                  | 2       | Mặc định (app.js, pm2.js) |
| Pull Hardwired Data Worker           | HardwiredProcess/index.js     | Đọc dữ liệu cổng cứng (serial)             | 4       | Động (pm2.js, DetectDevice.js, DetectDeviceNewDevice.js) |
| Transaction Worker                   | transactionService.js         | Xử lý giao dịch (v1)                       | 3       | Động (pm2.js) |
| Transaction Worker V2                | transactionServiceV2.js       | Xử lý giao dịch (v2, nhiều logic hơn)      | 4       | Động (pm2.js, app.js) |
| Lock Control Worker                  | openLockService.js            | Điều khiển khoá vật lý                     | 2       | Động (pm2.js, BinController.js) |
| Track Lock Status Worker             | trackLockBinService.js        | Theo dõi trạng thái khoá                   | 2       | Động (pm2.js, bridge.js) |
| Process Item By Request Worker       | processItemByRequest.js       | Xử lý yêu cầu xuất/nhập item động          | 3       | Động (pm2.js) |

