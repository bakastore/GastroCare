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
    await page.getByRole('button', { name: '+ Tạo lượt khám' }).click();
    await page.getByRole('menuitem', { name: 'Khám khác' }).click();
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
    await page.getByRole('button', { name: '+ Tạo lượt khám' }).click();
    await page.getByRole('menuitem', { name: 'Khám khác' }).click();
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
    await row.getByRole('button', { name: 'Hoàn thành', exact: true }).click();
    await expect(row).toHaveCount(0);

    // 10. Open Timeline (Patient detail).
    await page.goto(`/patients/${patientId}`);

    // 11. Verify both Encounters are present in correct sequence.
    const timelineItems = page.locator('.timeline-item');
    await expect(timelineItems.filter({ hasText: 'Lượt khám' })).toHaveCount(2);
    const encounterTexts = await timelineItems.filter({ hasText: 'Lượt khám' }).allTextContents();
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

    await page.getByRole('button', { name: '+ Tạo lượt khám' }).click();
    await page.getByRole('menuitem', { name: 'Khám khác' }).click();
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
    await expect(
      page.getByRole('heading', {
        name: 'Khám lại sau phẫu thuật Longo (trĩ)',
      }),
    ).toBeVisible();

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
    await page.getByRole('button', { name: '+ Tạo lượt khám' }).click();
    await page.getByRole('menuitem', { name: 'Khám khác' }).click();
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
  test('doctor runs the complete synthetic Longo journey end to end', async ({ page, request }) => {
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

    // DEC-016: Case starts at Initial; Longo is a nested explicit pathway.
    const token = await page.evaluate(() => localStorage.getItem('gastrocare.accessToken'));
    const headers = { Authorization: `Bearer ${token}` };
    const initialRes = await request.post(`${API_URL}/encounters`, {
      headers,
      data: {
        patientId,
        workflowKind: 'HEMORRHOID_INITIAL',
        occurredAt: '2026-01-01T02:00:00.000Z',
        reasonForVisit: 'synthetic Initial for Longo Case',
      },
    });
    expect(initialRes.ok()).toBeTruthy();
    const initial = await initialRes.json();
    await page.reload();
    await expect(page.getByText('Case trĩ')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Bắt đầu đợt điều trị Longo' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Điều trị', exact: true }).click();
    await page.getByLabel('Thời điểm bắt đầu phương thức').fill('2026-01-01T02:00');
    await page.getByRole('button', { name: 'Thêm phương thức điều trị' }).click();
    await expect(page.getByTestId('treatment-pathway')).toHaveCount(1);

    async function createEpisodeEncounter(occurredAt: string, reasonForVisit: string) {
      await page.getByRole('tab', { name: 'Điều trị', exact: true }).click();
      await page.getByRole('link', { name: /Lượt khám trong phương thức điều trị/ }).click();
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

    // Case closure is guarded by a completed Hemorrhoid Return assessment.
    // Build that explicit source/task/Return context via the API; UI exercises
    // close/reopen. The continuous-care browser spec covers Return entry itself.
    async function complete(encounterId: string, templateKey: string, responses: object) {
      const f = await request.post(`${API_URL}/clinical-forms`, {
        headers,
        data: { encounterId, templateKey, responses },
      });
      expect(f.ok()).toBeTruthy();
      const done = await request.post(`${API_URL}/clinical-forms/${(await f.json()).id}/complete`, {
        headers,
      });
      expect(done.ok()).toBeTruthy();
    }
    await complete(initial.id, 'HEMORRHOID_EXAMINATION', {});
    await complete(initial.id, 'HEMORRHOID_DIAGNOSIS', {
      diagnosisSummary: 'synthetic',
    });
    await complete(initial.id, 'HEMORRHOID_TREATMENT_DECISION', {
      decisionSummary: 'synthetic',
      treatmentModalities: ['SURGERY'],
    });
    const cp = await request.post(`${API_URL}/care-plans`, {
      headers,
      data: {
        encounterId: initial.id,
        instructions: 'synthetic',
        followUpDate: '2026-08-01',
      },
    });
    expect(cp.ok()).toBeTruthy();
    const signed = await request.post(`${API_URL}/care-plans/${(await cp.json()).id}/sign`, {
      headers,
    });
    expect(signed.ok()).toBeTruthy();
    const ret = await request.post(`${API_URL}/encounters/hemorrhoid-return`, {
      headers,
      data: {
        careTaskId: (await signed.json()).careTask.id,
        occurredAt: '2026-08-01T00:00:00Z',
        reasonForVisit: 'synthetic Case review',
      },
    });
    expect(ret.ok()).toBeTruthy();
    await complete((await ret.json()).id, 'HEMORRHOID_FOLLOW_UP_ASSESSMENT', {
      responseSummary: 'synthetic',
    });
    await page.reload();
    await page.getByRole('button', { name: 'Kết thúc đợt theo dõi' }).click();
    await expect(page.getByText('ĐÃ ĐÓNG')).toBeVisible();
    await page.getByRole('button', { name: 'Mở lại đợt theo dõi' }).click();
    await page.getByLabel('Lý do mở lại').fill('Cần ghi chép bổ sung (E2E)');
    await page.getByRole('button', { name: 'Xác nhận mở lại' }).click();
    await expect(page.getByText('ĐANG ĐIỀU TRỊ')).toBeVisible();
  });
});

// DEC-010 Hemorrhoid Vertical Slice 1 — real-world workflow browser E2E,
// added as a Vertical Slice 1 correction (ChatGPT review Finding 1: the
// authorized workflow must be provable through the real browser UI, not
// just the backend API). This is a DISTINCT test path from the CORE-04 T15
// Longo pathway above — it exercises the new Facility/Room/responsible
// clinician Encounter Context UI and the HEMORRHOID_EXAMINATION v1 form,
// neither of which the Longo suite touches. Synthetic data only.
test.describe('DEC-010 Hemorrhoid Vertical Slice 1 — real-world workflow golden path', () => {
  test('receptionist creates Encounter Context (Facility/Room/default clinician); doctor opens HEMORRHOID_EXAMINATION with vitals copy-forward, distinct morphology/symptom/observed fields, and persistence after reload', async ({
    page,
    request,
  }) => {
    const patientName = `Trần Thị Trĩ E2E ${Date.now()}`;
    const patientPhone = `06${Date.now().toString().slice(-8)}`;

    // --- Setup: Doctor creates a Facility + Room via the API. Vertical
    // Slice 1 has no Facility/Room *administration* UI (only *selection*
    // UI is in scope) — this mirrors the existing spec's convention of
    // using the `request` fixture for setup/boundary calls alongside real
    // browser interaction for the workflow under test.
    await page.goto('/login');
    await page.getByLabel('Email').fill(DOCTOR_EMAIL);
    await page.getByLabel('Mật khẩu').fill(DOCTOR_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/today$/);
    const doctorToken = await page.evaluate(() =>
      window.localStorage.getItem('gastrocare.accessToken'),
    );
    expect(doctorToken).toBeTruthy();

    const facilityRes = await request.post(`${API_URL}/facilities`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
      data: { name: `Cơ sở Trĩ E2E ${Date.now()}` },
    });
    expect(facilityRes.ok()).toBeTruthy();
    const facility = await facilityRes.json();

    const roomRes = await request.post(`${API_URL}/rooms`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
      data: { facilityId: facility.id, name: 'Phòng khám trĩ E2E' },
    });
    expect(roomRes.ok()).toBeTruthy();
    const room = await roomRes.json();

    // 1a. Doctor registers the synthetic patient.
    await page.getByRole('link', { name: 'Bệnh nhân' }).click();
    await page.getByRole('button', { name: '+ Bệnh nhân mới' }).click();
    await page.getByLabel('Họ tên').fill(patientName);
    await page.getByLabel('Ngày sinh').fill('1975-06-10');
    await page.getByLabel('Điện thoại').fill(patientPhone);
    await page.getByRole('button', { name: 'Tạo bệnh nhân mới' }).click();
    await expect(page).toHaveURL(/\/patients\/[^/]+$/);
    const patientId = page.url().match(/patients\/([^/]+)$/)?.[1];
    expect(patientId).toBeTruthy();

    // 1b. Doctor creates a FIRST hemorrhoid Encounter Context directly and
    // completes an exam with vitals — this becomes the prior COMPLETED
    // source record for vital-sign copy-forward (DEC-010 §6) into the
    // SECOND encounter created below.
    await page.getByRole('button', { name: '+ Tạo lượt khám' }).click();
    await page.getByRole('menuitem', { name: 'Khám trĩ' }).click();
    await expect(page).toHaveURL(/\/hemorrhoid\/new-encounter$/);
    await page.getByLabel('Thời điểm khám').fill('2026-08-01T09:00');
    await page.getByLabel('Lý do khám').fill('Khám trĩ lần đầu (E2E)');
    await page.getByLabel('Cơ sở khám').selectOption(facility.id);
    await page.getByLabel('Phòng khám').selectOption(room.id);
    await page.getByRole('button', { name: 'Tạo lượt khám' }).click();
    await expect(page.getByRole('heading', { name: 'Đã tạo lượt khám trĩ' })).toBeVisible();
    await page.getByRole('button', { name: 'Mở phiếu khám trĩ' }).click();
    await expect(page).toHaveURL(/\/hemorrhoid-examination$/);
    await expect(page.getByRole('heading', { name: 'Khám trĩ' })).toBeVisible();

    await page.getByRole('button', { name: 'Bắt đầu phiếu khám trĩ' }).click();
    await page.getByLabel(/Cân nặng/).fill('60');
    await page.getByLabel(/Chiều cao/).fill('165');
    await page.getByLabel(/^Mạch/).fill('78');
    await page.getByLabel(/Nhiệt độ/).fill('37');
    await page.getByLabel(/Huyết áp tâm thu/).fill('120');
    await page.getByLabel(/Huyết áp tâm trương/).fill('80');
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();

    // 2. Switch to RECEPTIONIST — creates the SECOND Encounter Context
    // (Facility + Room + default responsible clinician), proving the
    // receptionist-facing part of the workflow.
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/login$/);
    // Navigate through "/" (not "/login" directly) — the browser's
    // history.state (carrying the logout redirect's `from` location) would
    // otherwise survive even a fresh goto to the same URL. HomeRedirect's
    // Navigate carries no state, so this actually clears it, and an
    // unauthenticated "/" lands back on /login with a clean history entry.
    await page.goto('/');
    await page.getByLabel('Email').fill(RECEPTIONIST_EMAIL);
    await page.getByLabel('Mật khẩu').fill(RECEPTIONIST_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/patients$/);

    await page.goto(`/patients/${patientId}`);
    await expect(page.getByRole('heading', { name: patientName })).toBeVisible();
    // Receptionist role boundary: no clinical-content view, only the
    // Encounter Context entry point.
    await expect(
      page.getByText('Không có quyền xem nội dung lâm sàng chi tiết của bệnh nhân này.'),
    ).toBeVisible();

    await page.getByRole('link', { name: '+ Lượt khám trĩ mới (tiếp đón)' }).click();
    await expect(page).toHaveURL(/\/hemorrhoid\/new-encounter$/);
    await page.getByLabel('Thời điểm khám').fill('2026-08-15T09:00');
    await page.getByLabel('Lý do khám').fill('Khám trĩ tái khám (E2E, tiếp đón)');
    await page.getByLabel('Cơ sở khám').selectOption(facility.id);
    await page.getByLabel('Phòng khám').selectOption(room.id);
    // Leave "Bác sĩ phụ trách" on its default option — proves the pilot
    // default clinician is resolved through config/lookup, not hardcoded
    // in the UI: the confirmation below must show the actual resolved
    // clinician email plus the "(mặc định hệ thống)" marker, not a literal
    // id baked into this test or the UI.
    await page.getByRole('button', { name: 'Tạo lượt khám' }).click();
    await expect(page.getByRole('heading', { name: 'Đã tạo lượt khám trĩ' })).toBeVisible();
    await expect(page.getByText(facility.name)).toBeVisible();
    await expect(page.getByText(room.name)).toBeVisible();
    await expect(page.getByText(`${DOCTOR_EMAIL} (mặc định hệ thống)`)).toBeVisible();
    // Receptionist cannot open the exam directly — no such button/route.
    await expect(page.getByRole('button', { name: 'Mở phiếu khám trĩ' })).toHaveCount(0);

    // 3. Switch back to DOCTOR — opens the Encounter from the patient
    // Timeline (not a URL guess), opens HEMORRHOID_EXAMINATION.
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/login$/);
    // See the comment above the first role switch — go through "/" so the
    // stale post-logout redirect state doesn't survive into this login.
    await page.goto('/');
    await page.getByLabel('Email').fill(DOCTOR_EMAIL);
    await page.getByLabel('Mật khẩu').fill(DOCTOR_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/today$/);

    await page.goto(`/patients/${patientId}`);
    await expect(page.getByText('Khám trĩ tái khám (E2E, tiếp đón)')).toBeVisible();
    // Two ungrouped Encounters now exist for this patient (the doctor's
    // first one, and the receptionist's second one) — open the second
    // Encounter's exam link (last() = most recently listed).
    await page.getByRole('link', { name: 'Khám trĩ', exact: true }).last().click();
    await expect(page).toHaveURL(/\/hemorrhoid-examination$/);

    // Encounter Context panel shows Facility/Room/responsible clinician
    // resolved for THIS Encounter (the default-resolved doctor), and a
    // handover control exists.
    await expect(page.getByRole('heading', { name: 'Bối cảnh lượt khám' })).toBeVisible();
    await expect(page.getByText(facility.name)).toBeVisible();
    await expect(page.getByText(room.name)).toBeVisible();
    await expect(page.getByRole('button', { name: /Đổi bác sĩ phụ trách/ })).toBeVisible();

    // 4. Starting the exam copies forward vitals from the prior COMPLETED
    // examination (weight 60 / height 165 / pulse 78 / temp 37 / BP
    // 120/80) — visible immediately, before any edit.
    await expect(page.getByText(/Đã sao chép sinh hiệu từ lần khám gần nhất/)).toBeVisible();
    await page.getByRole('button', { name: 'Bắt đầu phiếu khám trĩ' }).click();
    await expect(page.getByLabel(/Cân nặng/)).toHaveValue('60');
    await expect(page.getByLabel(/Chiều cao/)).toHaveValue('165');
    await expect(page.getByLabel(/^Mạch/)).toHaveValue('78');
    await expect(page.getByLabel(/Huyết áp tâm thu/)).toHaveValue('120');

    // 5. Change at least one copied vital.
    await page.getByLabel(/Cân nặng/).fill('62');

    // 6. Morphology: Internal/External/Mixed each get independent
    // count/location/size (Finding 2's 33-field split), plus exactly one
    // Goligher grade.
    await page.getByLabel('Phân độ Goligher').selectOption('III');
    await page.getByLabel('Số lượng búi trĩ nội').fill('2');
    await page.getByLabel('Vị trí búi trĩ nội (theo mặt đồng hồ)').selectOption(['3h', '7h']);
    await page.getByLabel('Kích thước búi trĩ nội').fill('1.5cm (E2E)');
    await page.getByLabel('Số lượng búi trĩ ngoại').fill('1');
    await page.getByLabel('Vị trí búi trĩ ngoại (theo mặt đồng hồ)').selectOption(['11h']);
    await page.getByLabel('Kích thước búi trĩ ngoại').fill('0.8cm (E2E)');
    await page.getByLabel('Số lượng búi trĩ hỗn hợp').fill('1');
    await page.getByLabel('Vị trí búi trĩ hỗn hợp (theo mặt đồng hồ)').selectOption(['5h']);
    await page.getByLabel('Kích thước búi trĩ hỗn hợp').fill('2.1cm (E2E)');

    // 7. Symptom vs observed are distinct controls for BOTH prolapse and
    // bleeding — four separate fields, deliberately set to DIFFERENT
    // values from each other to prove they are not merged/derived.
    await page.getByLabel('Sa búi trĩ (bệnh nhân khai)').selectOption('true');
    await page.getByLabel('Sa búi trĩ (bác sĩ ghi nhận khi khám)').selectOption('false');
    await page.getByLabel('Chảy máu (bệnh nhân khai)').selectOption('false');
    await page.getByLabel('Chảy máu (bác sĩ ghi nhận khi khám)').selectOption('true');

    // 8. Complete the examination.
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await expect(page.getByLabel(/Cân nặng/)).toHaveValue('62');
    await expect(page.getByLabel(/Cân nặng/)).toBeDisabled();

    // 9. Persistence: reload the page (not in-memory) and re-verify every
    // distinct field kept its own value.
    await page.reload();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await expect(page.getByLabel(/Cân nặng/)).toHaveValue('62');
    await expect(page.getByLabel('Phân độ Goligher')).toHaveValue('III');
    await expect(page.getByLabel('Kích thước búi trĩ nội')).toHaveValue('1.5cm (E2E)');
    await expect(page.getByLabel('Kích thước búi trĩ ngoại')).toHaveValue('0.8cm (E2E)');
    await expect(page.getByLabel('Kích thước búi trĩ hỗn hợp')).toHaveValue('2.1cm (E2E)');
    await expect(page.getByLabel('Sa búi trĩ (bệnh nhân khai)')).toHaveValue('true');
    await expect(page.getByLabel('Sa búi trĩ (bác sĩ ghi nhận khi khám)')).toHaveValue('false');
    await expect(page.getByLabel('Chảy máu (bệnh nhân khai)')).toHaveValue('false');
    await expect(page.getByLabel('Chảy máu (bác sĩ ghi nhận khi khám)')).toHaveValue('true');

    // Re-navigating (not just reload) also shows the persisted state.
    await page.goto(`/patients/${patientId}`);
    await page.getByRole('link', { name: 'Khám trĩ', exact: true }).last().click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await expect(page.getByLabel(/Cân nặng/)).toHaveValue('62');

    // 10. Finding 5 — Amendment must actually allow editing, not just
    // resubmit the old snapshot with a reason. Fields are read-only until
    // amendment mode is entered.
    await expect(page.getByLabel(/Cân nặng/)).toBeDisabled();
    await page.getByRole('button', { name: 'Sửa (tạo phiên bản mới)' }).click();
    // Entering amendment mode loads the current completed snapshot into
    // EDITABLE fields (the bug this corrects: fields used to stay disabled
    // here).
    await expect(page.getByLabel(/Cân nặng/)).toBeEnabled();
    await expect(page.getByLabel(/Cân nặng/)).toHaveValue('62');

    // 11. Change at least one meaningful field.
    await page.getByLabel(/Cân nặng/).fill('65');

    // 12. Enter an amendment reason and submit.
    await page.getByLabel('Lý do sửa').fill('Điều chỉnh cân nặng ghi nhận sai (E2E)');
    await page.getByRole('button', { name: 'Lưu phiên bản mới' }).click();

    // 13. Revision 2 appears with the corrected value, and is read-only
    // again once completed.
    const encounterUrlMatch = page
      .url()
      .match(/\/patients\/([^/]+)\/encounters\/([^/]+)\/hemorrhoid-examination$/);
    const hemorrhoidEncounterId = encounterUrlMatch?.[2];
    expect(hemorrhoidEncounterId).toBeTruthy();

    await expect(page.getByText('Đã hoàn tất (phiên bản 2)')).toBeVisible();
    await expect(page.getByLabel(/Cân nặng/)).toHaveValue('65');
    await expect(page.getByLabel(/Cân nặng/)).toBeDisabled();

    // 14. Reload the browser — revision 2's values persist.
    await page.reload();
    await expect(page.getByText('Đã hoàn tất (phiên bản 2)')).toBeVisible();
    await expect(page.getByLabel(/Cân nặng/)).toHaveValue('65');

    // 15. History shows both revision 1 and revision 2 (scoped to the
    // version-history list — the status badge above also contains the text
    // "phiên bản 2", so an unscoped match would be ambiguous).
    const historyList = page.locator('ul.version-history');
    await expect(historyList.getByText('Phiên bản 1', { exact: true })).toBeVisible();
    await expect(historyList.getByText('Phiên bản 2', { exact: true })).toBeVisible();

    // 16. Revision 1 was never overwritten — its original value (weight 62,
    // before the amendment) is still retrievable via the same history data
    // the UI list above is rendered from.
    const submissionsRes = await request.get(`${API_URL}/clinical-forms?patientId=${patientId}`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    expect(submissionsRes.ok()).toBeTruthy();
    const submissions = await submissionsRes.json();
    const rootSubmission = submissions.find(
      (s: { encounterId: string; templateKey: string; revisionNumber: number }) =>
        s.encounterId === hemorrhoidEncounterId &&
        s.templateKey === 'HEMORRHOID_EXAMINATION' &&
        s.revisionNumber === 1,
    );
    expect(rootSubmission).toBeTruthy();

    const historyRes = await request.get(`${API_URL}/clinical-forms/${rootSubmission.id}/history`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    expect(historyRes.ok()).toBeTruthy();
    const history = await historyRes.json();
    expect(history.revisions).toHaveLength(2);
    const revision1 = history.revisions.find(
      (r: { revisionNumber: number }) => r.revisionNumber === 1,
    );
    const revision2 = history.revisions.find(
      (r: { revisionNumber: number }) => r.revisionNumber === 2,
    );
    expect(revision1.responses.weight).toBe(62);
    expect(revision2.responses.weight).toBe(65);
    expect(history.current.revisionNumber).toBe(2);
    expect(history.current.responses.weight).toBe(65);
  });
});

// DEC-012 Hemorrhoid Vertical Slice 2 (T6) browser E2E — golden path only:
// Examination -> Diagnosis -> Treatment Decision -> CarePlan create/sign ->
// follow-up CareTask -> CD-08 amendment reconciliation -> Return Encounter ->
// explicit CareTask completion via completedByEncounterId -> Timeline
// projection. Backend remains authoritative throughout; this only checks the
// UI guides/reflects that sequence. Synthetic data only.
test.describe('DEC-012 Hemorrhoid Vertical Slice 2 — T6 golden path', () => {
  test('Diagnosis -> Treatment Decision -> CarePlan -> sign -> CD-08 reconciliation -> explicit Return Encounter completion -> Timeline', async ({
    page,
  }) => {
    const patientName = `Lê Thị Slice2 E2E ${Date.now()}`;
    const patientPhone = `07${Date.now().toString().slice(-8)}`;
    const diagnosisSummary = `Trĩ nội độ III (E2E ${Date.now()})`;
    const decisionSummary = `Điều trị nội khoa, hẹn tái khám (E2E ${Date.now()})`;

    await page.goto('/login');
    await page.getByLabel('Email').fill(DOCTOR_EMAIL);
    await page.getByLabel('Mật khẩu').fill(DOCTOR_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/today$/);

    // 1. Register patient + first hemorrhoid Encounter Context.
    await page.getByRole('link', { name: 'Bệnh nhân' }).click();
    await page.getByRole('button', { name: '+ Bệnh nhân mới' }).click();
    await page.getByLabel('Họ tên').fill(patientName);
    await page.getByLabel('Ngày sinh').fill('1982-04-20');
    await page.getByLabel('Điện thoại').fill(patientPhone);
    await page.getByRole('button', { name: 'Tạo bệnh nhân mới' }).click();
    await expect(page).toHaveURL(/\/patients\/[^/]+$/);
    const patientId = page.url().match(/patients\/([^/]+)$/)?.[1];
    expect(patientId).toBeTruthy();

    await page.getByRole('button', { name: '+ Tạo lượt khám' }).click();
    await page.getByRole('menuitem', { name: 'Khám trĩ' }).click();
    await page.getByLabel('Thời điểm khám').fill('2026-09-01T09:00');
    await page.getByLabel('Lý do khám').fill('Khám trĩ lần đầu (E2E Slice 2)');
    await page.getByRole('button', { name: 'Tạo lượt khám' }).click();
    await expect(page.getByRole('heading', { name: 'Đã tạo lượt khám trĩ' })).toBeVisible();
    await page.getByRole('button', { name: 'Mở phiếu khám trĩ' }).click();
    await expect(page).toHaveURL(/\/hemorrhoid-examination$/);

    // 2. Complete Examination (no required fields).
    await page.getByRole('button', { name: 'Bắt đầu phiếu khám trĩ' }).click();
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await page.getByRole('button', { name: 'Về hồ sơ bệnh nhân' }).click();
    await expect(page).toHaveURL(/\/patients\/[^/]+$/);

    // 3. Sequence chain: Examination done -> "Chẩn đoán" is the next
    // reachable step; Treatment Decision / CarePlan are guided as
    // unreachable yet (backend prerequisite, not just UI decoration).
    await expect(page.getByRole('link', { name: 'Chẩn đoán' })).toBeVisible();
    await expect(page.getByText('Quyết định điều trị', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quyết định điều trị' })).toHaveCount(0);

    // 4. Diagnosis — reuses the generic Clinical Form renderer.
    await page.getByRole('link', { name: 'Chẩn đoán' }).click();
    await expect(page.getByRole('heading', { name: 'Chẩn đoán', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page.getByLabel('Chẩn đoán *').fill(diagnosisSummary);
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await page.getByRole('button', { name: 'Về hồ sơ bệnh nhân' }).click();

    // 5. Diagnosis done -> Treatment Decision now reachable; CarePlan still
    // guided as unreachable.
    await expect(page.getByRole('link', { name: 'Chẩn đoán ✓' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quyết định điều trị' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tạo kế hoạch chăm sóc' })).toHaveCount(0);

    // 6. Treatment Decision.
    await page.getByRole('link', { name: 'Quyết định điều trị' }).click();
    await expect(
      page.getByRole('heading', { name: 'Quyết định điều trị', level: 1 }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page.getByLabel('Quyết định điều trị *').fill(decisionSummary);
    await page.getByLabel('Phương thức điều trị (chọn nhiều)').selectOption(['MEDICAL', 'SURGERY']);
    await page.getByLabel('Nơi điều trị nội khoa').fill('synthetic clinic');
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await page.getByRole('button', { name: 'Về hồ sơ bệnh nhân' }).click();

    // 7. Treatment Decision done -> CarePlan creation now reachable.
    await expect(page.getByRole('link', { name: 'Quyết định điều trị ✓' })).toBeVisible();
    await page.getByRole('link', { name: 'Tạo kế hoạch chăm sóc' }).click();

    // 8. Create + sign CarePlan.
    await expect(page).toHaveURL(/\/care-plan\/new/);
    await page.getByLabel('Điều trị / dặn dò').fill('Điều trị nội khoa (E2E Slice 2)');
    await page.getByLabel('Ngày tái khám (tùy chọn)').fill('2026-09-15');
    await page.getByRole('button', { name: 'Lưu bản nháp' }).click();
    await expect(page).toHaveURL(/\/care-plans\/[^/]+$/);
    await page.getByRole('button', { name: 'Ký kế hoạch' }).click();
    await page.getByRole('button', { name: 'Xác nhận ký' }).click();
    await expect(page.getByText('Đã ký', { exact: true })).toBeVisible();

    // 9. Exactly one OPEN generic CareTask was created, distinct from
    // CarePlan.followUpDate (both currently 15/9, shown in two places).
    await expect(page.getByText('Ngày tái khám (ý định lâm sàng đã ký):')).toBeVisible();
    await expect(page.getByText('Ngày hẹn hiện tại:')).toBeVisible();

    // 10. CD-08 — change followUpDate while an OPEN generic task exists:
    // the reconciliation control must appear and block submit until an
    // action is chosen.
    await page.getByRole('button', { name: 'Sửa (tạo phiên bản mới)' }).click();
    await expect(page.getByLabel('Ngày tái khám mới (tùy chọn)')).toHaveValue('2026-09-15');
    await page.getByLabel('Ngày tái khám mới (tùy chọn)').fill('2026-09-25');
    await page.getByLabel('Lý do sửa').fill('Đổi lịch theo yêu cầu bệnh nhân (E2E)');
    await expect(page.getByLabel('Xử lý nhiệm vụ tái khám')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu phiên bản mới' })).toBeDisabled();
    await page.getByLabel('Xử lý nhiệm vụ tái khám').selectOption('RESCHEDULE');
    await expect(page.getByRole('button', { name: 'Lưu phiên bản mới' })).toBeEnabled();
    await page.getByRole('button', { name: 'Lưu phiên bản mới' }).click();
    await expect(page.getByText('Phiên bản 2')).toBeVisible();

    await page.getByRole('button', { name: 'Về hồ sơ bệnh nhân' }).click();

    // 11. Create a second hemorrhoid Encounter Context — the explicit
    // Return Encounter used to complete the follow-up CareTask below. Just
    // capture its id from the exam URL; completing its own exam is not
    // needed for this step.
    await page.getByRole('button', { name: '+ Tạo lượt khám' }).click();
    await page.getByRole('menuitem', { name: 'Khám trĩ' }).click();
    await page.getByLabel('Thời điểm khám').fill('2026-09-26T09:00');
    await page.getByLabel('Lý do khám').fill('Tái khám trĩ (E2E Slice 2)');
    await page.getByRole('button', { name: 'Tạo lượt khám' }).click();
    await page.getByRole('button', { name: 'Mở phiếu khám trĩ' }).click();
    const returnEncounterId = page
      .url()
      .match(/\/encounters\/([^/]+)\/hemorrhoid-examination$/)?.[1];
    expect(returnEncounterId).toBeTruthy();
    // Before the exam is started, only "Hủy"/"Bắt đầu phiếu khám trĩ" exist
    // (no "Về hồ sơ bệnh nhân" yet) — "Hủy" navigates back to the patient.
    await page.getByRole('button', { name: 'Hủy' }).click();

    // 12. Explicit Return Encounter completion on the Follow-up queue — the
    // doctor must pick the Encounter; no date-based inference.
    await page.getByRole('link', { name: 'Theo dõi' }).click();
    await expect(page).toHaveURL(/\/follow-up$/);
    const row = page.getByRole('row').filter({ hasText: patientName });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Hoàn thành qua lượt tái khám' }).click();
    const confirmButton = page.getByRole('button', {
      name: 'Xác nhận hoàn thành',
    });
    await expect(confirmButton).toBeDisabled();
    await page.getByLabel('Lượt tái khám').selectOption(returnEncounterId as string);
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();
    await expect(row).toHaveCount(0);

    // 13. Timeline projects Diagnosis/Treatment Decision summaries (no new
    // storage — read straight from the minimal Timeline summary field) and
    // keeps the amended CarePlan's version lineage visible.
    await page.goto(`/patients/${patientId}`);
    await expect(page.getByText(diagnosisSummary)).toBeVisible();
    await expect(page.getByText(decisionSummary)).toBeVisible();
    const timelineItems = page.locator('.timeline-item');
    await expect(timelineItems.filter({ hasText: 'Lượt khám' })).toHaveCount(2);

    // 14. F2 — the first Encounter already has a CarePlan (DRAFT->SIGNED
    // above): the sequence must offer to view it, not re-offer creation.
    await expect(
      page.getByRole('link', { name: 'Xem kế hoạch chăm sóc', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tạo kế hoạch chăm sóc' })).toHaveCount(0);

    // 15. F1 — the completed follow-up CareTask shows which Return
    // Encounter closed it (explicit linkage, not inferred).
    await expect(
      page.getByText(/Hoàn thành qua lượt tái khám:.*Tái khám trĩ \(E2E Slice 2\)/),
    ).toBeVisible();
  });
});

test('DEC-016 Investigation parent/prior evidence and NURSE assigned raw Result workflow', async ({
  page,
  request,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(DOCTOR_EMAIL);
  await page.getByLabel('Mật khẩu').fill(DOCTOR_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/today$/);
  const token = await page.evaluate(() => localStorage.getItem('gastrocare.accessToken'));
  const headers = { Authorization: `Bearer ${token}` };
  const p = await request.post(`${API_URL}/patients`, {
    headers,
    data: {
      fullName: 'SYNTHETIC DEC016 CLS',
      dateOfBirth: '1990-01-01',
      gender: 'OTHER',
      phone: `08${Date.now().toString().slice(-8)}`,
    },
  });
  expect(p.ok()).toBeTruthy();
  const patientId = (await p.json()).patient.id;
  const initial = await request.post(`${API_URL}/encounters`, {
    headers,
    data: {
      patientId,
      occurredAt: '2026-08-28T09:00:00Z',
      reasonForVisit: 'synthetic',
      workflowKind: 'HEMORRHOID_INITIAL',
    },
  });
  expect(initial.ok()).toBeTruthy();
  await page.goto(`/patients/${patientId}`);
  await page.getByRole('tab', { name: 'CLS', exact: true }).click();
  await page.getByLabel('Tên CLS').fill('SYNTHETIC CBC');
  await page.getByRole('button', { name: 'Thêm CLS', exact: true }).click();
  const current = page.locator('article').filter({
    has: page.getByRole('heading', { name: 'SYNTHETIC CBC', exact: true }),
  });
  await current.getByLabel('Nội dung chỉ định').fill('synthetic request');
  await current.getByLabel('Thời điểm chỉ định').fill('2026-08-28T09:00');
  await current.getByLabel('Giao cho').selectOption({ label: 'nurse.a@example.test' });
  await current.getByRole('button', { name: 'Tạo chỉ định' }).click();
  await expect(current.getByText(/Chỉ định #1/)).toBeVisible();
  await page.getByLabel('Tên CLS').fill('SYNTHETIC PRIOR');
  await page.getByLabel('Nguồn CLS').selectOption('EXTERNAL_PRIOR');
  await page.getByLabel('CLS cha (liên kết tường minh)').selectOption({ label: 'SYNTHETIC CBC' });
  await page.getByRole('button', { name: 'Thêm CLS', exact: true }).click();
  const prior = page.locator('article').filter({
    has: page.getByRole('heading', { name: 'SYNTHETIC PRIOR', exact: true }),
  });
  await expect(prior.getByText('CLS cha: SYNTHETIC CBC')).toBeVisible();
  await expect(prior.getByRole('button', { name: 'Tạo chỉ định' })).toHaveCount(0);
  await prior.getByLabel('Kết quả thô', { exact: true }).fill('synthetic prior value');
  await prior.getByLabel('Thời điểm kết quả').fill('2026-08-27T09:00');
  await prior.getByRole('button', { name: 'Lưu kết quả thô' }).click();
  await expect(prior.getByText('synthetic prior value', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await page.getByLabel('Email').fill('nurse.a@example.test');
  await page.getByLabel('Mật khẩu').fill('CoreNurseE2E-Pass1!');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/investigations\/assigned$/);
  await expect(page.getByRole('heading', { name: 'SYNTHETIC CBC', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SYNTHETIC PRIOR', exact: true })).toHaveCount(0);
  await page.getByLabel('Chỉ định tương ứng').selectOption({ label: '#1 · synthetic request' });
  await page.getByLabel('Kết quả thô', { exact: true }).fill('synthetic nurse raw value');
  await page.getByLabel('Thời điểm kết quả').fill('2026-08-28T10:00');
  await page.getByRole('button', { name: 'Lưu kết quả thô' }).click();
  await expect(page.getByText('synthetic nurse raw value', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('synthetic nurse raw value', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bệnh nhân', exact: true })).toHaveCount(0);
  await page.goto(`/patients/${patientId}`);
  await expect(page).toHaveURL(/\/not-authorized$/);
});
