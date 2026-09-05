**GASTROCARE**

**DEC-021**

**TÁI THIẾT LẬP CÓ CHỌN LỌC  
QUY TRÌNH LÂM SÀNG BỆNH TRĨ**

*Hemorrhoid Clinical Workflow Selective Rebaseline*

**Trạng thái:** OWNER LOCKED — 06/09/2026  
**Phiên bản:** v0.3 — OWNER LOCKED  
**Ngày:** 05/09/2026  
**Loại quyết định:** Selective supersession / clarification /
requirement reconciliation  
**Quyền triển khai:** DEC-021 Owner Lock đã hoàn tất; Package R Contract v0.5 FINAL đã OWNER LOCKED; application implementation vẫn CHƯA ĐƯỢC AUTHORIZE

Lưu ý quản trị  
DEC-021 không phủ nhận toàn bộ DEC-020 và không thiết kế lại toàn bộ
GastroCare.  
DEC-021 chỉ thay thế phần được nêu rõ là SUPERSEDE, làm rõ phần CLARIFY
và ghi nhận requirement mới.  
Mọi nội dung PRESERVE tiếp tục tham chiếu DEC-020 để tránh trùng SSOT.  
Bản v0.3 cập nhật trạng thái repository sau correction PR \#12 và đã được Owner LOCK ngày 06/09/2026.

# POST-LOCK OWNER DECISION OVERLAY — 06/09/2026

1. `OWNER LOCK DEC-021 v0.3` — completed.
2. Structured Treatment Activation được Owner chấp nhận ở mức định hướng khái niệm; schema, migration, transaction boundary và historical-data policy được khóa tại Package R Implementation Contract trước implementation.
3. NR-01 Package R v1: `DOCTOR + NURSE` được phép `contact-attempt` và `lost-to-follow-up`; `RECEPTIONIST` không được mở hai action này.
4. Package R Implementation Contract v0.5 FINAL = `OWNER LOCKED`; application implementation vẫn **CHƯA ĐƯỢC AUTHORIZE**.
5. Package B Contract cũ tiếp tục `HOLD / T0 NOT OPEN` cho tới khi Package R đóng và Package B Contract được reconcile.

# TÓM TẮT QUYẾT ĐỊNH

DEC-021 áp dụng phương án tái thiết lập có chọn lọc (selective
rebaseline), không phải viết lại toàn bộ DEC-020. Phần thay đổi ngữ
nghĩa thực sự tập trung vào D20-02 và một phần D20-03; các phần còn lại
chủ yếu được giữ nguyên hoặc làm rõ để triển khai đúng bằng chứng mới.

THAY ĐỔI CHÍNH v0.3  
• Đóng blocker PR \#12 theo trạng thái repo đã được Codex verify.  
• Khóa NR-06 thành NOW — LIGHTWEIGHT ONLY.  
• Yêu cầu deterministic mapping CLOSED/CANCELLED cho D20-03 trong
Contract.  
• Chuyển lỗi copy/paste Q11 thành editorial non-blocking; cleanup ở
evidence packaging.  
• Bổ sung Owner Decision block để chốt rõ Owner Lock và next governance
gate.  
• Khóa Domain Linkage Contract Requirement: treatment-domain association
phải explicit/machine-checkable; không suy luận từ free-text Diagnosis
hoặc same Encounter.

| **Hạng mục**                                | **Kết luận hiện tại**                                                                                                                             |
|---------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| D20-02 — Bắt đầu CareEpisode                | SUPERSEDE                                                                                                                                         |
| D20-03 — Đóng Episode và CareTask tương lai | PARTIAL SUPERSEDE + CLARIFY                                                                                                                       |
| D20-01, D20-04, D20-05, D20-08, D20-10      | PRESERVE + CLARIFY                                                                                                                                |
| D20-06, 07, 09, 11, 12, 13                  | PRESERVE                                                                                                                                          |
| Requirement mới                             | 7 mục, có phân loại NOW/DEFERRED                                                                                                                  |
| Package A                                   | Vẫn OWNER CLOSED; chỉ reopen có phạm vi cho D20-02/D20-03 và phần bị tác động trực tiếp                                                           |
| Independent verification                    | Codex focused audit bắt buộc cho correction D20-02/D20-03                                                                                         |
| Repository readiness                        | PASS — PR \#12 đã disposition UNINTENTIONAL và correction hoàn tất; local main = origin/main; working tree CLEAN; Package B cũ HOLD / T0 NOT OPEN |

# MỤC LỤC NỘI DUNG

> **•** 1. Mục đích
>
> **•** 2. Nguyên tắc quản trị
>
> **•** 3. Thẩm quyền và bằng chứng
>
> **•** 4. Bảng selective supersession
>
> **•** 5. D20-02 — Bắt đầu CareEpisode
>
> **•** 6. D20-03 — Đóng Episode
>
> **•** 7. D20-01 — Làm rõ vòng đời Encounter
>
> **•** 8. D20-04 — Làm rõ chẩn đoán
>
> **•** 9. D20-05 — Làm rõ thẩm quyền System/IT Admin
>
> **•** 10. D20-08 — Làm rõ điều trị/phẫu thuật
>
> **•** 11. D20-10 — Làm rõ follow-up
>
> **•** 12. Requirement mới
>
> **•** 13. Mở lại có phạm vi Package A
>
> **•** 14. Phân tích tác động bắt buộc
>
> **•** 15. Yêu cầu đối với Implementation Contract
>
> **•** 16. Quản trị triển khai và xác minh
>
> • 17. Trạng thái repository — blocker đã đóng
>
> **•** 18. Ngoài phạm vi
>
> **•** 19. Vệ sinh nguồn bằng chứng
>
> • 20. Checklist sẵn sàng Owner Lock
>
> **•** 21. Kết luận quản trị cuối cùng

• 22. Owner Decision / Authorization

# 1. MỤC ĐÍCH

DEC-021 cập nhật baseline quy trình lâm sàng của GastroCare dựa trên bộ
bằng chứng nghiệp vụ mới thu thập từ BS Thái và các quyết định phạm vi
sản phẩm do Owner xác nhận.

DEC-021 không thay thế toàn bộ tư duy của DEC-020 và không thiết kế lại
toàn bộ hệ thống. Tài liệu này chỉ thực hiện các việc sau:

> **1.** Thay thế đúng những quyết định trong DEC-020 đã bị bằng chứng
> mới phủ định.
>
> **2.** Làm rõ những quyết định vẫn đúng nhưng cần đặc tả cụ thể hơn để
> triển khai không suy diễn.
>
> **3.** Ghi nhận các requirement mới phát hiện trong phỏng vấn.
>
> **4.** Giữ nguyên các quyết định còn đúng bằng reference, không sao
> chép lại SSOT.
>
> **5.** Xác định chính xác phạm vi Package A cần correction và phần vẫn
> tiếp tục OWNER CLOSED.
>
> 6\. Khóa lại baseline trước khi xác lập execution gate mới; không tự
> động mở lại Package B T0 theo Contract cũ.

# 2. NGUYÊN TẮC QUẢN TRỊ

## 2.1. Quy tắc xử lý bằng chứng mới

**QUY TẮC  
**Bằng chứng hoặc chi tiết mới không làm mất hiệu lực một quyết định
hiện hành trừ khi nó thay đổi trọng yếu: ngữ nghĩa (semantics), bất biến
(invariant), thẩm quyền (authority), chuyển trạng thái (state
transition) hoặc hành vi quan sát được từ bên ngoài (externally
observable behavior).  
Nếu không thay đổi các yếu tố trên, nội dung mới phải được phân loại là
CLARIFICATION hoặc IMPLEMENTATION DETAIL, không phải SUPERSESSION.

## 2.2. Không tạo SSOT trùng lặp

DEC-021 không sao chép toàn văn các quyết định DEC-020 vẫn còn hiệu lực.
Nội dung PRESERVE phải tham chiếu về DEC-020. DEC-021 chỉ chứa nội dung
thật sự mới, nội dung bị supersede, clarification, requirement mới, tác
động triển khai và disposition quản trị.

## 2.3. Ý nghĩa các trạng thái quyết định

| **Trạng thái**     | **Ý nghĩa**                                                                         |
|--------------------|-------------------------------------------------------------------------------------|
| PRESERVE           | Quyết định DEC-020 tiếp tục có hiệu lực nguyên trạng.                               |
| PRESERVE + CLARIFY | Quyết định gốc vẫn đúng; DEC-021 chỉ làm rõ để triển khai hiểu đúng.                |
| SUPERSEDE          | Phần quyết định cũ không còn hiệu lực; DEC-021 trở thành authority mới cho phần đó. |
| NEW REQUIREMENT    | Yêu cầu mới được ghi nhận; chưa mặc nhiên được phép triển khai ngay.                |
| DEFER              | Yêu cầu được công nhận nhưng implementation không thuộc scope hiện tại.             |

# 3. THẨM QUYỀN VÀ BẰNG CHỨNG

Nguồn bằng chứng nghiệp vụ chính: “GastroCare — Bộ phỏng vấn nghiệp vụ
BS Thái theo ca bệnh thực tế”, bản cập nhật ngày 05/09/2026. Bản này bao
gồm các câu hỏi chính và câu hỏi bổ sung, trong đó câu bổ sung 11 và 12
tái xác nhận trực tiếp D20-02 và D20-03 bằng kịch bản thực tế.

Các evidence có ảnh hưởng trực tiếp tới DEC-021 gồm:

> **•** Thời điểm thực tế bắt đầu một đợt điều trị.
>
> **•** Trường hợp khám nhưng chưa bắt đầu điều trị.
>
> **•** Bệnh nhân từ chối toàn bộ điều trị.
>
> **•** Episode closure và disposition CareTask tương lai.
>
> **•** Explicit Start/End Encounter và Doctor handover.
>
> **•** Lost to Follow-up.
>
> **•** Duplicate Patient / Controlled Merge.
>
> **•** Prescription correction sau khi đã phát hành.
>
> **•** Ghi nhận kỹ thuật phẫu thuật và ê-kíp mổ.
>
> **•** Longo follow-up và chuỗi thủ thuật lặp lại.
>
> **•** Ranh giới clinical authority và System/IT Admin.

Owner đã xác nhận thêm về phạm vi sản phẩm: Longo là phương pháp phẫu
thuật mặc định của BS Thái và là surgical pathway duy nhất cần deep
workflow trong phase hiện tại; các kỹ thuật khác được phép ghi nhận đúng
tên nhưng không có deep workflow riêng. IRC và RFA là hai kỹ thuật riêng
biệt.

DEC-021 chỉ trở thành locked authority sau khi Owner phê duyệt.

Bằng chứng readiness repository: Fresh Codex independent read-only audit
ngày 05/09/2026 kết luận READY FOR DEC-021; branch main, HEAD =
origin/main = 27500091f268b97d7abd9b59afa1e2c2d6d72f7a; working tree
CLEAN; BLOCKERS = NONE.

# 4. BẢNG SELECTIVE SUPERSESSION

| **Mục DEC-020**                           | **Disposition trong DEC-021** |
|-------------------------------------------|-------------------------------|
| D20-01 — Encounter lifecycle              | PRESERVE + CLARIFY            |
| D20-02 — CareEpisode creation/start       | SUPERSEDE                     |
| D20-03 — Episode closure / open CareTasks | PARTIAL SUPERSEDE + CLARIFY   |
| D20-04 — Diagnosis                        | PRESERVE + CLARIFY            |
| D20-05 — Amendment / authority            | PRESERVE + CLARIFY            |
| D20-06 — Hemorrhoid examination           | PRESERVE                      |
| D20-07 — Investigation                    | PRESERVE                      |
| D20-08 — Treatment decision               | PRESERVE + CLARIFY SURGERY    |
| D20-09 — Procedure                        | PRESERVE                      |
| D20-10 — Follow-up                        | PRESERVE + CLARIFY            |
| D20-11 — Instructions / warning signs     | PRESERVE                      |
| D20-12 — Functional UX                    | PRESERVE                      |
| D20-13 — AI clinical boundaries           | PRESERVE                      |

Mọi phần DEC-020 không bị DEC-021 tuyên bố SUPERSEDE một cách tường minh
tiếp tục giữ nguyên thẩm quyền.

# 5. D20-02 — BẮT ĐẦU CAREEPISODE

## 5.1. Quy tắc cũ — SUPERSEDED

Quy tắc cũ cho rằng Initial Encounter luôn có episodeId = null và
CareEpisode chỉ được tạo hoặc resolve ở Return Encounter đầu tiên không
còn phù hợp với workflow đã được BS Thái tái xác nhận. Phần quy tắc này
bị thay thế.

## 5.2. Ngữ nghĩa mới có thẩm quyền

CareEpisode bắt đầu tại Encounter nơi treatment pathway thực sự được
kích hoạt. Việc Encounter đó là Initial hay Return không quyết định
Episode có tồn tại hay không; điều quyết định là một trigger điều trị
hợp lệ đã xuất hiện hay chưa.

## 5.3. Quy tắc liên kết domain

**DOMAIN LINKAGE RULE  
**Trigger 1, Trigger 2 và Trigger 3 chỉ có hiệu lực khi action đó được
gắn với clinical problem / treatment plan thuộc treatment domain sẽ sở
hữu CareEpisode đang xét.  
Prescription, treatment order, procedure order hoặc follow-up không liên
quan phát sinh trong cùng Encounter KHÔNG được dùng để kích hoạt
CareEpisode này.  
Hệ thống không được suy luận mối liên quan chỉ vì các action cùng xuất
hiện trong một Encounter. Nếu association không xác định được từ dữ liệu
hoặc explicit clinical action, hệ thống không được tự tạo Episode.  
Same Encounter ≠ same treatment domain.

**Implementation constraint:** Quan hệ “cùng treatment domain” phải được
biểu diễn bằng dữ liệu hoặc explicit clinical action có thể kiểm tra
được. Diagnosis free-text, cùng Encounter hoặc gần nhau về thời gian
không đủ để chứng minh association.

## 5.4. Ba trigger có thể kiểm tra bằng máy

### Trigger 1 — Điều trị bằng thuốc

Bác sĩ phát hành prescription/y lệnh thuốc thuộc treatment plan của
clinical problem đang xét và có thời hạn hoặc kế hoạch điều trị cụ thể.
Thuốc không liên quan không được kích hoạt CareEpisode này.

Ví dụ:  
Khám trĩ + kê paracetamol cho đau đầu không liên quan → KHÔNG tạo
CareEpisode trĩ.  
Khám trĩ + kê thuốc được xác định thuộc treatment plan trĩ → Trigger 1
hợp lệ.

### Trigger 2 — Chỉ định thủ thuật/phẫu thuật có hiệu lực

Bác sĩ phát hành một treatment order có hiệu lực cho procedure hoặc
surgery thuộc clinical problem/treatment plan đang xét.

**PHÂN BIỆT BẮT BUỘC  
**Đề xuất của bác sĩ ≠ lựa chọn/đồng thuận của bệnh nhân ≠ điều trị thực
tế đã thực hiện.  
Mere proposal không tạo Episode. Ví dụ: “Tôi khuyên mổ Longo nhưng bệnh
nhân chưa đồng ý và về suy nghĩ” chỉ là Doctor proposed treatment, chưa
phải active treatment order.

### Trigger 3 — Treatment-linked Follow-up

Bác sĩ tạo Follow-up Task/lịch tái khám gắn với một treatment decision
đang có hiệu lực, ví dụ đánh giá đáp ứng sau điều trị nội khoa, theo dõi
sau thủ thuật hoặc tái khám hậu phẫu.

Các task sau KHÔNG được coi là Episode trigger:

> **•** Reminder hành chính.
>
> **•** Nhắc gọi điện cho bệnh nhân.
>
> **•** Nhắc bệnh nhân liên hệ lại khi thay đổi quyết định.
>
> **•** “Quay lại khi anh/chị quyết định điều trị”.
>
> **•** Generic surveillance không gắn treatment.
>
> **•** Scheduling placeholder.
>
> **•** Non-clinical reminder.

CareTask exists ≠ CareEpisode must exist  
Treatment-linked CareTask → có thể là Trigger 3 hợp lệ

## 5.5. Scenario A — chỉ khám/tư vấn

Bệnh nhân được khám, chẩn đoán và tư vấn ăn uống/sinh hoạt; không kê
thuốc, không có treatment order và không có treatment-linked follow-up.

Encounter = CLOSED  
CareEpisode = NONE

Đây là một lượt khám hoàn chỉnh nhưng không phải treatment Episode.

## 5.6. Scenario B — Initial Encounter bắt đầu điều trị

Bệnh nhân lần đầu được khám, chẩn đoán, kê thuốc 2 tuần và có kế hoạch
tái khám để đánh giá đáp ứng.

Initial Encounter  
↓ treatment trigger  
CareEpisode = ACTIVE

Episode đã tồn tại ngay từ Encounter này. Nếu bệnh nhân sau đó không bao
giờ quay lại, Episode vẫn đã từng tồn tại và không được xóa hồi tố hoặc
coi như chưa từng có.

## 5.7. Scenario C — đã chẩn đoán nhưng chưa bắt đầu điều trị

Lần khám thứ nhất: bác sĩ chẩn đoán và đề xuất phẫu thuật, bệnh nhân
chưa đồng ý và về suy nghĩ, chưa có treatment order có hiệu lực.

Encounter 1 = CLOSED  
CareEpisode = NONE

Có thể tồn tại non-treatment reminder để liên hệ lại; reminder này không
tạo Episode. Khi bệnh nhân quay lại và bắt đầu điều trị ở Encounter 2,
CareEpisode được tạo tại Encounter 2. Evidence của Encounter 1 có thể
được reference/link mà không sửa lịch sử Encounter 1.

## 5.8. Single-active-Episode invariant

**BẤT BIẾN  
**Đối với cùng một bệnh nhân và cùng hemorrhoid treatment domain: tối đa
01 CareEpisode ở trạng thái ACTIVE.  
Nếu phát hiện \> 1 ACTIVE hemorrhoid CareEpisode, đây là DATA/WORKFLOW
CONFLICT, không phải trạng thái lâm sàng hợp lệ.  
Hệ thống phải dừng automatic resolution, cảnh báo và yêu cầu xử lý rõ
ràng; không heuristic auto-select và không silently merge.

# 6. D20-03 — ĐÓNG EPISODE VÀ CARETASK TƯƠNG LAI

## 6.1. Phần quy tắc cũ bị thay thế

Quy tắc “đóng Episode không cancel hoặc dispose các CareTask tương lai”
không còn là hành vi mặc định. Phần này của D20-03 bị supersede. Các
nguyên tắc khác của D20-03 về Doctor authority, explicit closure và
reopen/new Episode được giữ nguyên nếu không bị DEC-021 chỉ định khác.

## 6.2. Hành vi mới khi đóng Episode

Khi bác sĩ chọn “Kết thúc đợt điều trị”, hệ thống phải xác định các
future CareTask/appointment thuộc Episode và hiển thị một confirmation
action duy nhất. Sau khi bác sĩ xác nhận:

Episode → CLOSED  
Future Episode-linked CareTasks → terminal disposition CLOSED/CANCELLED
theo loại task, được khóa deterministic trong Implementation Contract.

Không bắt bác sĩ mở và xử lý từng CareTask riêng.

QUY TẮC DETERMINISTIC  
Implementation Contract phải định nghĩa mapping terminal status theo
từng loại CareTask/appointment; implementer không được tự chọn CLOSED
hay CANCELLED. Mọi task bị disposition do Episode closure phải giữ
reason = EPISODE_CLOSED, actor, timestamp và không hard-delete.

## 6.3. Không có hành vi phá hủy âm thầm

“Automatic” trong DEC này có nghĩa là hệ thống tự áp dụng disposition đã
thống nhất sau một lần xác nhận của bác sĩ; không có nghĩa là silent
background deletion.

## 6.4. Audit tối thiểu

BS Thái không yêu cầu UI phải hiển thị lịch sử hủy chi tiết cho từng
lịch hẹn bị đóng cùng Episode. Tuy nhiên CareTask không được
hard-delete. Hệ thống phải giữ tối thiểu:

> **•** Final status.
>
> **•** Disposition reason = EPISODE_CLOSED.
>
> **•** Actor.
>
> **•** Timestamp.

## 6.5. Ngoại lệ theo dõi dài hạn

Annual surveillance, long-term reminder hoặc preventive monitoring không
còn thuộc treatment Episode đã hoàn tất phải được tách khỏi Episode hoặc
tạo trong independent surveillance context. Không treo các task này vào
Episode đã CLOSED.

# 7. D20-01 — LÀM RÕ VÒNG ĐỜI ENCOUNTER

D20-01 được PRESERVE. Evidence mới chỉ làm rõ cách implementation phải
biểu hiện lifecycle.

## 7.1. Tiếp đón không phải thời điểm bắt đầu khám

Lễ tân có thể tiếp nhận, tạo/chọn patient, chọn bác sĩ, chọn phòng, nhập
lý do khám và thực hiện administrative workflow. Những hành động này
không đồng nghĩa clinical examination đã bắt đầu.

## 7.2. Bác sĩ bắt đầu khám tường minh

Encounter phải hỗ trợ nút “Bắt đầu khám”. Clinical examination start
time lấy từ action này, không lấy thời điểm lễ tân tạo record.

## 7.3. Bác sĩ kết thúc khám tường minh

Bác sĩ là người xác nhận “Kết thúc khám”. Encounter
completion/finalization tiếp tục thuộc clinical authority của Doctor.

## 7.4. Tham gia và bàn giao bác sĩ

Encounter phải thể hiện được clinicians đã tham gia, responsible
clinician, explicit handover/authorization, receiving Doctor và
continuation của cùng Encounter. Receiving Doctor sử dụng
identity/account của chính mình; lịch sử người trước không bị overwrite.

## 7.5. Trợ lý nhập hộ

Assistant có thể hỗ trợ nhập dữ liệu theo quyền phù hợp. Bác sĩ trực
tiếp khám vẫn là người review/finalize clinical content theo workflow đã
xác nhận.

# 8. D20-04 — LÀM RÕ CHẨN ĐOÁN

D20-04 được PRESERVE. DEC-021 không bắt buộc redesign cấu trúc Diagnosis
trong phase này.

Bác sĩ phải có thể ghi nhiều chẩn đoán rõ ràng, ví dụ:

Trĩ nội độ III  
Nứt kẽ hậu môn mạn tính

Có thể triển khai bằng free-text/multi-line UX nếu đáp ứng workflow.
DEC-021 không tự authorize Diagnosis entity migration, ICD-per-diagnosis
schema hoặc insurance coding workflow. ICD tiếp tục DEFER trừ khi có
Owner Decision riêng.

# 9. D20-05 — LÀM RÕ THẨM QUYỀN SYSTEM/IT ADMIN

D20-05 được PRESERVE và bổ sung authority boundary cho System/IT Admin.

## 9.1. System/IT Admin không có clinical authority

System Administrator / IT Administrator KHÔNG ĐƯỢC:

> **•** Sửa trực tiếp chẩn đoán.
>
> **•** Sửa điều trị.
>
> **•** Sửa nội dung đơn thuốc.
>
> **•** Sửa clinical findings.
>
> **•** Thay thế clinical judgment của bác sĩ.
>
> **•** Dùng technical privilege thay cho clinical authority.

System/IT Admin có thể thực hiện infrastructure operations, quản lý
account/permission theo governance, hỗ trợ technical recovery và audited
unlock khi có authority phù hợp. Technical access không tạo clinical
authority.

## 9.2. Scope tương lai

Việc ghi nhận authority boundary này không tự động đưa SystemAdminUser
vào implementation scope hiện tại. Nếu vai trò này được mở scope sau
này, implementation phải tuân thủ boundary nêu trên.

# 10. D20-08 — LÀM RÕ ĐIỀU TRỊ / PHẪU THUẬT

D20-08 treatment model được PRESERVE. Tiếp tục giữ tách biệt:

Doctor proposal ≠ Patient choice/consent ≠ Actual treatment performed

Không overwrite lịch sử khi treatment decision thay đổi.

## 10.1. Longo là mặc định và deep workflow duy nhất

Đối với BS Thái, LONGO là phương pháp phẫu thuật mặc định và là surgical
pathway duy nhất có deep workflow trong current scope. Deep workflow có
thể gồm pre-operative workflow, Longo-specific documentation,
postoperative workflow và Longo-specific follow-up automation.

## 10.2. Kỹ thuật khác được ghi nhận nhưng không có automation riêng

Các kỹ thuật khác được phép hiển thị, lựa chọn hoặc ghi nhận đúng tên
thực tế đã thực hiện, ví dụ:

> **•** Milligan–Morgan.
>
> **•** Ferguson.
>
> **•** HAL-RAR.
>
> **•** IRC — Infrared Coagulation (quang đông hồng ngoại).
>
> **•** RFA — Radiofrequency Ablation (đốt sóng cao tần).
>
> **•** Other.

Các kỹ thuật này không tự động tạo specialized CarePlan, specialized
forms, technique-specific workflow hoặc follow-up automation. Follow-up
có thể dùng Core CareTask/manual workflow.

**PHÂN BIỆT PHẠM VI  
**RECORDABLE / SELECTABLE ≠ DEEP-WORKFLOW SUPPORTED

## 10.3. Thuật ngữ IRC và RFA

IRC và RFA là hai kỹ thuật riêng biệt. Không sử dụng cách ghi gộp
“IRC/RFA” hoặc “quang đông hồng ngoại RFA” khi dùng như tên kỹ thuật.

# 11. D20-10 — LÀM RÕ FOLLOW-UP

D20-10 architecture được PRESERVE. Follow-up phải đủ linh hoạt để biểu
diễn absolute date, relative interval, event-based follow-up,
symptom-triggered return, early/late/unplanned return, completion trực
tiếp hoặc từ xa, cancellation và Lost to Follow-up.

## 11.1. Không suy luận cứng

Hệ thống không được tự suy ra mọi Encounter tương lai đều thuộc
follow-up cũ chỉ vì thời gian gần nhau. Early/late/unplanned Encounter
phải có linkage rõ ràng.

## 11.2. Lịch Longo

Longo có thể có suggested follow-up schedule. Các mốc là clinical
configuration/template, không phải architectural invariant. DEC-021
không hard-code tháng 6 thành mốc bắt buộc tuyệt đối cho mọi ca nếu
evidence thực tế còn cho thấy lịch có thể thay đổi theo bệnh nhân.

# 12. REQUIREMENT MỚI

Requirement được ACCEPTED không đồng nghĩa implementation được tự động
authorize. Mỗi requirement phải có scope disposition rõ.

## NR-01 — LOST TO FOLLOW-UP

Decision: ACCEPTED \| Priority: NOW

CareTask phải hỗ trợ trạng thái LOST_TO_FOLLOW_UP. Yêu cầu: authorized
Doctor/care staff, bắt buộc ghi lý do, lưu thông tin các lần liên hệ và
không để task treo vô thời hạn. Không auto-label chỉ vì quá hạn.

## NR-02 — PHÁT HIỆN TRÙNG VÀ HỢP NHẤT HỒ SƠ BỆNH NHÂN

Decision: ACCEPTED \| Priority: DEFERRED UNTIL DATA-INTEGRITY DESIGN

Hệ thống cần hỗ trợ cross-search, suspected duplicate và controlled
merge có audit. Không heuristic auto-merge, không blind bulk FK update
và không silent identity collapse. Schema/migration cần quyết định riêng
trước implementation.

## NR-03 — EXPLICIT START / END ENCOUNTER

Decision: ACCEPTED \| Priority: NOW

Bác sĩ phải có “Bắt đầu khám” và “Kết thúc khám”. Clinical examination
time không đồng nhất với receptionist record-creation time. Đây là
implementation clarification của D20-01.

## NR-04 — DOCTOR HANDOVER / DELEGATION

Decision: ACCEPTED \| Priority: NOW

Phải hỗ trợ participants, responsible clinician, explicit handover,
receiving Doctor acceptance/continuation, provenance và audit. Handover
không tạo Encounter mới nếu clinical visit vẫn tiếp diễn.

## NR-05 — PRESCRIPTION DISPENSED-LOCK LIFECYCLE

Decision: ACCEPTED AS REQUIREMENT \| Priority: DEFERRED

Nếu prescription chưa được phát hành/dispensed theo workflow tương lai,
correction có thể được phép theo authority phù hợp. Nếu đã phát hành/đã
sử dụng thì không silently overwrite; cần
supplemental/replacement/correction mechanism có audit. DEC-021 không mở
full pharmacy workflow.

## NR-06 — GHI CHÚ Ê-KÍP PHẪU THUẬT NGOẠI VIỆN

Decision: ACCEPTED \| Priority: NOW — LIGHTWEIGHT ONLY

Scope NOW chỉ gồm nhập thủ công/free-text: surgery summary, principal
surgeon, relevant team information và ghi chú cần thiết. Không tạo
structured hospital OR/team model, không workflow/automation riêng cho
ê-kíp trong phase hiện tại.

## NR-07 — BỆNH NHÂN TỪ CHỐI TOÀN BỘ ĐIỀU TRỊ

Decision: ACCEPTED \| Priority: NOW

Nếu Encounter đã hoàn tất, bác sĩ đã khám/chẩn đoán/tư vấn, bệnh nhân từ
chối toàn bộ treatment, không có active treatment order và không có
treatment-linked follow-up thì:

Encounter = CLOSED  
CareEpisode = NONE  
Outcome = PATIENT_DECLINED_TREATMENT / SELF_MONITORING

Không tạo active CareEpisode chỉ để biểu diễn việc bệnh nhân đã từ chối
treatment.

### NR-07.1 — Quay lại sau khi từng từ chối

Nếu bệnh nhân quay lại sau thời gian dài và quyết định bắt đầu điều trị:
tạo Encounter mới, đánh giá lại lâm sàng và tạo CareEpisode khi D20-02
trigger hợp lệ xuất hiện. Không auto-reopen một Episode không từng tồn
tại. Encounter từ chối điều trị cũ vẫn được giữ trong lịch sử.

# 13. MỞ LẠI CÓ PHẠM VI PACKAGE A

DEC-021 không phủ nhận trạng thái Package A đã OWNER CLOSED. Package A
vẫn CLOSED đối với mọi phần không bị new evidence tác động.

**SCOPED REOPEN  
**Chỉ mở lại có kiểm soát phạm vi D20-02, D20-03 và các code path,
invariant, test, transaction, migration/data implication bị tác động
trực tiếp bởi hai quyết định này.  
Không reopen full Package A. Prior PASS evidence vẫn có giá trị cho phần
không thay đổi.

Các phần không reopen toàn diện gồm D20-01, D20-05, D20-06, D20-07,
D20-09 và các phần đã audit khác không bị D20-02/D20-03 tác động.

# 14. PHÂN TÍCH TÁC ĐỘNG BẮT BUỘC TRƯỚC IMPLEMENTATION

Không sửa code D20-02/D20-03 trước khi impact analysis hoàn thành.

## 14.1. Tác động Episode creation

> **•** Single-active-Episode invariant.
>
> **•** Initial Encounter Episode creation.
>
> **•** Return Encounter Episode resolution.
>
> **•** Trigger idempotency.
>
> **•** Concurrent treatment triggers.
>
> **•** Duplicate Episode creation.
>
> **•** Tenant isolation.
>
> **•** Transaction boundaries.
>
> **•** Existing Episode lifecycle tests.

## 14.2. Race mới do D20-02 tạo ra

Transaction A: Doctor đóng current ACTIVE Episode  
↓ đồng thời  
Transaction B: một Initial Encounter khác cùng patient/domain  
thỏa D20-02 trigger và cố tạo ACTIVE Episode mới

Review phải chứng minh race này không thể tạo ra 02 ACTIVE hemorrhoid
CareEpisode, dù tạm thời, committed, retry hay failure/recovery. Không
được chỉ test Close Episode ↔ Return Encounter mà bỏ Close Episode ↔
Initial Encounter treatment trigger.

## 14.3. Các concurrency case bổ sung

> **•** Hai Initial Encounter đồng thời cùng thỏa trigger.
>
> **•** Nhiều treatment action cùng trigger creation trong một
> Encounter.
>
> **•** Follow-up creation đồng thời Episode creation.
>
> **•** Episode close đồng thời CareTask mutation.
>
> **•** Retry/idempotency behavior.

## 14.4. Dữ liệu lịch sử

Phải xác định policy đối với dữ liệu đã tạo theo D20-02 cũ, ví dụ
Initial Encounter có treatment evidence nhưng episodeId = null. Không tự
động backfill chỉ vì rule mới thay đổi. Historical migration/backfill
cần explicit analysis và Owner decision nếu thực sự cần; không rewrite
history để dữ liệu cũ “trông giống” rule mới.

## 14.5. Tác động Episode closure

> **•** Atomic Episode close.
>
> **•** Bulk future CareTask disposition.
>
> **•** Transaction behavior.
>
> **•** Concurrent task completion.
>
> **•** Concurrent task reschedule.
>
> **•** Independent surveillance.
>
> **•** Audit metadata.
>
> **•** Idempotent repeated close request.
>
> **•** Tenant isolation.

# 15. YÊU CẦU ĐỐI VỚI IMPLEMENTATION CONTRACT

Owner Lock của DEC-021 không trực tiếp authorize code. Trước
implementation phải reconcile/update Implementation Contract tương ứng.

Contract phải chuyển các quyết định DEC-021 thành explicit state
transitions, API behavior, validation, transaction requirements, UI
actions, audit behavior, tests và acceptance criteria.

**NO INVENTION RULE  
**Claude Code không được tự suy diễn semantics còn thiếu từ DEC.  
Nếu Contract thiếu một quyết định lâm sàng quan trọng: STOP →
Owner/Clinical Owner. Không tự invent.

**DOMAIN LINKAGE CONTRACT REQUIREMENT**  
Trước implementation D20-02, Implementation Contract phải định nghĩa
tường minh và machine-checkable cơ chế xác định một prescription,
treatment order hoặc follow-up thuộc đúng hemorrhoid treatment domain.  
Không được dùng Diagnosis free-text hoặc việc cùng nằm trong một
Encounter làm implicit linkage.  
Nếu data model hiện tại chưa đủ để biểu diễn association này: **STOP →
impact analysis / Owner Decision**. Implementer không được tự suy diễn
hoặc tạo heuristic.

# 16. QUẢN TRỊ TRIỂN KHAI VÀ XÁC MINH

Sau Owner Lock và Contract reconciliation, workflow chuẩn:

> **1.** ChatGPT direct impact review.
>
> **2.** Xác định exact write set.
>
> **3.** Pre-write git status + git diff.
>
> **4.** Claude Code chỉ dùng nếu correction là complex execution.
>
> **5.** Claude Code implementation report không phải independent
> verification.
>
> **6.** Chạy machine-check/tests cần thiết.
>
> **7.** Bắt buộc Codex independent focused audit cho D20-02/D20-03.

## 16.1. Scope Codex bắt buộc

> **•** D20-02 triggers và domain linkage cho Trigger 1/2/3.
>
> **•** Non-treatment reminder handling.
>
> **•** Doctor proposal vs active treatment distinction.
>
> **•** Initial Encounter Episode creation.
>
> **•** Single-active-Episode invariant.
>
> **•** Tenant isolation.
>
> **•** Transaction isolation.
>
> **•** Idempotency.
>
> **•** Race Close ↔ Return.
>
> **•** Race Close ↔ Initial Encounter treatment trigger.
>
> **•** Concurrent Episode creation.
>
> **•** D20-03 CareTask bulk disposition.
>
> **•** Concurrent CareTask completion/reschedule.
>
> **•** Minimal audit preservation.
>
> **•** Relevant regression tests.

**CÂU HỎI AUDIT BẮT BUỘC  
**Can closing an Episode concurrently with an Initial Encounter
satisfying a D20-02 treatment trigger create two ACTIVE hemorrhoid
CareEpisodes, temporarily or permanently?  
Nếu implementation/test không chứng minh được câu trả lời an toàn thì
audit không được PASS.

## 16.2. Không tự chứng nhận

Các statement như “Claude Code says PASS”, “implementation appears
correct” hoặc “all changes seem safe” không phải independent
verification. Correction chạm invariant/concurrency phải đi qua Codex
focused audit.

## 16.3. Nếu Codex FAIL

Finding  
↓ focused correction  
Focused verification  
↓  
Close gate

Không mở lại generic review loop cho toàn Package A.

# 17. TRẠNG THÁI REPOSITORY — BLOCKER ĐÃ ĐÓNG

PR \#12 / cc53032 đã được Owner disposition là UNINTENTIONAL GOVERNANCE
DRIFT và đã được correction theo authorization.

TRẠNG THÁI  
REPOSITORY DRIFT = CLOSED  
Current baseline: branch main; HEAD = origin/main =
27500091f268b97d7abd9b59afa1e2c2d6d72f7a; working tree CLEAN.

## 17.1. Kết quả correction và verification

Correction commit effcc51eb7ab9030879ef8ef32538bc1887e10c5 phục hồi
active repository tree về pre-WIP content
c8605bce98e1a2ca06e210036917041bdf523d96 mà không
reset/force-push/rewrite history. WIP commit
6c73919e9eaa5073636bc2e1fe6e705de407afc5 và WIP branch vẫn được giữ làm
historical evidence/reuse source, không phải accepted implementation.

Fresh Codex independent read-only audit xác minh: local = origin/main,
working tree CLEAN, WIP absent khỏi active app tree, 11-file Guard A/B
STALE WIP absent, Package A application tree preserved, governance
consistent; BLOCKERS = NONE; verdict = READY FOR DEC-021.

DEC-021 vẫn không tự authorize
revert/reset/merge/rebase/force-push/create branch/commit/push hoặc
application code. Sau Owner Lock chỉ mở impact analysis và
Contract/execution-map reconciliation trước khi xin authorization triển
khai code.

# 18. NGOÀI PHẠM VI (NON-GOALS)

> **•** Full rewrite DEC-020.
>
> **•** Architecture redesign.
>
> **•** Multi-specialty expansion.
>
> **•** Full HIS/EMR integration.
>
> **•** Full hospital OR workflow.
>
> **•** Full pharmacy workflow.
>
> **•** Full ICD integration.
>
> **•** Deep workflow cho mọi surgical technique.
>
> **•** AI diagnosis.
>
> **•** AI treatment decision.
>
> **•** Automatic Patient merge.
>
> **•** Speculative schema migration.
>
> **•** Package B implementation trước khi current gate đóng.

# 19. VỆ SINH NGUỒN BẰNG CHỨNG

Working evidence có lỗi copy/paste trình bày tại câu bổ sung 11, nơi một
đoạn D20-03 bị lặp vào phần D20-02. Lỗi này được phân loại EDITORIAL /
NON-BLOCKING vì không thay đổi substantive answer dùng để xác lập D20-02
và không dùng đoạn lặp làm authority. Cleanup phải được thực hiện khi
đóng gói evidence cuối, nhưng không chặn Owner Lock DEC-021. Không được
sửa nội dung trả lời substantive của BS Thái khi cleanup.

# 20. CHECKLIST SẴN SÀNG OWNER LOCK

> ☑ PR \#12 repository drift đã được Owner disposition và
> correction/verification hoàn tất.
>
> ☑ Lỗi copy/paste interview question 11 đã được phân loại EDITORIAL /
> NON-BLOCKING; cleanup giữ nguyên substantive answer.
>
> ☑ D20-02 semantics mới được đặc tả đầy đủ để Owner chốt.
>
> ☑ D20-02 Trigger 1 được ràng buộc đúng treatment domain.
>
> ☑ D20-02 Trigger 2 phân biệt proposal với active treatment order và
> đúng treatment domain.
>
> ☑ D20-02 Trigger 3 được giới hạn thành treatment-linked follow-up.
>
> ☑ Unrelated medication/order/follow-up không thể tạo CareEpisode.
>
> ☑ Không heuristic association chỉ vì cùng Encounter.
>
> ☑ Non-treatment reminder không tạo Episode.
>
> ☑ D20-03 close behavior được đặc tả đầy đủ để Owner chốt.
>
> ☑ One-confirmation automatic CareTask disposition được định nghĩa.
>
> ☑ Terminal status mapping được yêu cầu deterministic trong
> Implementation Contract; minimal audit safeguard được giữ.
>
> ☑ D20-05 System/IT Admin authority boundary được ghi nhận.
>
> ☑ D20-08 Longo-only deep-workflow scope được ghi nhận.
>
> ☑ IRC và RFA được ghi nhận tách biệt.
>
> ☑ 07 requirement mới có scope disposition; NR-06 đã khóa NOW —
> LIGHTWEIGHT ONLY.
>
> ☑ Patient-declines-treatment semantics nhất quán với D20-02.
>
> ☑ Package A scoped reopening boundary được ghi rõ.
>
> ☑ Historical-data policy yêu cầu explicit analysis/Owner decision
> trước migration/backfill nếu cần.
>
> ☑ Close-vs-Initial-Encounter race nằm trong implementation review
> scope.
>
> ☑ Close-vs-Initial-Encounter race nằm trong Codex audit scope.
>
> ☑ Codex independent verification requirement được ghi rõ.
>
> ☑ No self-attestation rule được giữ.
>
> ☑ DEC-021 không tự authorize application implementation.
>
> ☑ Không mở multi-specialty scope.
>
> ☑ Không duplicate preserved DEC-020 content.

KẾT QUẢ CHECKLIST  
OWNER LOCK DEC-021 v0.3 = COMPLETED.  
Next governance gate đã chuyển sang Package R Contract / execution baseline.

# 21. KẾT LUẬN QUẢN TRỊ CUỐI CÙNG

DEC-021 áp dụng phương án SELECTIVE CLINICAL REBASELINE — tái thiết lập
lâm sàng có chọn lọc, không phải full redesign.

## 21.1. Thay đổi ngữ nghĩa thực sự

D20-02 — SUPERSEDED: CareEpisode không còn chờ First Return Encounter;
Episode bắt đầu tại Encounter nơi treatment trigger hợp lệ, đúng
treatment domain thực sự xuất hiện.

D20-03 — PARTIAL SUPERSEDE: Khi Doctor kết thúc Episode, sau một lần xác
nhận các future Episode-linked CareTasks được tự động close/cancel;
không hard-delete và vẫn giữ audit tối thiểu.

## 21.2. Clarification

> **•** D20-01 — explicit Start/End Encounter và Doctor handover.
>
> **•** D20-04 — hỗ trợ multiple diagnosis nhưng chưa bắt buộc
> structural/ICD redesign.
>
> **•** D20-05 — System/IT Admin không có clinical authority.
>
> **•** D20-08 — Longo là deep workflow duy nhất; kỹ thuật khác
> recordable/selectable; IRC và RFA tách biệt.
>
> **•** D20-10 — Follow-up linh hoạt, branch-aware, không suy luận cứng.

## 21.3. Requirement mới

> **1.** Lost to Follow-up.
>
> **2.** Patient duplicate detection / controlled merge.
>
> **3.** Explicit Start / End Encounter.
>
> **4.** Doctor handover / delegation.
>
> **5.** Prescription dispensed-lock lifecycle.
>
> **6.** External surgery team note.
>
> **7.** Patient declines all treatment.

## 21.4. Package A

Package A vẫn OWNER CLOSED đối với scope không thay đổi. DEC-021 chỉ
reopen có phạm vi D20-02, D20-03 và các implementation/tests/invariants
trực tiếp bị tác động.

## 21.5. Verification

Correction D20-02/D20-03 chạm lifecycle, invariant, concurrency, data
integrity và tenant isolation; do đó independent focused Codex audit là
mandatory.

## 21.6. Trạng thái hiện tại

PR \#12 / repository drift = CLOSED  
Repository readiness = PASS — Codex independent audit, BLOCKERS = NONE  
DEC-021 = OWNER LOCKED v0.3  
Package B cũ = HOLD / T0 NOT OPEN  
Application implementation = CHƯA ĐƯỢC PHÉP

TUYÊN BỐ CUỐI  
DEC-021 không phủ nhận giá trị lịch sử của DEC-020.  
DEC-020 tiếp tục là historical decision record và authority cho mọi
decision được PRESERVE.  
Sau OWNER LOCK, DEC-021 trở thành authority mới đúng tại các phần
SUPERSEDE, CLARIFY hoặc NEW REQUIREMENT.  
OWNER LOCK DEC-021 chỉ authorize NEXT GATE = impact analysis + reconcile
affected Implementation Contract / execution map; không tự động
authorize application code.  
Không có implication rằng evidence mới yêu cầu redesign toàn bộ
GastroCare hoặc mở scope đa chuyên khoa.

# 22. OWNER DECISION / AUTHORIZATION

**OWNER DECISION — LOCKED 06/09/2026**  
OWNER LOCK DEC-021 v0.3 — Hemorrhoid Clinical Workflow Selective
Rebaseline.  
Authority effect:  
1. DEC-021 v0.3 trở thành authority mới cho các phần SUPERSEDE / CLARIFY
/ NEW REQUIREMENT được nêu trong tài liệu.  
2. Package A vẫn OWNER CLOSED ngoài scoped reopen D20-02/D20-03 và tác
động trực tiếp.  
3. Package B theo Contract cũ tiếp tục HOLD / T0 NOT OPEN.  
4. Authorize NEXT GOVERNANCE GATE: impact analysis → reconcile affected
Implementation Contract / Master Execution Map → xác định exact write
set và execution baseline.  
5. KHÔNG authorize application code, migration, commit/push hoặc
implementation cho tới khi Owner phê duyệt exact execution plan/write
set.

☑ OWNER LOCK DEC-021 v0.3

☐ RETURN FOR CORRECTION

Owner note: LOCKED in conversation authority.  
Decision date: 06/09/2026
