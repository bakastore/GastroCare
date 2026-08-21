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
