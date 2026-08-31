# DEC-019 — Staff Profile & Credential Management v1

**Status:** OWNER LOCKED  
**Date:** 2026-08-30  
**Target work package:** Staff Profile & Credential Management v1  
**Baseline:** DEC-018 CLOSED — OWNER ACCEPTED — remote checkpoint `7d33e02c36f5e862c50717c340deea86ad046e47`  
**Data:** SYNTHETIC DATA ONLY — real-patient runtime / production NOT AUTHORIZED  
**Owner authority:** DEC-019 OWNER LOCKED; Implementation Contract v0.1 OWNER LOCKED; T0→T6 implementation authorized; T7 = Fresh Codex independent focused read-only audit; T8 = Owner Synthetic Acceptance; no commit/push without separate Owner authorization.  
**External review:** CLOSED — PASS. Final repo-grounded review identified one MEDIUM execution-order ambiguity and one LOW wording issue; both were corrected before Owner Lock.

---

## 1. Purpose

DEC-019 hoàn thiện nghiệp vụ hồ sơ người dùng của phòng khám sau DEC-018.

DEC-018 trả lời:

> Ai có tài khoản, đang ACTIVE/DISABLED, có role gì và có Clinic Admin capability hay không?

DEC-019 trả lời:

> Người đó là ai về mặt nghề nghiệp, có chuyên môn/chứng chỉ gì, từng và đang công tác ở đâu?

DEC-019 không thay đổi Clinical Core authorization, không thay đổi nghĩa của `AuthRole`, không thay đổi clinician assignment semantics và không mở HRM/payroll.

---

## 2. Domain boundary

### 2.1 Separation of concerns

```text
AuthUser
= authentication + operational role + account lifecycle + Clinic Admin capability

StaffProfile
= hồ sơ con người / nghề nghiệp

StaffCredential
= giấy phép / chứng chỉ / đào tạo

EmploymentHistory
= lịch sử công tác nghề nghiệp, có thể ở tổ chức ngoài GastroCare

StaffFacilityAssignment
= phân công làm việc tại Facility thuộc tenant GastroCare
```

Quan hệ:

```text
AuthUser
   │ 1
   │
   │ 0..1
StaffProfile
   │
   ├──< StaffCredential
   ├──< EmploymentHistory
   └──< StaffFacilityAssignment >── Facility
```

`AuthUser.displayName` và `StaffProfile.fullName` là hai field độc lập. Không tự đồng bộ hoặc suy diễn từ nhau.

`AuthUser.status = DISABLED` không xóa, truncate hay rewrite StaffProfile/credential/employment/facility history.

---

## 3. Specialty decision

`StaffSpecialty` v1:

```prisma
enum StaffSpecialty {
  GASTROENTEROLOGY
  COLORECTAL_SURGERY
  GENERAL_SURGERY
  OTHER
}
```

Không có `NURSING` trong specialty taxonomy vì `NURSE` đã là operational role (`AuthRole.NURSE`).

`primarySpecialty` nullable. `secondarySpecialties` là danh sách enum, không trùng lặp.

Nếu `OTHER` xuất hiện ở primary hoặc secondary thì `specialtyOtherLabel` bắt buộc có giá trị; nếu không có `OTHER`, field này phải null/empty.

A-001 (“chuyên khoa đầu tiên của sản phẩm là Gastroenterology”) là một product hypothesis độc lập. DEC-019 không resolve, không supersede và không phụ thuộc A-001.

---

## 4. Staff Profile v1

Các field nghiệp vụ:

```text
fullName
professionalTitle?
workPhone?
primarySpecialty?
secondarySpecialties[]
specialtyOtherLabel?
biography?
```

Không có avatar trong v1.

Không thu thập trong v1:

```text
CCCD / hộ chiếu
địa chỉ nhà
tình trạng hôn nhân
tài khoản ngân hàng
lương
thông tin gia đình
hợp đồng lao động
chấm công
nghỉ phép
performance review
```

Mục tiêu là professional staff profile, không phải HRM.

---

## 5. Credentials

Credential types:

```prisma
enum StaffCredentialType {
  LICENSE
  CERTIFICATE
  TRAINING
}
```

Stored status:

```prisma
enum StaffCredentialStatus {
  ACTIVE
  REVOKED
}
```

`EXPIRED` là derived effective state, không lưu DB.

Quy tắc:

```text
stored status == REVOKED
    => effectiveStatus = REVOKED

stored status == ACTIVE
AND expiryDate != null
AND expiryDate < today
    => effectiveStatus = EXPIRED

otherwise
    => effectiveStatus = ACTIVE
```

Credential hợp lệ xuyên suốt `expiryDate`; chỉ chuyển effective `EXPIRED` từ ngày kế tiếp.

Ngày cấp/hết hạn là date-only (`@db.Date`), không phải timestamp.

Không upload/scan/PDF credential trong v1.

`StaffCredential` được hard-delete để sửa lỗi nhập liệu, nhưng DELETE bắt buộc có AuditEvent atomic.

---

## 6. Employment History

Fields:

```text
organizationName
department?
positionTitle?
startDate
endDate?
employmentType?
note?
```

Employment type:

```prisma
enum EmploymentType {
  FULL_TIME
  PART_TIME
  COLLABORATOR
}
```

Rules:

- `startDate` required.
- `endDate` nullable = đang công tác.
- nếu có `endDate`: `endDate >= startDate`.
- date-only (`@db.Date`).
- overlap giữa nhiều EmploymentHistory được phép.
- không có exclusion/non-overlap constraint.
- hard delete được phép để sửa lỗi nhập liệu; mutation + audit atomic.

---

## 7. Facility Assignment

`StaffFacilityAssignment` mô tả nơi người dùng làm việc trong tenant; nó KHÔNG cấp/thu clinical access và KHÔNG thay đổi `AuthRole`.

Rules:

1. Có thể có nhiều active Facility assignments cùng lúc.
2. Với một StaffProfile:
   - nếu không có active assignment: không có active primary;
   - nếu có ít nhất một active assignment: phải có đúng một active primary.
3. Tối đa một active assignment cho cùng cặp `(staffProfileId, facilityId)`.
4. Đổi primary KHÔNG đồng nghĩa kết thúc assignment cũ.
5. `endDate` chỉ thay đổi khi Clinic Admin thực hiện hành động kết thúc assignment tường minh.
6. Không hard-delete StaffFacilityAssignment.
7. `facilityId` và `staffProfileId` bất biến sau khi tạo.
8. Nếu kết thúc primary trong khi còn assignment active khác, cùng request phải chỉ định replacement primary; không tự đoán cơ sở mới. Trong cùng transaction, write order bắt buộc: (1) kết thúc old primary trước bằng cách set `endDate` (row lập tức rời partial unique index); (2) sau đó mới promote replacement bằng `isPrimary=true`. Làm ngược thứ tự sẽ gây unique conflict giả.
9. Nếu đổi primary giữa hai assignment active: old primary trở thành `isPrimary=false`; target trở thành `isPrimary=true`; cả hai mutation cùng transaction. Vì partial unique index là non-deferrable, write order bắt buộc: demote old primary trước, sau đó mới promote target; không được làm ngược thứ tự.
10. DB bảo vệ concurrency bằng partial unique indexes; không dùng `SERIALIZABLE`, không automatic retry.

Required PostgreSQL indexes:

```sql
CREATE UNIQUE INDEX "staff_facility_assignments_one_active_primary"
ON "staff_facility_assignments" ("staffProfileId")
WHERE "isPrimary" = true AND "endDate" IS NULL;

CREATE UNIQUE INDEX "staff_facility_assignments_one_active_per_facility"
ON "staff_facility_assignments" ("staffProfileId", "facilityId")
WHERE "endDate" IS NULL;
```

Project đang ở Prisma 6.x; partial index không được biểu diễn bằng Prisma Schema Language của baseline này. Migration phải được tạo `--create-only`, sau đó edit `migration.sql` thủ công trước khi apply/test.

DB unique conflict được map thành HTTP `409 Conflict`; client reload state và cho người dùng thử lại. Không automatic retry.

---

## 8. Tenant isolation

Mọi entity mới mang `tenantId` trực tiếp:

```text
StaffProfile
StaffCredential
EmploymentHistory
StaffFacilityAssignment
```

Rules bắt buộc:

- `tenantId` không bao giờ nhận từ request DTO.
- `tenantId` luôn lấy từ authenticated current tenant.
- mọi target lookup scope bằng `tenantId + id`.
- child lookup scope bằng `tenantId + parent identity + child id`.
- create StaffProfile phải chứng minh AuthUser thuộc actor tenant.
- create child phải chứng minh StaffProfile thuộc actor tenant.
- Facility assignment phải chứng minh:
  `StaffProfile.tenantId == Facility.tenantId == actor.tenantId`.
- wrong-tenant id trả 404/non-leak theo pattern DEC-018.
- frontend không phải security boundary.

---

## 9. Authorization

Clinic Admin:

- xem toàn bộ profile trong tenant;
- tạo/sửa StaffProfile;
- CRUD StaffCredential;
- CRUD EmploymentHistory;
- tạo/change-primary/end StaffFacilityAssignment;
- xem staff audit.

Self user:

- `GET /auth/me/profile`;
- read-only;
- không tự sửa professional/credential/employment/facility data ở v1.

Staff khác:

- không có full Staff Directory;
- không được mở full profile của đồng nghiệp.

Không tạo generic permission engine hoặc guard mới. Tái sử dụng `ClinicAdminGuard`.

---

## 10. API surface

```text
GET    /clinic-admin/users/:id/profile
PUT    /clinic-admin/users/:id/profile

GET    /clinic-admin/users/:id/credentials
POST   /clinic-admin/users/:id/credentials
PATCH  /clinic-admin/users/:id/credentials/:credentialId
DELETE /clinic-admin/users/:id/credentials/:credentialId

GET    /clinic-admin/users/:id/employment-history
POST   /clinic-admin/users/:id/employment-history
PATCH  /clinic-admin/users/:id/employment-history/:recordId
DELETE /clinic-admin/users/:id/employment-history/:recordId

GET    /clinic-admin/users/:id/facility-assignments
POST   /clinic-admin/users/:id/facility-assignments
PATCH  /clinic-admin/users/:id/facility-assignments/:assignmentId

GET    /clinic-admin/users/:id/staff-audit

GET    /auth/me/profile
```

Facility PATCH không đổi `staffProfileId` hoặc `facilityId`.

Supported facility mutation intents:

```text
make target primary
end assignment (+ replacementPrimaryAssignmentId nếu còn active assignment khác)
```

Không có reopen assignment. Rejoin facility sau khi ended = tạo assignment row mới.

Existing `/clinic-admin/users/:id/audit` của DEC-018 giữ nguyên semantics; frontend detail page có thể merge user-management audit và staff-audit theo `AuditEvent.seq`.

Không enrich `/clinicians` trong DEC-019 v1.

---

## 11. Audit

Required actions:

```text
STAFF_PROFILE_CREATED
STAFF_PROFILE_UPDATED
CREDENTIAL_ADDED
CREDENTIAL_UPDATED
CREDENTIAL_REMOVED
EMPLOYMENT_RECORD_ADDED
EMPLOYMENT_RECORD_UPDATED
EMPLOYMENT_RECORD_REMOVED
FACILITY_ASSIGNMENT_ADDED
FACILITY_ASSIGNMENT_PRIMARY_CHANGED
FACILITY_ASSIGNMENT_ENDED
```

Every event includes:

```text
tenantId
actorId
action
entityType
entityId
metadata.targetUserId
metadata.staffProfileId (when applicable)
```

Audit minimization:

- profile update: changed field names, không copy toàn bộ values;
- credential add/update: không copy credentialNumber/note vào audit;
- credential delete: giữ minimal descriptor (`credentialType`, `name`);
- employment delete: giữ minimal descriptor (`organizationName`, optional positionTitle);
- facility events: facilityId + relevant assignment ids;
- không copy biography/note/workPhone vào audit nếu không cần.

Mutation + audit phải atomic.

---

## 12. Frontend

Clinic Admin:

```text
/clinic-admin/users
  → giữ danh sách gọn của DEC-018
  → thêm action "Xem"

/clinic-admin/users/:id
  → User Detail
```

User Detail tabs:

```text
Tổng quan
Chuyên môn
Chứng chỉ
Công tác
Nhật ký
```

`Sửa người dùng` modal DEC-018 tiếp tục chỉ quản lý:

```text
displayName
role
isClinicAdmin
```

Professional profile editor tách riêng trong User Detail.

Self:

```text
/profile
```

read-only; lấy dữ liệu từ `GET /auth/me/profile`.

Không thêm Staff Directory mới. Không enrich clinician selector.

---

## 13. Out of scope

- clinical authorization theo Facility;
- Staff Directory;
- clinician selector enrichment;
- scheduling/roster;
- payroll/chấm công/nghỉ phép;
- contract/payroll HRM;
- CCCD / bank / home address;
- avatar/file upload;
- credential scan/PDF;
- object storage;
- System Admin;
- CORE-05;
- AI;
- production;
- real-patient runtime.

---

## 14. Acceptance

Work package chỉ được coi hoàn thành sau:

- additive migration + manual partial indexes verified on real PostgreSQL;
- backup/restore PASS;
- tenant isolation tests cho cả 4 entity;
- DB concurrency test chứng minh không thể có 2 active primary;
- duplicate active same-facility test;
- audit atomic/minimized;
- full backend/frontend regression PASS;
- one Fresh Codex focused read-only audit on migration/tenant/index invariant;
- Owner Synthetic Acceptance PASS.

Không AI/agent tự tuyên bố Owner Acceptance.

---

## 15. Owner Lock & execution authorization

**OWNER LOCKED — 2026-08-30.**

Owner đã xác nhận:

1. `DEC-019 OWNER LOCKED`.
2. `Implementation Contract v0.1 OWNER LOCKED`.
3. Cho phép Claude Code triển khai liên tục `T0 → T6` theo Contract.
4. `T7` bắt buộc là Fresh Codex independent focused read-only audit, tách khỏi implementation session.
5. `T8` là Owner Synthetic Acceptance; AI/agent không tự đóng PASS.
6. Chỉ dùng synthetic data; real-patient runtime và production vẫn NOT AUTHORIZED.
7. Không commit/push/merge/tag nếu chưa có Owner authorization riêng.

External review requirement trước Lock đã hoàn tất một pass và CLOSED — PASS. Không lặp review nếu không có blocker hoặc thay đổi materially vào locked Contract.

---

## 16. OWNER CLOSURE ADDENDUM — 2026-08-31

**Status:** OWNER CLOSED — 2026-08-31.

Phần OWNER LOCKED và toàn bộ nội dung sections 1–15 ở trên được giữ nguyên làm
văn bản locked lịch sử; addendum này chỉ bổ sung, không sửa/rút gọn.

Owner-directed governance closure (2026-08-31):

1. `DEC-019 — Staff Profile & Credential Management v1` = **OWNER CLOSED**.
2. `T7` (Fresh Codex independent focused read-only audit) = **WAIVED BY OWNER —
   NOT EXECUTED**.
3. `T8` (Owner Synthetic Acceptance) = **WAIVED BY OWNER — NOT EXECUTED**.
4. Không có tuyên bố PASS / acceptance cho DEC-019: không T7 PASS, không T8 PASS,
   không Owner Synthetic Acceptance PASS, không Technical Acceptance bổ sung,
   không Product Acceptance.
5. Phần implementation DEC-019 hiện có (T0→T6) được giữ nguyên trong working
   tree; không rollback, không xóa.
6. Không có công việc DEC-019 nào khác được authorize; T7/T8 không còn là gate
   đang chờ.
7. `SYNTHETIC DATA ONLY`; real-patient runtime và production vẫn `NOT
   AUTHORIZED`. Closure này không mở real data / pilot thật / production /
   CORE-05.
8. Clinical/domain semantics của DEC-019 và DEC-010→018 không đổi.

Xem thêm: `docs/DECISION_LOG.md → DEC-019 CLOSURE`, `docs/PROJECT_STATE.md`,
`docs/07_ROADMAP_AND_GATES.md §3.2.5`.
