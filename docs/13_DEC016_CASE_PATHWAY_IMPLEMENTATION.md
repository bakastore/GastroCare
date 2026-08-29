# DEC-016 — Case, TreatmentPathway và Investigation: ghi chú triển khai

Ngày: 2026-08-28. Session A là implementation executor; **không phải independent audit**.

## Thẩm quyền và phạm vi

Owner khóa DEC-016 / Contract v0.3 và cấp phép T0 → M0 → M7 liên tục, không commit/push. Repository ban đầu không chứa bản Contract v0.3; dùng đúng fallback Owner cho phép trong [bản lưu yêu cầu](DEC016_OWNER_AUTHORITY.md). Tài liệu này ghi nhận cách triển khai và bằng chứng, không tự bổ sung Owner Decision.

Baseline T0: branch `correction/owner-acceptance-slice1-3`, HEAD `c0dfe1a4f774bef334dd2c2e0eac45f89a2e106b`, worktree CLEAN. DEC-015 tồn tại và checksum không đổi. Chỉ dùng PostgreSQL giả lập local trong `docker-compose.test.yml`. Không production, dữ liệu bệnh nhân thật, deploy, CORE-05, AI hoặc file/object storage.

## Các invariant đã triển khai

| Phần | Hành vi |
|---|---|
| Case | `CareEpisode` là storage vật lý; không có bảng `CareCase`. Initial `HEMORRHOID_INITIAL` tạo hoặc dùng ngay Case ACTIVE. Generic Encounter vẫn được ungrouped. |
| Return | Chỉ dùng Case ACTIVE của source Encounter; không tạo Case. CareTask + Return + assignment + audit trong cùng Serializable transaction; conflict 409, không auto retry. |
| TreatmentPathway | Child của Case, MEDICAL / PROCEDURE / SURGERY; nhiều pathway trong Case. SURGERY phải gửi một trong sáu methodCode được Owner khóa; backend không default LONGO. |
| Ancestry | Encounter mang `episodeId` = Case, optional `treatmentPathwayId`; composite FK và API kiểm tra cùng tenant/Case/patient. |
| Longo | Sáu họ biểu mẫu giữ nội dung và scoring; ancestry đổi thành Case + SURGERY/LONGO pathway. Follow-up match đúng pathway và timepoint qua source Encounter, không thêm Case/pathway vào CareTask. Generic complete không được bypass matching Longo. |
| Decision v2 | Cùng template key, version 2; multi-select modalities, summary và conditional settings; orphan setting 400 kể cả draft. COMPLETE/AMEND kiểm tra riêng cho template. SURGERY chỉ HOSPITAL; không tự tạo pathway. |
| Lịch sử Decision | Existing v1 vẫn dùng định nghĩa v1 khi đọc/amend; không backfill modality hoặc clinical meaning. |
| Investigation | Nguồn INTERNAL_CURRENT / ECOSYSTEM_PRIOR / EXTERNAL_PRIOR; parent tường minh cùng tenant/Case/patient, không cycle. Current Result gắn Order; prior Result được không có Order. Raw Result không phải diễn giải. |
| NURSE | Chỉ đọc context tối thiểu và order/result được giao; chỉ nhập raw Result trên assigned Order. Không patient list/timeline/Case tổng quát, Diagnosis, Treatment Decision hoặc ClinicalForm. |
| Workspace | Tổng quan / Khám / CLS / Điều trị / Theo dõi / Lịch sử. Bỏ direct standalone Longo start. LONGO preselection của UI được gửi tường minh. |

Medical/procedure care setting được nhập text vì yêu cầu Owner cung cấp không định nghĩa vocabulary. Không phát minh taxonomy. `surgeryCareSetting` nếu gửi phải là HOSPITAL; nếu bỏ qua vẫn chịu invariant HOSPITAL, không được hiểu là setting khác.

## Migration và reconciliation

Migration additive: `backend/prisma/migrations/20260828000000_dec016_case_pathway_investigation/migration.sql`. Thêm NURSE, TreatmentPathway/Investigation/Order/Result, optional Encounter pathway và ancestry constraints. Không UPDATE dữ liệu cũ trong schema migration.

Reconciliation là CLI local synthetic có explicit manifest, không phải API import lịch sử. Manifest chỉ định IDs, actor và timestamp nguồn; không chọn theo tên, text hoặc thời gian. Có đúng một Case candidate thì phải trùng caseId; zero cần explicit newCase; >1 STOP atomically. Existing legacy LONGO_TREATMENT giữ compatibility/history row; nested pathway copy nguyên timestamps. Audit append-only; existing clinical IDs, forms, amendment chain, plans/tasks và audit không bị chế thêm hoặc thay nội dung.

Fixture Run2 là **synthetic Run2-shape**, không phải dữ liệu Run2 thật của Owner: A Initial → E1, D/E vẫn E1, E2 Longo → child pathway của E1, C → E1 + pathway, B generic vẫn ungrouped. M0 đầu tiên PASS trước khi áp dụng migration dev. Proof sau cùng có thể dựng lại PRE từ đúng 10 migrations trong baseline Git, rồi backup/apply/reconcile/destroy/restore/reapply mà không đọc/reset dev.

Bằng chứng đã lưu không chứa clinical data thật:

- [M0 ban đầu](evidence/DEC016_SESSION_A/m0-initial-report.json).
- [M0 chạy lại từ baseline Git](evidence/DEC016_SESSION_A/m0-repeat-report.json).
- [Manifest giả lập](evidence/DEC016_SESSION_A/synthetic-reconciliation-manifest.json).

Lệnh chạy M0 (tạo/drop **chỉ DB rehearsal**; từ repo root):

```bash
node backend/node_modules/ts-node/dist/bin.js backend/scripts/dec016-m0-proof.ts
```

Nếu rehearsal DB đã tồn tại, tool STOP và giữ evidence để kiểm tra; không tự xóa một rehearsal chưa rõ trạng thái. M0 không dùng transaction rollback giả làm restore; có actual DROP/CREATE/pg_restore. Dump và raw logs ở `/tmp`, ngoài Git.

## Verification Session A

| Kiểm tra | Kết quả đã quan sát |
|---|---|
| T0 | PASS, baseline chính xác và clean trước triển khai |
| M0 | PASS lần đầu trước M1; PASS lần chạy lại; 0/1/>1, preserve history, real PRE restore, deterministic reapply |
| Backend E2E | 354/354, 20 suites; toàn bộ `backend/test/*.e2e-spec.ts` |
| Backend unit | 80/80, 9 suites |
| Frontend unit/component | 59/59, 15 files |
| Browser | 9/9, có Case/Longo, Return #1/#2, Decision v2, Investigation và NURSE |
| Builds | Backend và frontend/typecheck PASS |
| Prisma | validate PASS; 11 migrations, schema up to date |
| Backup/restore | PASS; toàn bộ row content, ancestry, audit và migration metadata khớp hash |

Backup M7: `/tmp/gastrocare-backup-verify/backup-20260828142022.sql`; SHA256 xem report bàn giao. All-table PRE/POST SHA256: `93cee225f08f0965fb915c958cd0f199e0bb6f6752fcf15bbc7c967e7428419e`. Dataset backup có 4 synthetic patients, 3 Cases, 1 pathway, 2 Investigations, 1 Order, 2 Results, 54 AuditEvents. Regression ngay sau restore: 353/353; sau đó bổ sung history-v1 coverage và chạy full E2E: 354/354. Không gộp hoặc hard-code count cũ thành kết quả mới.

Các log injected failure ở rollback tests là negative-path có chủ đích. Test cũ được chuyển fixture sang Case + explicit pathway; không xóa concurrency/rollback assertions. DB FK nay chặn ancestry corruption ngay tại write, nên test tương ứng xác nhận P2003 thay vì cố tạo dữ liệu sai rồi mới kiểm tra API.

Browser dùng thời điểm clinical giả lập cố định cho Return để không phụ thuộc wall clock. Timeline vẫn dùng occurredAt; createdAt/id chỉ break tie khi clinical time bằng nhau. Runner dọn cả process group và từ chối dùng server cũ trên cổng test.

Backup/restore cuối được chạy lại sau khi bổ sung toàn bộ tests: **354/354 backend sau restore PASS**, backup `/tmp/gastrocare-backup-verify/backup-20260828164936.sql`, SHA256 `c5022b42ca523cd8ffb39507536e48e4ecef3957fdecb1bff55d7dd50ec6a758`; all-table PRE/POST `858e7893cf5c7fe88367795cfa4529de1a98647a7bf38754ea7534238ca1e3c9`. Browser full suite 9/9 PASS hai lần liên tiếp. [Báo cáo bàn giao cuối](DEC016_SESSION_A_REPORT.md).

## Findings / giới hạn đã biết

- Kiểm tra bổ sung `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` trả exit 2 chỉ ở FK `Encounter.roomId`. Migration baseline `20260824100000_hemorrhoid_slice1_facility_room_responsible_clinician` line 94 khóa `ON DELETE RESTRICT`; schema ở chính HEAD gốc bỏ `onDelete`, nên Prisma suy ra SET NULL cho optional relation. DB hiện khớp migration baseline. DEC-016 không sửa relation/schema line này hoặc migration cũ. Đây là baseline declaration mismatch đã xác minh, không phải DEC-016 migration drift; giữ nguyên để Session B đánh giá, không tự thêm migration sửa ngoài scope. `prisma validate` và `migrate status` đều PASS.
- Frontend lint exit 0, còn 3 warnings cũ trong `vite.config.ts` và `AuthContext.tsx`, không phải file production được đổi ở DEC-016.
- Static privacy scan chỉ áp dụng added lines/untracked text và kiểm tra nguồn synthetic fixtures. Không biến regex scan thành bảo đảm tuyệt đối không có PII; không đọc dữ liệu bệnh nhân thật.
- M0/Run2 fixture được tạo riêng để kiểm chứng mapping, không thay thế Owner product acceptance hoặc historical import authorization.

## Lệnh kiểm tra và giới hạn bàn giao

```bash
cd backend
npx prisma validate
npx prisma migrate status
npm run build
npm test -- --runInBand
npm run test:e2e
```

```bash
cd frontend
npm test
npm run build
npm run lint
```

Từ repo root: `bash frontend/e2e/run-e2e.sh`, rồi `bash scripts/verify-backup-restore.sh`. Hai script và backend E2E dùng cùng test DB: **không chạy song song với nhau**. M0 dùng rehearsal DB riêng. Scripts browser/backup/seed có ghi và xóa dữ liệu giả lập; Session B read-only cần xem bằng chứng hoặc nhận đúng quyền trước khi chạy thao tác ghi.

Không tự đóng Owner product acceptance. Gate kế tiếp: **FRESH CODEX SESSION B — INDEPENDENT READ-ONLY AUDIT**. Không tạo task Session B, commit, push, merge hoặc tag trong Session A.
