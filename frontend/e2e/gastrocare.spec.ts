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
