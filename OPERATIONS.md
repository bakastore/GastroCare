# GastroCare — Local Operations & Owner Synthetic Dry Run

Cập nhật: 2026-08-21

This document is operational, not architectural — it does not redefine any
Core domain invariant. See `docs/` for the authoritative Documentation
Baseline. Everything below runs against the disposable/test PostgreSQL
container defined in `docker-compose.test.yml` only. **Synthetic data only.
No real patient data. No production deployment.**

---

## 1. Local Operations — reproducible procedure

All commands below assume the repository root as the working directory.

### 1.1 Start the disposable database

```bash
docker compose -f docker-compose.test.yml up -d
```

### 1.2 Apply migrations

```bash
cd backend
npx prisma migrate deploy
```

### 1.3 Seed synthetic data

Two seed scripts exist, for two different purposes:

- `npm run seed:e2e` — accounts only (`doctor.a@example.test`,
  `reception.a@example.test`), **no** patients. Used by the Playwright
  browser suite, which creates its own patient at test time.
- `npm run seed:pilot` — the full deterministic synthetic pilot dataset
  (see §2 below). Use this before an Owner Synthetic Dry Run.

```bash
cd backend
npm run seed:pilot
```

### 1.4 Start the backend

```bash
cd backend
npm run start:dev
# Listens on http://localhost:3000 by default (see backend/.env)
```

### 1.5 Start the frontend

```bash
cd frontend
npm run dev
# Listens on http://localhost:5173 by default
```

### 1.6 Login

Open `http://localhost:5173/login` in a browser.

- Doctor: `doctor.a@example.test` / `CoreDoctorPilot-Pass1!`
- Receptionist: `reception.a@example.test` / `CoreReceptionPilot-Pass1!`

(These are the credentials `seed:pilot` creates. If you used `seed:e2e`
instead, the password is `CoreDoctorE2E-Pass1!` / `CoreReceptionE2E-Pass1!`.)

### 1.7 Run backend tests

```bash
cd backend
npm run test:e2e
```

### 1.8 Run frontend tests

```bash
cd frontend
npm run test
```

### 1.9 Run browser E2E

```bash
cd frontend
./e2e/run-e2e.sh
```

This starts its own backend/frontend instances on ports 3100/4173 (so it
does not collide with anything you started manually in §1.4/§1.5), runs the
full Playwright suite, and resets the DB back to the `seed:e2e` accounts-only
state when it finishes.

### 1.10 Run backup/restore verification

```bash
./scripts/verify-backup-restore.sh
```

Seeds the pilot dataset, backs it up, destroys the disposable DB's data,
restores it, verifies the restore, then re-seeds the pilot dataset so the DB
is left ready for a dry run. See §3 for what this proves.

### 1.11 Stop the environment

```bash
# Ctrl-C the backend/frontend dev processes, then:
docker compose -f docker-compose.test.yml down
```

`down` removes the container; since it uses a `tmpfs` data directory (see
`docker-compose.test.yml`), the data was never persisted to disk anyway —
this is a disposable database by design.

---

## 2. Synthetic Pilot Dataset (`npm run seed:pilot`)

Deterministic, fictional data only. Running it always resets the disposable
DB first, so it is safe to re-run at any time.

| Entity | Detail |
|---|---|
| Tenant | "GastroCare CORE-03 Synthetic Pilot Tenant" |
| Doctor | `doctor.a@example.test` |
| Receptionist | `reception.a@example.test` |
| Patient 1 | Nguyễn Văn Minh — initial Encounter → CarePlan → Signed (v1) → Amended (v2, reason: "Đáp ứng chưa đủ với liều ban đầu") → Return Encounter → follow-up CareTask explicitly **completed**; Return Encounter also carries one **completed** `HEMORRHOID_LONGO_FOLLOWUP` Clinical Form submission (fictional VAS/Wexner responses) |
| Patient 2 | Trần Thị Hoa — initial Encounter → CarePlan → Signed → follow-up CareTask left **OPEN with a past due date** (demonstrates derived OVERDUE) |

Every write goes through the real application services (not raw SQL), so
AuditEvent rows, CarePlanVersion lineage, and CareTask auto-creation are all
produced exactly as they would be from real browser use.

---

## 3. Owner Synthetic Dry Run

A practical, browser-based checklist. Run `seed:pilot` first (§1.3) and have
the backend + frontend running (§1.4–1.5). Every step below uses fictional
data only.

### Scenario 1 — New Patient

1. Login as Doctor.
2. Go to "Bệnh nhân" → "+ Bệnh nhân mới".
3. Register a new fictional patient (any name other than "Nguyễn Văn Minh"
   or "Trần Thị Hoa", to avoid triggering the duplicate warning here — see
   Scenario 3 for that).
4. Open the new patient → "+ Lượt khám mới" → fill in reason/note/assessment
   → save.
5. On the CarePlan screen, enter instructions + a follow-up date → "Lưu bản
   nháp".
6. "Ký kế hoạch" → confirm.
7. Go to "Theo dõi" — the new OPEN follow-up task is listed.

### Scenario 2 — Return Visit

1. Go to "Bệnh nhân" → open "Nguyễn Văn Minh" (already has history from the
   pilot seed).
2. Review the Timeline — two Encounters, a signed CarePlan (v1) with an
   amendment (v2), and a COMPLETED CareTask should already be visible.
3. "+ Lượt khám mới" → create a further return Encounter.
4. Confirm it appears in the Timeline, after the prior Encounters.

### Scenario 3 — Duplicate Patient

1. "Bệnh nhân" → "+ Bệnh nhân mới".
2. Enter fullName "Nguyễn Văn Minh", dateOfBirth `1984-03-15`, phone
   `0901234567` — matching the pilot-seeded patient exactly.
3. Click "Kiểm tra trùng lặp" — the existing patient is listed as a
   candidate, with a link to open their existing record.
4. Confirm the warning **never** auto-merges — you can either:
   - click "Mở hồ sơ này" to open the existing patient instead, or
   - click "Tạo bệnh nhân mới" anyway, which creates a genuinely separate
     Patient with its own id (prove this by checking the patient list now
     shows two distinct "Nguyễn Văn Minh" rows).

### Scenario 4 — CarePlan Amendment

1. Open "Nguyễn Văn Minh" → Timeline → "Xem kế hoạch chăm sóc" on the signed
   CarePlan entry.
2. "Sửa (tạo phiên bản mới)" → enter new instructions + a reason → save.
3. Scroll to "Lịch sử phiên bản đã ký" — both the original version and the
   new version are listed, with the amendment reason attached. The original
   is never overwritten.

### Scenario 5 — RBAC

1. Logout, login as Receptionist (`reception.a@example.test`).
2. Confirm "Bệnh nhân" is available — patient search/registration works.
3. Confirm no "Hôm nay" or "Theo dõi" nav items are shown.
4. Open a patient — confirm clinical Timeline/Encounter content is not
   shown, only identity fields.
5. Manually navigate the browser to `/follow-up` — confirm an access-denied
   page is shown, not the clinical queue.

### Scenario 6 — Overdue Follow-up

1. Login as Doctor.
2. Go to "Hôm nay" or "Theo dõi".
3. "Trần Thị Hoa"'s follow-up task (seeded with a due date 3 days in the
   past) is shown with a "Quá hạn" (overdue) badge — this is computed at
   request time from `status == OPEN AND dueDate < now`, never stored as its
   own status (see `docs/04_CORE_DOMAIN_MODEL.md` — CareTask).

### Scenario 7 — Backup / Restore

1. Run `./scripts/verify-backup-restore.sh` (§1.10) — it seeds, backs up,
   destroys, restores, and verifies automatically, then leaves the DB in the
   pilot dry-run state.
2. Refresh the browser and open "Nguyễn Văn Minh" — confirm the Timeline,
   the CarePlan amendment, and the completed CareTask are all still present,
   i.e. history survived a real backup/restore cycle.

---

## 4. Scope reminders

- Disposable/local/test PostgreSQL only — never a shared or production
  database (see `CONTRIBUTING.md`).
- Synthetic/fictional data only — no real patient data, no real BS Thái
  pilot data.
- No production deployment exists or is created by any procedure here.
- `scripts/verify-backup-restore.sh` refuses to run against anything other
  than the specific disposable container `docker-compose.test.yml` defines.
