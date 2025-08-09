Nghiệp vụ
- load-cell sẽ được tự động đăng ký -> device khi nào.
-  auto register.

- khi chọn item cần issue/return cần những điều kiện gì và expect kết quả sao.
 - issue: 
    - item type: 
    - [consumable- issue+ rep]
    - [non- issue + return + rep]: có thể.
   
 - tìm bin gần nhất. open -> lấy item -> close -> next
 - tx log: 
   - cluster: 
     - bin
     - <Cluster Name>-<Cabinet Name>, <row>-<bin>. 
     - lưu lại input. state thực tế (lấy thừa / thiếu).
     - lấy đủ show thành công, lấy thiếu show warning.

- lấy item - link với bin. 
- calibrationDue + expiryDate: quá hạn k show (issue list).

- working-order có chức năng gì.
   - wo: optional. không ảnh hưởng đến flow issue/return/reph.
  
- condition để làm gì. 
   - apply cho nhóm [consumable,non-issue], đánh giấu trạng thái cho item.

Tech:
- 1 hệ thống chạy có tối đa bao nhiêu item, bin, cabinet, device.
 1 cabinet -> 20 bin. -> 20 loadcell. 4 port * 24 -> max 96 loadcells.

- client giao tiếp hết qua websocket có được không.


expect:
 - issue.
 - return.
 - 
