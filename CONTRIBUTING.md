# GastroCare — Contributing & Migration Review Process

Cập nhật: 2026-08-21

Tài liệu này định nghĩa quy trình review/approval cho Prisma migration của
`backend/`. Đây là quy trình bắt buộc (REQUIREMENT) trước khi bất kỳ migration
nào được áp dụng vào một môi trường chứa dữ liệu chung/thật (shared or
real-data environment) — xem invariant "Migration review before application"
tại [docs/05_ARCHITECTURE_BASELINE.md](docs/05_ARCHITECTURE_BASELINE.md) và
[docs/06_SAFETY_PRIVACY_AND_GOVERNANCE.md](docs/06_SAFETY_PRIVACY_AND_GOVERNANCE.md).

## Phạm vi áp dụng

Áp dụng cho mọi thay đổi trong `backend/prisma/schema.prisma` và mọi migration
được tạo trong `backend/prisma/migrations/`. Áp dụng từ Gate 2 (Foundation)
trở đi, xuyên suốt mọi phase sau này (bao gồm khi GastroCare Core được thêm).

## Vai trò

- **Migration author:** người (hoặc AI agent, dưới sự giám sát của Owner)
  soạn thảo migration — hiện tại là Claude Code dưới chỉ đạo trực tiếp của
  Owner cho dự án solo/AI-assisted này.
- **Migration reviewer/approver:** Owner, hoặc một technical reviewer được
  Owner chỉ định rõ ràng. Đây là vai trò duy nhất có quyền phê duyệt áp dụng
  migration vào môi trường có dữ liệu chung/thật.

## AI-agent authority boundary

AI (Claude Code hoặc agent tương đương) được phép, không cần approval trước:

- Soạn thảo (draft) migration dựa trên thay đổi schema đã thống nhất.
- Phân tích migration (schema diff, rủi ro mất dữ liệu, thao tác destructive).
- Chạy migration trên database disposable/local/test (vd container Docker
  Compose tạo riêng cho việc test, không chứa dữ liệu thật hay dữ liệu chung).
- Chạy automated verification (test suite, `prisma validate`,
  `prisma migrate status`) trên môi trường disposable/test đó.

AI **KHÔNG BAO GIỜ** được:

- Tự động áp dụng (`migrate deploy`, hoặc tương đương) một migration vào bất
  kỳ môi trường nào chứa dữ liệu chung hoặc dữ liệu thật, kể cả khi migration
  "trông an toàn".
- Tự nâng cấp quyết định của mình thành Owner approval.
- Bỏ qua hoặc tự động xử lý một cảnh báo an toàn do tooling (vd Prisma's
  agent-safety guard) đưa ra mà không dừng lại và hỏi Owner trước.

Nếu tooling (vd Prisma CLI) tự chặn một thao tác vì phát hiện agent AI đang
thực thi, AI phải dừng lại, giải thích rõ hành động/rủi ro, và chờ Owner xác
nhận tường minh trước khi tiếp tục — không được tự tìm cách vòng qua guard đó.

## Checklist review bắt buộc trước khi áp dụng vào môi trường có dữ liệu chung/thật

Mỗi migration phải được đánh giá theo checklist sau trước khi Owner/reviewer
phê duyệt áp dụng ngoài môi trường disposable/test:

1. **Schema change review** — thay đổi có đúng với domain/kiến trúc đã thống
   nhất không (xem [docs/04_CORE_DOMAIN_MODEL.md](docs/04_CORE_DOMAIN_MODEL.md),
   [docs/05_ARCHITECTURE_BASELINE.md](docs/05_ARCHITECTURE_BASELINE.md))? Có
   vi phạm invariant nào không (tenant isolation, signed-record immutability,
   append-only audit, v.v.)?
2. **Data-loss risk review** — migration có thể làm mất dữ liệu hiện có không
   (drop column/table, thay đổi kiểu dữ liệu không tương thích, truncate)?
3. **Destructive-operation review** — migration có chứa `DROP`, `TRUNCATE`,
   hay thao tác không thể hoàn tác khác không? Nếu có, phải nêu rõ lý do và
   phương án giảm rủi ro (backup trước khi chạy, migration theo 2 bước, v.v.).
4. **Tenant-isolation impact review** — migration có ảnh hưởng đến cột/khóa
   ngoại/ràng buộc liên quan đến `tenantId` hoặc ranh giới tenant không?
5. **Clinical-record integrity impact** — khi GastroCare Core đã tồn tại: migration
   có ảnh hưởng đến entity lâm sàng (Encounter, CarePlan, CareTask, AuditEvent)
   hoặc tính bất biến của bản ghi đã ký không? (Không áp dụng ở Gate 2 — chưa
   có entity lâm sàng nào.)
6. **Backup/rollback consideration** — nếu áp dụng vào môi trường có dữ liệu
   chung/thật, đã có backup gần nhất chưa? Có kế hoạch rollback rõ ràng
   (migration down, hoặc restore từ backup) chưa?
7. **Migration execution plan** — migration sẽ chạy bằng lệnh nào, ai chạy,
   khi nào, theo trình tự nào nếu có nhiều migration?
8. **Migration verification evidence** — có bằng chứng migration đã chạy
   thành công và không phá vỡ gì trên môi trường disposable/test trước đó
   không (vd `prisma migrate status`, test suite pass)?
9. **Rule cho production/shared-data application** — migration chỉ được áp
   dụng vào môi trường có dữ liệu chung/thật sau khi checklist này hoàn tất
   VÀ Owner/reviewer đã phê duyệt tường minh. Không có ngoại lệ tự động.

## Quy trình thực tế (dự án solo / AI-assisted hiện tại)

1. AI soạn migration dựa trên thay đổi schema đã thống nhất với Owner.
2. AI chạy migration trên database test disposable (xem
   `docker-compose.test.yml` ở repo root) và chạy test suite Gate liên quan.
3. AI trình bày migration + checklist ở trên cho Owner (trong session hoặc
   qua review code).
4. Owner xem xét và phê duyệt (hoặc yêu cầu sửa) trước khi migration được áp
   dụng vào bất kỳ môi trường nào ngoài disposable/test.
5. Việc áp dụng vào môi trường có dữ liệu chung/thật chỉ được Owner (hoặc
   technical reviewer được chỉ định) thực hiện trực tiếp, không phải AI.

## First concrete example — Gate 2 Foundation migration

Migration đầu tiên trong repository:
`backend/prisma/migrations/20260821073408_foundation_init/`.

Đánh giá theo checklist trên:

1. Schema change review: tạo 3 bảng Foundation-only (`tenants`, `auth_users`,
   `foundation_probe_records`) — không có entity lâm sàng, phù hợp phạm vi
   Gate 2 (xem [docs/07_ROADMAP_AND_GATES.md](docs/07_ROADMAP_AND_GATES.md)).
2. Data-loss risk: KHÔNG — đây là migration đầu tiên, tạo bảng mới, không có
   dữ liệu hiện có nào bị ảnh hưởng.
3. Destructive-operation: KHÔNG — chỉ có `CREATE TABLE` / `CREATE INDEX` /
   `ADD CONSTRAINT`, không có `DROP`/`TRUNCATE`.
4. Tenant-isolation impact: migration này TẠO RA cơ chế tenant isolation
   (cột `tenantId` + foreign key + index trên `auth_users` và
   `foundation_probe_records`) — đúng mục tiêu Gate 2.
5. Clinical-record integrity: KHÔNG ÁP DỤNG — chưa có entity lâm sàng nào.
6. Backup/rollback: không cần thiết cho môi trường disposable/test; sẽ áp
   dụng lại yêu cầu này khi có môi trường chứa dữ liệu chung/thật.
7. Execution plan: `npx prisma migrate dev --name foundation_init`, chạy một
   lần trên database test disposable khi bootstrap Gate 2.
8. Verification evidence: `prisma migrate status` xác nhận "Database schema
   is up to date"; Gate 2 e2e test suite (`backend/test/gate2-foundation.e2e-spec.ts`,
   13/13 tests) chạy thành công trên database đã áp dụng migration này.
9. Rule cho production/shared-data: migration này CHƯA được áp dụng vào bất kỳ
   môi trường nào ngoài database test disposable của session này. Áp dụng vào
   môi trường khác (nếu có trong tương lai) cần Owner phê duyệt riêng.

## Test database — lệnh thực tế

```bash
# Start disposable test PostgreSQL (repo root)
docker compose -f docker-compose.test.yml up -d

# Apply/reset Foundation schema against it (from backend/)
cd backend
npx prisma migrate dev

# Run Gate 2 test suite
npm run test:e2e

# Stop and remove the disposable test database (tmpfs-backed — data is
# already ephemeral; this just tears down the container)
cd ..
docker compose -f docker-compose.test.yml down
```

## FoundationProbeRecord lifecycle note

`FoundationProbeRecord` tồn tại chỉ để kiểm chứng tenant isolation ở Gate 2.
Khi Phase GASTROCARE CORE bắt đầu, nó sẽ được gỡ bỏ qua một migration tường
minh, được review theo đúng checklist ở trên — không được xóa ngầm hoặc viết
lại lịch sử migration.
