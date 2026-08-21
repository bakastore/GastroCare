# GastroCare — Clinical Workflow Baseline

Cập nhật: 2026-08-21

```
STATUS: ASSUMED BASELINE FOR BUILD
```

Toàn bộ nội dung dưới đây là **Working Product Hypothesis**, đúc kết từ Synthetic Discovery Baseline v0.1 (xem `00_PROJECT_OVERVIEW.md` — Existing Project Assets). Không giả vờ đã được BS Thái xác nhận. Sẽ được thay bằng evidence thật qua Discovery Round 1 với BS Thái sau khi có sản phẩm để quan sát (P-06, Build → Observe → Correct); hướng dẫn thực hiện Discovery Round 1 cụ thể chưa tồn tại trong repository hiện tại và sẽ được bổ sung khi cần, không phải điều kiện để bắt đầu build.

## Tình huống vận hành giả định

Phòng khám tiêu hóa tư nhân nhỏ: 1 bác sĩ chính, 1 lễ tân, ~20-25 lượt khám/ngày, mỗi lượt 10-20 phút, dữ liệu hiện rải rác giữa giấy/đơn thuốc/kết quả nội soi/Zalo/trí nhớ, bác sĩ quyết định chẩn đoán/thuốc/xét nghiệm/tái khám, nhân viên hỗ trợ hành chính. v0.1 nhập liệu thủ công hoàn toàn.

## AS-IS Workflow (giả định)

```
Bệnh nhân đến phòng khám
        ↓
Lễ tân xác định bệnh nhân mới/cũ
        ↓
BS Thái tiếp nhận
        ↓
Hỏi lý do khám + triệu chứng hiện tại
        ↓
Hỏi tiền sử / thuốc / thông tin liên quan
        ↓
Xem kết quả xét nghiệm/nội soi/hình ảnh nếu có
        ↓
Ghi chú thông tin cần nhớ
        ↓
Đưa ra Assessment (đánh giá)
        ↓
Quyết định điều trị / xét nghiệm / thủ thuật
        ↓
Dặn bệnh nhân, đặt lịch tái khám nếu cần
        ↓
Bệnh nhân về
        ↓
Follow-up phụ thuộc: trí nhớ / giấy / lịch hẹn / Zalo / bệnh nhân tự quay lại
```

**Điểm đứt gãy quan trọng nhất:** ngay sau "Bệnh nhân về" — đây là nơi GastroCare phải tạo giá trị (liên kết với Working Product Hypothesis tại `00_PROJECT_OVERVIEW.md`).

## Pain Point Map (bản đồ điểm đau)

| Pain point | Bước | Mức độ | Ý nghĩa sản phẩm |
|---|---|---:|---|
| Lịch sử bệnh nhân phân tán | đầu lượt khám | Cao | cần Patient Timeline |
| Không nhìn ngay lần trước đã điều trị gì | tái khám | Cao | cần Encounter + CarePlan |
| Follow-up phụ thuộc trí nhớ | sau khám | Cao | cần CarePlan.followUpDate → CareTask |
| Bệnh nhân cần tái khám nhưng không quay lại | sau khám | Cao | cần Overdue Queue |
| Phải hỏi lại thông tin đã có | đầu lượt khám | Vừa/Cao | dữ liệu phải tái sử dụng |
| Ghi quá nhiều làm chậm khám | trong khám | Cao | form phải rất ngắn |
| Nhập cùng thông tin nhiều nơi | trong/sau khám | Cao | single source of truth (P-10) |
| Không biết bệnh nhân đang ở giai đoạn nào | theo dõi dài hạn | Cao | cần CareEpisode |
| Không có danh sách "việc hôm nay" | vận hành | Cao | cần CareTask Queue |

## Information Map (bản đồ thông tin)

Nguyên tắc P-04: field chỉ vào form nếu biết ai tạo, lúc nào, vì sao, ai dùng lại.

| Thông tin | Phân loại | Ai tạo | Khi nào | Ai dùng lại |
|---|---|---|---|---|
| Họ tên, năm sinh, giới tính, SĐT | MUST | lễ tân | đăng ký | toàn hệ thống + matching signal (xem `04_CORE_DOMAIN_MODEL.md` — Patient) |
| Lý do khám, triệu chứng chính | MUST | bác sĩ | Encounter | lần khám hiện tại/sau |
| Tiền sử quan trọng, dị ứng | MUST | bác sĩ | khi biết | mọi lần khám sau |
| Assessment, Clinical Note | MUST | bác sĩ | cuối khám | Timeline/CarePlan |
| Thuốc/hướng dẫn điều trị | MUST | bác sĩ | CarePlan | bệnh nhân/bác sĩ |
| Follow-up date | MUST nếu có | bác sĩ | CarePlan | CareTask |
| Warning signs (dấu hiệu cảnh báo) | SHOULD | bác sĩ | CarePlan | bệnh nhân (free-text v0.1) |
| Xét nghiệm/thủ thuật chỉ định | SHOULD | bác sĩ | Plan | follow-up |
| File nội soi/xét nghiệm | SHOULD | bác sĩ/nhân viên | khi có | tái khám |
| Nghề nghiệp, địa chỉ chi tiết | NICE | nhân viên | đăng ký | khi cần |
| Thông tin hành chính khác | NOISE v0.1 | — | — | chưa cần |

## Follow-up Map

| Sự kiện | Hiện tại giả định | Có thể bỏ sót? | GastroCare v0.1 |
|---|---|---:|---|
| Tái khám sau N ngày | bác sĩ dặn bệnh nhân | Cao | tạo CarePlan.followUpDate → CareTask |
| Theo dõi sau điều trị | không có queue tập trung | Cao | Follow-up Queue |
| Bệnh nhân quá hạn | khó nhận biết | Cao | OVERDUE (derived state trên CareTask, xem `04_CORE_DOMAIN_MODEL.md`) |
| Dấu hiệu cảnh báo | dặn miệng | Vừa | lưu trong CarePlan |

## Synthetic Case — dùng xuyên suốt mọi tài liệu và schema

**Nguyễn Văn Minh, 42 tuổi.** Đau thượng vị 6 tuần, đầy bụng, ợ nóng, không nôn máu, không phân đen.

```
21/08 — Khám lần đầu
  Assessment: theo dõi viêm dạ dày / GERD
  Plan: điều trị theo đơn, tái khám 14 ngày
  → CareTask: FOLLOW_UP, due 05/09

05/09 — Tái khám
  Triệu chứng giảm rõ, không còn đau khi đói
  → CareTask cũ: COMPLETED
  → Timeline: 21/08 Initial Visit → 05/09 Follow-up
```

Case này là input trực tiếp cho `04_CORE_DOMAIN_MODEL.md` (DOMAIN CANDIDATE).
