import { test, expect, type Page } from '@playwright/test';

// DEC-019 — Staff Profile & Credential Management v1 browser acceptance.
// Synthetic data only. Requires the disposable test PostgreSQL + backend +
// frontend preview server already running and seeded (frontend/e2e/run-e2e.sh).
//
// Seeded accounts (backend/test/e2e-seed.ts):
//   doctor.a@example.test    — DOCTOR + Clinic Admin capability
//   reception.a@example.test — RECEPTIONIST, no admin  (used as the managed
//                              target user AND as the "ordinary non-admin")

const ADMIN_EMAIL = 'doctor.a@example.test';
const ADMIN_PASSWORD = 'CoreDoctorE2E-Pass1!';
const TARGET_EMAIL = 'reception.a@example.test';
const TARGET_PASSWORD = 'CoreReceptionE2E-Pass1!';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  // Wait for the authenticated shell rather than a specific landing route
  // (a stale post-logout `from` history-state can otherwise redirect here).
  await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
  await page.goto('/');
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test.describe('DEC-019 Staff Profile — browser golden path', () => {
  test('Clinic Admin manages a full staff profile; self view is read-only; non-admin is blocked', async ({
    page,
  }) => {
    const stamp = Date.now();

    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // --- Create two facilities for the assignment flow (existing admin UI) ---
    await page.goto('/clinic-admin/facilities');
    for (const name of [`CS A ${stamp}`, `CS B ${stamp}`]) {
      await page.getByLabel('Tên cơ sở').fill(name);
      await page.getByRole('button', { name: 'Thêm cơ sở' }).click();
      await expect(page.getByText(name).first()).toBeVisible();
    }

    // --- Users -> Xem -> User Detail ---
    await page.goto('/clinic-admin/users');
    const targetRow = page.getByRole('row', { name: new RegExp(TARGET_EMAIL) });
    await targetRow.getByRole('link', { name: 'Xem' }).click();
    await expect(page).toHaveURL(/\/clinic-admin\/users\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { name: 'Chi tiết người dùng' })).toBeVisible();
    await expect(page.getByText(TARGET_EMAIL)).toBeVisible();

    // --- Tab: Tổng quan — create basic profile ---
    await page.getByRole('tab', { name: 'Tổng quan' }).click();
    await page.getByLabel('Họ tên *').fill('E2E Synthetic Staff');
    await page.getByLabel('Chức danh chuyên môn').fill('BS CKI');
    await page.getByLabel('Điện thoại công việc').fill('0900000000');
    await page.getByRole('button', { name: /Tạo hồ sơ|Lưu hồ sơ/ }).click();
    await expect(page.getByText(/Đã tạo hồ sơ|Đã cập nhật hồ sơ/)).toBeVisible();

    // edit it again
    await page.getByLabel('Chức danh chuyên môn').fill('BS CKII');
    await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();
    await expect(page.getByText('Đã cập nhật hồ sơ')).toBeVisible();

    // --- Tab: Chuyên môn ---
    await page.getByRole('tab', { name: 'Chuyên môn' }).click();
    await page.getByLabel('Chuyên khoa chính').selectOption('GASTROENTEROLOGY');
    await page.getByRole('button', { name: 'Lưu chuyên môn' }).click();
    await expect(page.getByText('Đã cập nhật chuyên môn')).toBeVisible();

    // --- Tab: Chứng chỉ — add an already-expired synthetic credential ---
    await page.getByRole('tab', { name: 'Chứng chỉ' }).click();
    await page.getByRole('button', { name: 'Thêm chứng chỉ' }).click();
    await page.getByLabel('Tên *').fill('CCHN cu');
    await page.getByLabel('Ngày cấp').fill('2010-01-01');
    await page.getByLabel('Ngày hết hạn').fill('2011-01-01');
    await page.getByRole('button', { name: 'Lưu chứng chỉ' }).click();
    await expect(page.getByText('Đã thêm chứng chỉ')).toBeVisible();
    // derived EXPIRED shown (never stored)
    await expect(page.getByRole('cell', { name: 'Hết hạn', exact: true }).first()).toBeVisible();

    // --- Tab: Công tác — employment + facility assignment lifecycle ---
    await page.getByRole('tab', { name: 'Công tác' }).click();

    // employment
    await page.getByRole('button', { name: 'Thêm công tác' }).click();
    await page.getByLabel('Tổ chức *').fill('BV Synthetic');
    await page.getByLabel('Bắt đầu *').fill('2018-01-01');
    await page.getByRole('button', { name: 'Lưu công tác' }).click();
    await expect(page.getByText('Đã thêm bản ghi công tác')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'BV Synthetic' })).toBeVisible();

    // facility A -> becomes primary
    await page.getByLabel('Cơ sở', { exact: true }).selectOption({ label: `CS A ${stamp}` });
    await page.getByLabel('Ngày bắt đầu').fill('2023-01-01');
    await page.getByRole('button', { name: 'Thêm', exact: true }).click();
    await expect(page.getByText('Đã thêm phân công cơ sở')).toBeVisible();
    await expect(page.getByText('· Chính')).toBeVisible();

    // facility B -> secondary
    await page.getByLabel('Cơ sở', { exact: true }).selectOption({ label: `CS B ${stamp}` });
    await page.getByLabel('Ngày bắt đầu').fill('2023-06-01');
    await page.getByRole('button', { name: 'Thêm', exact: true }).click();
    await expect(page.getByText('Đã thêm phân công cơ sở')).toBeVisible();

    // change primary to B
    const rowB = page.getByRole('row', { name: new RegExp(`CS B ${stamp}`) });
    await rowB.getByRole('button', { name: 'Đặt làm chính' }).click();
    await expect(page.getByText('Đã đổi cơ sở chính')).toBeVisible();

    // end B (current primary) with replacement = the A row created above
    const rowA = page.getByRole('row', { name: new RegExp(`CS A ${stamp}`) });
    page.once('dialog', async (d) => {
      // window.prompt for replacement id — pick this test's own CS A assignment
      const match = d.message().match(new RegExp(`([0-9a-f-]{36}) — CS A ${stamp}`));
      await d.accept(match ? match[1] : '');
    });
    await rowB.getByRole('button', { name: 'Kết thúc' }).click();
    await expect(page.getByText('Đã kết thúc phân công')).toBeVisible();
    // exactly one active primary remains, and it is this test's CS A row
    await expect(rowA.getByText('· Chính')).toBeVisible();
    await expect(rowB.getByText('Đã kết thúc')).toBeVisible();

    // --- Tab: Nhật ký — merged audit ---
    await page.getByRole('tab', { name: 'Nhật ký' }).click();
    await expect(page.getByText('STAFF_PROFILE_CREATED')).toBeVisible();
    await expect(page.getByText('FACILITY_ASSIGNMENT_PRIMARY_CHANGED').first()).toBeVisible();

    await logout(page);

    // --- Self view: target user, read-only ---
    await login(page, TARGET_EMAIL, TARGET_PASSWORD);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Hồ sơ của tôi' })).toBeVisible();
    await expect(page.getByText(/E2E Synthetic Staff/)).toBeVisible();
    await expect(page.getByText(/CCHN cu/)).toBeVisible();
    // no edit affordances
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Lưu/ })).toHaveCount(0);

    // --- Ordinary non-admin cannot reach another user's full profile ---
    await page.goto('/clinic-admin/users');
    await expect(page).toHaveURL(/\/not-authorized$/);
    await page.goto(`/clinic-admin/users/${stamp}`);
    await expect(page).toHaveURL(/\/not-authorized$/);
  });
});
