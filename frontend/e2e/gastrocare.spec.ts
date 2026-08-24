import { test, expect } from '@playwright/test';

// CORE-02 browser E2E — synthetic data only (Owner Execution Contract
// section 27). Requires the disposable test PostgreSQL + backend + frontend
// preview server to already be running and seeded — see
// frontend/e2e/run-e2e.sh.

const DOCTOR_EMAIL = 'doctor.a@example.test';
const DOCTOR_PASSWORD = 'CoreDoctorE2E-Pass1!';
const RECEPTIONIST_EMAIL = 'reception.a@example.test';
const RECEPTIONIST_PASSWORD = 'CoreReceptionE2E-Pass1!';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3100';

const PATIENT_NAME = 'Nguyễn Văn Minh';
const uniquePhone = `09${Date.now().toString().slice(-8)}`;

test.describe('CORE-02 — Doctor golden path', () => {
  test('login, register patient, initial encounter, care plan sign, follow-up, return encounter, timeline', async ({
    page,
  }) => {
    // 1. Login as Doctor.
    await page.goto('/login');
    await page.getByLabel('Email').fill(DOCTOR_EMAIL);
    await page.getByLabel('Mật khẩu').fill(DOCTOR_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('link', { name: 'Hôm nay' })).toBeVisible();

    // 2. Find or create synthetic Patient.
    await page.getByRole('link', { name: 'Bệnh nhân' }).click();
    await expect(page).toHaveURL(/\/patients$/);
    await page.getByRole('button', { name: '+ Bệnh nhân mới' }).click();
    await page.getByLabel('Họ tên').fill(PATIENT_NAME);
    await page.getByLabel('Ngày sinh').fill('1984-03-15');
    await page.getByLabel('Điện thoại').fill(uniquePhone);
    await page.getByRole('button', { name: 'Tạo bệnh nhân mới' }).click();

    // 3. Open Patient detail (create redirects there).
    await expect(page).toHaveURL(/\/patients\/[^/]+$/);
    await expect(page.getByRole('heading', { name: PATIENT_NAME })).toBeVisible();

    // 4. Create Initial Encounter.
    await page.getByRole('link', { name: '+ Lượt khám mới' }).click();
    await expect(page).toHaveURL(/\/encounters\/new$/);
    await page.getByLabel('Thời điểm khám').fill('2026-08-23T09:00');
    await page.getByLabel('Lý do khám').fill('Đau thượng vị 6 tuần, đầy bụng, ợ nóng');
    await page.getByLabel('Ghi chú lâm sàng').fill('Không nôn máu, không phân đen.');
    await page.getByLabel('Đánh giá').fill('Theo dõi viêm dạ dày / GERD');
    await page.getByRole('button', { name: 'Lưu và tạo kế hoạch chăm sóc' }).click();

    // 5. Create CarePlan.
    await expect(page).toHaveURL(/\/care-plan\/new/);
    await page.getByLabel('Điều trị / dặn dò').fill('Điều trị theo đơn, tái khám 14 ngày');
    await page.getByLabel('Ngày tái khám (tùy chọn)').fill('2026-09-05');
    await page.getByRole('button', { name: 'Lưu bản nháp' }).click();
    await expect(page).toHaveURL(/\/care-plans\/[^/]+$/);

    // 6. Sign CarePlan.
    await page.getByRole('button', { name: 'Ký kế hoạch' }).click();
    await page.getByRole('button', { name: 'Xác nhận ký' }).click();
    await expect(page.getByText('Đã ký', { exact: true })).toBeVisible();

    // 7. Verify OPEN follow-up task exists (Follow-up queue).
    await page.getByRole('link', { name: 'Theo dõi' }).click();
    await expect(page).toHaveURL(/\/follow-up$/);
    await expect(page.getByText(PATIENT_NAME)).toBeVisible();

    // 8. Create Return Encounter for same Patient.
    await page.getByRole('link', { name: PATIENT_NAME }).click();
    await expect(page).toHaveURL(/\/patients\/[^/]+$/);
    await page.getByRole('link', { name: '+ Lượt khám mới' }).click();
    await page.getByLabel('Thời điểm khám').fill('2026-09-06T09:00');
    await page.getByLabel('Lý do khám').fill('Tái khám sau 14 ngày');
    await page.getByLabel('Ghi chú lâm sàng').fill('Đỡ đau thượng vị, còn đầy bụng nhẹ.');
    await page.getByLabel('Đánh giá').fill('Cải thiện, tiếp tục theo dõi');
    await page.getByRole('button', { name: 'Lưu và tạo kế hoạch chăm sóc' }).click();
    // Return encounter created; go back to patient without creating a
    // second CarePlan (Encounter is 1-1 with CarePlan; do not sign twice).
    await expect(page).toHaveURL(/\/care-plan\/new/);
    const patientIdMatch = page.url().match(/patients\/([^/]+)\/care-plan/);
    const patientId = patientIdMatch?.[1];
    expect(patientId).toBeTruthy();

    // 9. Explicitly complete the follow-up task.
    await page.getByRole('link', { name: 'Theo dõi' }).click();
    await expect(page).toHaveURL(/\/follow-up$/);
    const row = page.getByRole('row').filter({ hasText: PATIENT_NAME });
    await row.getByRole('button', { name: 'Hoàn thành' }).click();
    await expect(row).toHaveCount(0);

    // 10. Open Timeline (Patient detail).
    await page.goto(`/patients/${patientId}`);

    // 11. Verify both Encounters are present in correct sequence.
    const timelineItems = page.locator('.timeline-item');
    await expect(timelineItems.filter({ hasText: 'Lượt khám' })).toHaveCount(2);
    const encounterTexts = await timelineItems
      .filter({ hasText: 'Lượt khám' })
      .allTextContents();
    expect(encounterTexts[0]).toContain('Đau thượng vị');
    expect(encounterTexts[1]).toContain('Tái khám sau 14 ngày');
  });
});

test.describe('CORE-02 — Receptionist boundary', () => {
  test('receptionist can register patients but cannot reach clinical routes; backend still enforces 403', async ({
    page,
    request,
  }) => {
    // 12. Login as Receptionist.
    await page.goto('/login');
    await page.getByLabel('Email').fill(RECEPTIONIST_EMAIL);
    await page.getByLabel('Mật khẩu').fill(RECEPTIONIST_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/patients$/);

    // 13. Patient lookup/registration is available.
    await expect(page.getByRole('button', { name: '+ Bệnh nhân mới' })).toBeVisible();
    await expect(page.getByLabel('Tìm bệnh nhân', { exact: false })).toBeVisible();

    // Doctor-only nav items are not shown.
    await expect(page.getByRole('link', { name: 'Hôm nay' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Theo dõi' })).toHaveCount(0);

    // 14. A direct doctor-only clinical route/action is unavailable in the UI.
    await page.goto('/follow-up');
    await expect(page.getByText('Bạn không có quyền truy cập trang này.')).toBeVisible();

    // 15. A direct clinical API/route attempt remains rejected by the
    // backend with 403 even though the receptionist is authenticated.
    const token = await page.evaluate(() => window.localStorage.getItem('gastrocare.accessToken'));
    expect(token).toBeTruthy();
    const response = await request.get(`${API_URL}/care-tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(403);
  });
});

// CORE-03 real-world clinical form alignment browser E2E — synthetic data
// only (design/REAL_WORLD_FORM_ALIGNMENT.md). Covers the HEMORRHOID_LONGO_FOLLOWUP
// v1 template: fill, live score, complete, reopen, and a second longitudinal
// follow-up submission.
const CLINICAL_FORM_PATIENT_NAME = 'Nguyễn Thị Longo';
const clinicalFormPatientPhone = `08${Date.now().toString().slice(-8)}`;

test.describe('CORE-03 — Clinical Forms (HEMORRHOID_LONGO_FOLLOWUP) golden path', () => {
  test('doctor fills, completes, reopens, and submits a second longitudinal follow-up', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DOCTOR_EMAIL);
    await page.getByLabel('Mật khẩu').fill(DOCTOR_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/today$/);

    await page.getByRole('link', { name: 'Bệnh nhân' }).click();
    await page.getByRole('button', { name: '+ Bệnh nhân mới' }).click();
    await page.getByLabel('Họ tên').fill(CLINICAL_FORM_PATIENT_NAME);
    await page.getByLabel('Ngày sinh').fill('1978-05-20');
    await page.getByLabel('Điện thoại').fill(clinicalFormPatientPhone);
    await page.getByRole('button', { name: 'Tạo bệnh nhân mới' }).click();
    await expect(page).toHaveURL(/\/patients\/[^/]+$/);
    const patientId = page.url().match(/patients\/([^/]+)$/)?.[1];
    expect(patientId).toBeTruthy();

    await page.getByRole('link', { name: '+ Lượt khám mới' }).click();
    await page.getByLabel('Thời điểm khám').fill('2026-09-23T09:00');
    await page.getByLabel('Lý do khám').fill('Khám lại sau phẫu thuật Longo 1 tháng');
    await page.getByLabel('Ghi chú lâm sàng').fill('Vết mổ liền tốt.');
    await page.getByLabel('Đánh giá').fill('Theo dõi sau mổ trĩ Longo');
    await page.getByRole('button', { name: 'Lưu và tạo kế hoạch chăm sóc' }).click();
    await expect(page).toHaveURL(/\/care-plan\/new/);
    const encounterId = new URL(page.url()).searchParams.get('encounterId');
    expect(encounterId).toBeTruthy();

    await page.goto(
      `/patients/${patientId}/encounters/${encounterId}/clinical-forms/hemorrhoid-longo-followup`,
    );
    await page.getByRole('button', { name: 'Bắt đầu phiếu khám lại' }).click();
    await expect(page.getByRole('heading', { name: 'Khám lại sau phẫu thuật Longo (trĩ)' })).toBeVisible();

    await page.getByLabel('Lần khám lại thứ').fill('1');
    await page.getByLabel('Số tháng sau phẫu thuật').fill('1');
    await page.getByLabel('Đau (thang điểm VAS, 0-10)').fill('2');
    await page.getByLabel('Đại tiện không tự chủ với phân rắn').selectOption('0');
    await page.getByLabel('Đại tiện không tự chủ với phân lỏng').selectOption('1');
    await page.getByLabel('Không tự chủ với hơi').selectOption('1');
    await page.getByLabel('Phải mang băng vệ sinh/tã').selectOption('0');
    await page.getByLabel('Thay đổi lối sống do rối loạn tự chủ').selectOption('0');
    await expect(page.getByText('Tổng điểm Wexner (tạm tính): 2 / 20')).toBeVisible();

    await page.getByRole('button', { name: 'Hoàn tất phiếu khám lại' }).click();
    await expect(page.getByText('Đã hoàn tất', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Đau (thang điểm VAS, 0-10)')).toBeDisabled();

    // Reopen — verify persistence.
    await page.reload();
    await expect(page.getByText('Đã hoàn tất', { exact: true })).toBeVisible();
    await expect(page.getByText('Tổng điểm Wexner (tạm tính): 2 / 20')).toBeVisible();

    // Timeline shows the completed submission with its computed score.
    await page.goto(`/patients/${patientId}`);
    await expect(page.getByText('Tổng điểm Wexner: 2 / 20')).toBeVisible();

    // Second longitudinal follow-up encounter + submission.
    await page.getByRole('link', { name: '+ Lượt khám mới' }).click();
    await page.getByLabel('Thời điểm khám').fill('2026-11-23T09:00');
    await page.getByLabel('Lý do khám').fill('Khám lại sau phẫu thuật Longo 3 tháng');
    await page.getByLabel('Ghi chú lâm sàng').fill('Ổn định.');
    await page.getByLabel('Đánh giá').fill('Theo dõi định kỳ');
    await page.getByRole('button', { name: 'Lưu và tạo kế hoạch chăm sóc' }).click();
    await expect(page).toHaveURL(/\/care-plan\/new/);
    const secondEncounterId = new URL(page.url()).searchParams.get('encounterId');
    expect(secondEncounterId).toBeTruthy();
    expect(secondEncounterId).not.toBe(encounterId);

    await page.goto(
      `/patients/${patientId}/encounters/${secondEncounterId}/clinical-forms/hemorrhoid-longo-followup`,
    );
    await page.getByRole('button', { name: 'Bắt đầu phiếu khám lại' }).click();
    await page.getByLabel('Lần khám lại thứ').fill('2');
    await page.getByLabel('Số tháng sau phẫu thuật').fill('3');
    await page.getByLabel('Đau (thang điểm VAS, 0-10)').fill('0');
    for (const label of [
      'Đại tiện không tự chủ với phân rắn',
      'Đại tiện không tự chủ với phân lỏng',
      'Không tự chủ với hơi',
      'Phải mang băng vệ sinh/tã',
      'Thay đổi lối sống do rối loạn tự chủ',
    ]) {
      await page.getByLabel(label).selectOption('0');
    }
    await page.getByRole('button', { name: 'Hoàn tất phiếu khám lại' }).click();
    await expect(page.getByText('Đã hoàn tất', { exact: true })).toBeVisible();

    // Longitudinal history: Timeline now shows two completed submissions.
    await page.goto(`/patients/${patientId}`);
    await expect(page.getByText('Phiếu khám lại đã hoàn tất')).toHaveCount(2);
  });
});

test.describe('CORE-03 — Clinical Forms receptionist boundary', () => {
  test('receptionist backend access to clinical form data remains rejected with 403', async ({
    page,
    request,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(RECEPTIONIST_EMAIL);
    await page.getByLabel('Mật khẩu').fill(RECEPTIONIST_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/patients$/);

    const token = await page.evaluate(() => window.localStorage.getItem('gastrocare.accessToken'));
    expect(token).toBeTruthy();

    const listResponse = await request.get(`${API_URL}/clinical-forms?patientId=irrelevant`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listResponse.status()).toBe(403);

    const createResponse = await request.post(`${API_URL}/clinical-forms`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        encounterId: '00000000-0000-0000-0000-000000000000',
        templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
        responses: {},
      },
    });
    expect(createResponse.status()).toBe(403);
  });
});

// CORE-04 T15 — full synthetic Longo clinical pathway, browser E2E
// (docs/09_CORE04_IMPLEMENTATION_CONTRACT.md T15, Gate G). Synthetic data
// only. Covers: Start Episode -> Pre-op -> Surgery -> Early Post-op ->
// follow-up schedule generated -> Two-week visit (no Wexner) -> Anal
// dilation (repeated) -> Month 1 (plannedTimepoint + Wexner) -> Amendment
// -> explicit Episode closure/reopen.
const LONGO_PATIENT_NAME = 'Phạm Thị Longo E2E';
const longoPatientPhone = `07${Date.now().toString().slice(-8)}`;

test.describe('CORE-04 T15 — full Longo Episode pathway golden path', () => {
  test('doctor runs the complete synthetic Longo journey end to end', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DOCTOR_EMAIL);
    await page.getByLabel('Mật khẩu').fill(DOCTOR_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/today$/);

    // 1. Register the synthetic patient.
    await page.getByRole('link', { name: 'Bệnh nhân' }).click();
    await page.getByRole('button', { name: '+ Bệnh nhân mới' }).click();
    await page.getByLabel('Họ tên').fill(LONGO_PATIENT_NAME);
    await page.getByLabel('Ngày sinh').fill('1982-02-02');
    await page.getByLabel('Điện thoại').fill(longoPatientPhone);
    await page.getByRole('button', { name: 'Tạo bệnh nhân mới' }).click();
    await expect(page).toHaveURL(/\/patients\/[^/]+$/);
    const patientId = page.url().match(/patients\/([^/]+)$/)?.[1];
    expect(patientId).toBeTruthy();

    // 2. Start Longo Episode.
    await page.getByRole('button', { name: '+ Bắt đầu đợt điều trị Longo' }).click();
    await page.getByLabel('Thời điểm bắt đầu').fill('2026-01-01T02:00');
    await page.getByRole('button', { name: 'Xác nhận bắt đầu' }).click();
    await expect(page.getByText('ĐANG ĐIỀU TRỊ')).toBeVisible();

    async function createEpisodeEncounter(occurredAt: string, reasonForVisit: string) {
      await page.getByRole('link', { name: '+ Lượt khám trong đợt điều trị' }).click();
      await expect(page).toHaveURL(/\/encounters\/new\?episodeId=/);
      await page.getByLabel('Thời điểm khám').fill(occurredAt);
      await page.getByLabel('Lý do khám').fill(reasonForVisit);
      await page.getByLabel('Ghi chú lâm sàng').fill('x');
      await page.getByLabel('Đánh giá').fill('x');
      await page.getByRole('button', { name: 'Lưu và tạo kế hoạch chăm sóc' }).click();
      await expect(page).toHaveURL(/\/patients\/[^/]+$/);
    }

    // 3. Pre-op.
    await createEpisodeEncounter('2026-01-05T08:00', 'Khám tiền phẫu Longo (E2E)');
    await page.getByRole('link', { name: 'Tiền phẫu' }).last().click();
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page.getByLabel(/Cân nặng/).fill('58');
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await page.goBack();

    // 4. Surgery — LONGO_INTRAOP_RECORD, which triggers follow-up scheduling.
    await createEpisodeEncounter('2026-01-10T07:00', 'Phẫu thuật Longo (E2E)');
    await page.getByRole('link', { name: 'Biên bản mổ' }).last().click();
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page.getByLabel(/Thời gian phẫu thuật/).fill('40');
    await page.getByLabel(/Lượng máu mất/).fill('20');
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await page.goBack();

    // 5. Early post-op on the same Surgery Encounter.
    await page.getByRole('link', { name: 'Hậu phẫu sớm' }).last().click();
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page.getByLabel(/Điểm đau VAS/).fill('3');
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await page.goBack();

    // 6. Follow-up schedule was generated — verify the queue table shows all 4 planned timepoints.
    const followUpTable = page.locator('.data-table');
    await expect(followUpTable.getByText('Tháng 1')).toBeVisible();
    await expect(followUpTable.getByText('Tháng 3')).toBeVisible();
    await expect(followUpTable.getByText('Tháng 6')).toBeVisible();
    await expect(followUpTable.getByText('2 tuần')).toBeVisible();

    // 7. Two-week visit — no Wexner field exists on this template.
    await createEpisodeEncounter('2026-01-24T02:00', 'Tái khám 2 tuần (E2E)');
    await page.getByRole('link', { name: 'Tái khám 2 tuần' }).last().click();
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await expect(page.getByText('Wexner')).toHaveCount(0);
    await page.getByLabel(/Điểm đau VAS/).fill('1');
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await page.goBack();

    // The TWO_WEEK task is now matched/completed.
    await expect(page.getByText('Đã tái khám (thực tế)')).toBeVisible();

    // 8. Anal dilation — repeatable, free text only, no numeric scale.
    await createEpisodeEncounter('2026-02-05T02:00', 'Nong hậu môn lần 1 (E2E)');
    await page.getByRole('link', { name: 'Nong hậu môn' }).last().click();
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page.getByLabel('Đường kính hậu môn').fill('1.5cm (E2E)');
    await page.getByLabel('Mức độ kháng lực khi nong').fill('Nhẹ');
    await page.getByLabel('Đau khi nong').fill('Ít đau');
    await page.getByLabel('Chảy máu khi nong').fill('Không');
    await page.getByLabel('Khả năng đại tiện').fill('Bình thường');
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await page.goBack();

    // 9. Month 1 — plannedTimepoint required + Wexner.
    await createEpisodeEncounter('2026-02-10T02:00', 'Tái khám tháng 1 (E2E)');
    await page.getByRole('link', { name: 'Tái khám dài hạn' }).last().click();
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page.getByLabel(/Mốc tái khám dự kiến/).selectOption('MONTH_1');
    for (const label of [
      'Đại tiện không tự chủ với phân rắn',
      'Đại tiện không tự chủ với phân lỏng',
      'Không tự chủ với hơi',
      'Phải mang băng vệ sinh/tã',
      'Thay đổi lối sống do rối loạn tự chủ',
    ]) {
      await page.getByLabel(label).selectOption('0');
    }
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();

    // 10. Amendment scenario on this Month-1 submission.
    await page.getByRole('button', { name: 'Sửa (tạo phiên bản mới)' }).click();
    await page.getByLabel('Lý do sửa').fill('Điều chỉnh dữ liệu (E2E)');
    await page.getByRole('button', { name: 'Lưu phiên bản mới' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 2)')).toBeVisible();
    await page.goBack();

    // MONTH_1 and TWO_WEEK tasks are now matched/completed (actual visits);
    // MONTH_3/MONTH_6 are still walked below as real clinical occurrences,
    // not merely asserted as pre-existing planned tasks.
    await expect(page.getByText('Đã tái khám (thực tế)')).toHaveCount(2);

    // 10b. Month 3 — a real new Encounter, real LONGO_LONG_TERM_FOLLOWUP
    // completion with plannedTimepoint=MONTH_3 + full Wexner, verified
    // against the correct CareEpisode/CareTask, not just task existence.
    await createEpisodeEncounter('2026-04-10T02:00', 'Tái khám tháng 3 (E2E)');
    await page.getByRole('link', { name: 'Tái khám dài hạn' }).last().click();
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page.getByLabel(/Mốc tái khám dự kiến/).selectOption('MONTH_3');
    for (const label of [
      'Đại tiện không tự chủ với phân rắn',
      'Đại tiện không tự chủ với phân lỏng',
      'Không tự chủ với hơi',
      'Phải mang băng vệ sinh/tã',
      'Thay đổi lối sống do rối loạn tự chủ',
    ]) {
      await page.getByLabel(label).selectOption('1');
    }
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    // plannedTimepoint is displayed back read-only on the completed form —
    // confirm the correct timepoint was actually recorded, not assumed.
    await expect(page.getByLabel(/Mốc tái khám dự kiến/)).toHaveValue('MONTH_3');
    await page.goBack();

    // The MONTH_3 CareTask is now matched/completed by this real Encounter
    // (three of four planned timepoints now show the actual-visit badge).
    await expect(page.getByText('Đã tái khám (thực tế)')).toHaveCount(3);

    // 10c. Month 6 — same real-workflow requirement.
    await createEpisodeEncounter('2026-07-10T02:00', 'Tái khám tháng 6 (E2E)');
    await page.getByRole('link', { name: 'Tái khám dài hạn' }).last().click();
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page.getByLabel(/Mốc tái khám dự kiến/).selectOption('MONTH_6');
    for (const label of [
      'Đại tiện không tự chủ với phân rắn',
      'Đại tiện không tự chủ với phân lỏng',
      'Không tự chủ với hơi',
      'Phải mang băng vệ sinh/tã',
      'Thay đổi lối sống do rối loạn tự chủ',
    ]) {
      await page.getByLabel(label).selectOption('0');
    }
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await expect(page.getByLabel(/Mốc tái khám dự kiến/)).toHaveValue('MONTH_6');
    await page.goBack();

    // All four planned timepoints (TWO_WEEK, MONTH_1, MONTH_3, MONTH_6) are
    // now real completed visits — the full pathway, not just Month 1.
    await expect(page.getByText('Đã tái khám (thực tế)')).toHaveCount(4);

    // Timeline read projection reflects all three LONGO_LONG_TERM_FOLLOWUP
    // completions (MONTH_1 original + amendment revision, MONTH_3, MONTH_6)
    // — confirms correct appearance on the Timeline, not just CareTask state.
    await expect(page.getByText('LONGO_LONG_TERM_FOLLOWUP')).toHaveCount(4);

    // 11. Explicit Episode closure, then reopen.
    await page.getByRole('button', { name: 'Đóng đợt điều trị' }).click();
    await expect(page.getByText('ĐÃ ĐÓNG')).toBeVisible();
    await page.getByRole('button', { name: 'Mở lại đợt điều trị' }).click();
    await page.getByLabel('Lý do mở lại').fill('Cần ghi chép bổ sung (E2E)');
    await page.getByRole('button', { name: 'Xác nhận mở lại' }).click();
    await expect(page.getByText('ĐANG ĐIỀU TRỊ')).toBeVisible();
  });
});
