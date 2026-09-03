import { test, expect, request as playwrightRequest } from '@playwright/test';

// DEC-020 Package B — Clinical Form Fidelity + Functional Clinical UX,
// browser workflow acceptance (synthetic data only). Requires the
// disposable test PostgreSQL + backend + frontend preview server to be
// running and seeded — see frontend/e2e/run-e2e.sh.
//
// One synthetic patient across:
//   Initial Encounter -> Examination v2 -> Diagnosis -> Treatment Decision
//   -> Return visit (2nd hemorrhoid Encounter) with Examination v2 vital
//      copy-forward -> Patient Dashboard -> History (Timeline).
//
// The clinical sequence prerequisites are backend-authoritative and already
// proven elsewhere; the parts NEW in Package B and exercised through the
// real rendered browser here are: the v2 Examination sections, the default
// Patient Dashboard, the History/Timeline view, and — as the concrete T3
// browser proof — respiratoryRate/spo2 copy-forward onto a later visit's
// Examination v2 form.

const DOCTOR_EMAIL = 'doctor.a@example.test';
const DOCTOR_PASSWORD = 'CoreDoctorE2E-Pass1!';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3100';

const PATIENT_NAME = 'Đỗ Văn Trĩ B';
const uniquePhone = `05${Date.now().toString().slice(-8)}`;

test.describe('DEC-020 Package B — clinical fidelity + functional UX golden path', () => {
  test('Examination v2 -> Diagnosis -> Treatment Decision -> Return visit (vital copy-forward) -> Dashboard -> History', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DOCTOR_EMAIL);
    await page.getByLabel('Mật khẩu').fill(DOCTOR_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/today$/);

    const accessToken = await page.evaluate(() =>
      window.localStorage.getItem('gastrocare.accessToken'),
    );
    const api = await playwrightRequest.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
    });

    // 1. Register patient + initial hemorrhoid Encounter (real UI).
    await page.getByRole('link', { name: 'Bệnh nhân' }).click();
    await page.getByRole('button', { name: '+ Bệnh nhân mới' }).click();
    await page.getByLabel('Họ tên').fill(PATIENT_NAME);
    await page.getByLabel('Ngày sinh').fill('1970-06-06');
    await page.getByLabel('Điện thoại').fill(uniquePhone);
    await page.getByRole('button', { name: 'Tạo bệnh nhân mới' }).click();
    await expect(page).toHaveURL(/\/patients\/[^/]+$/);
    const patientId = page.url().split('/patients/')[1];

    // 2. Default landing view is the Patient Dashboard (T8).
    await expect(page.getByRole('tab', { name: 'Bảng tổng quan' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'Chẩn đoán hiện tại' })).toBeVisible();
    await expect(page.getByText('Chưa có Case')).toBeVisible();

    // 3. Initial Encounter via the visit entry menu.
    await page.getByRole('button', { name: '+ Tạo lượt khám' }).click();
    await page.getByRole('menuitem', { name: 'Khám trĩ' }).click();
    await page.getByLabel('Thời điểm khám').fill('2026-09-01T09:00');
    await page.getByLabel('Lý do khám').fill('Khám trĩ lần đầu (Package B E2E)');
    await page.getByRole('button', { name: 'Tạo lượt khám' }).click();
    await page.getByRole('button', { name: 'Mở phiếu khám trĩ' }).click();
    await expect(page).toHaveURL(/\/hemorrhoid-examination$/);

    // 4. Examination v2 — the eight source-form clinical sections render.
    await page.getByRole('button', { name: 'Bắt đầu phiếu khám trĩ' }).click();
    for (const section of [
      'Lý do khám / triệu chứng',
      'Tiền sử / dị ứng',
      'Toàn thân / sinh hiệu',
      'Thăm trực tràng',
      'Đặc điểm búi trĩ',
      'Sa / chảy máu',
      'Ghi nhận hậu môn-trực tràng khác',
      'Cận lâm sàng liên quan',
    ]) {
      await expect(page.getByRole('heading', { name: section })).toBeVisible();
    }
    // v2 vitals + one aggregate-by-type Goligher grade, no per-lesion pile UI.
    await page.getByLabel('Nhịp thở (lần/phút)').fill('18');
    await page.getByLabel('SpO2 (%)').fill('98');
    await page.getByLabel('Phân độ Goligher (một giá trị chung)').selectOption('III');
    await page.getByLabel('Đau hậu môn').selectOption('true');
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await page.getByRole('button', { name: 'Về hồ sơ bệnh nhân' }).click();

    // 5. Diagnosis (one logical free-text chain) then Treatment Decision.
    await page.getByRole('link', { name: 'Chẩn đoán' }).click();
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page
      .getByLabel('Chẩn đoán *')
      .fill('Trĩ nội độ III\nDa thừa hậu môn 5h');
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await page.getByRole('button', { name: 'Về hồ sơ bệnh nhân' }).click();

    await page.getByRole('link', { name: 'Quyết định điều trị' }).click();
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page.getByLabel('Quyết định điều trị *').fill('Điều trị nội khoa, hẹn tái khám');
    await page.getByLabel('Phương thức điều trị (chọn nhiều)').selectOption(['MEDICAL']);
    await page.getByLabel('Nơi điều trị nội khoa').fill('phòng khám (E2E)');
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await page.getByRole('button', { name: 'Về hồ sơ bệnh nhân' }).click();

    // 6. Return visit — a second hemorrhoid Encounter for the SAME patient
    // (same doctor visit-menu -> "Khám trĩ" flow proven in
    // gastrocare.spec.ts DEC-012 Slice 2, lines ~957-962). Its Examination
    // v2 form must pre-fill vitals via copy-forward from the Initial
    // Encounter's completed Examination — this is the concrete browser proof
    // for T3, asserted specifically on respiratoryRate + spo2 (the two vitals
    // Package B added to the copy-forward set).
    await page.getByRole('button', { name: '+ Tạo lượt khám' }).click();
    await page.getByRole('menuitem', { name: 'Khám trĩ' }).click();
    await page.getByLabel('Thời điểm khám').fill('2026-09-15T09:00');
    await page.getByLabel('Lý do khám').fill('Tái khám trĩ (Package B E2E)');
    await page.getByRole('button', { name: 'Tạo lượt khám' }).click();
    await page.getByRole('button', { name: 'Mở phiếu khám trĩ' }).click();
    await expect(page).toHaveURL(/\/hemorrhoid-examination$/);

    // Copy-forward hint + prefilled values (assertion pattern from
    // gastrocare.spec.ts DEC-010 Slice 1, lines ~700-703).
    await expect(
      page.getByText(/Đã sao chép sinh hiệu từ lần khám gần nhất/),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Bắt đầu phiếu khám trĩ' }).click();
    await expect(page.getByLabel('Nhịp thở (lần/phút)')).toHaveValue('18');
    await expect(page.getByLabel('SpO2 (%)')).toHaveValue('98');
    // Minimal synthetic content to complete the return Examination, kept
    // consistent with the Initial visit (same overall Goligher grade).
    await page.getByLabel('Phân độ Goligher (một giá trị chung)').selectOption('III');
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất (phiên bản 1)')).toBeVisible();
    await page.getByRole('button', { name: 'Về hồ sơ bệnh nhân' }).click();

    // 7. Patient Dashboard reflects the factual current state (T8) — no
    // invented interpretation.
    await page.goto(`/patients/${patientId}?view=dashboard`);
    await expect(page.getByText('Trĩ nội độ III')).toBeVisible();
    await expect(page.getByText('Điều trị nội khoa, hẹn tái khám')).toBeVisible();
    await expect(page.getByText('Chưa ghi nhận / không có sẵn')).toBeVisible();
    // Goligher grade is surfaced factually (aggregate value), not interpreted.
    await expect(
      page.getByRole('heading', { name: 'Tóm tắt khám gần nhất' }),
    ).toBeVisible();
    await expect(page.getByText('Độ III', { exact: true })).toBeVisible();
    // No automatic abnormal/normal classification of any recorded value.
    await expect(page.getByText('Bất thường', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/nguy cơ|khuyến cáo|đề nghị điều trị/i)).toHaveCount(0);

    // 8. History / Timeline remains available as a read-only projection (T9).
    await page.getByRole('tab', { name: 'Lịch sử' }).click();
    await expect(page.getByRole('heading', { name: 'Dòng thời gian (chỉ đọc)' })).toBeVisible();
    await expect(page.getByText('HEMORRHOID_DIAGNOSIS')).toBeVisible();

    await api.dispose();
  });
});
