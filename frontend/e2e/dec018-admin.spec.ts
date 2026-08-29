import { test, expect, type Page } from '@playwright/test';

// DEC-018 — Admin Boundary / User Management v1 browser acceptance. Synthetic
// data only. Requires the disposable test PostgreSQL + backend + frontend
// preview server already running and seeded — see frontend/e2e/run-e2e.sh.
//
// The seeded E2E DOCTOR (doctor.a@example.test) also holds the Clinic Admin
// capability (see backend/test/e2e-seed.ts).

const ADMIN_EMAIL = 'doctor.a@example.test';
const ADMIN_PASSWORD = 'CoreDoctorE2E-Pass1!';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

test.describe('DEC-018 Clinic Admin — browser golden path', () => {
  test('admin sees the Quản trị group, manages a user end to end, and legacy /admin/* is gone', async ({
    page,
  }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/today$/);

    // 1. The capability-gated nav group is visible.
    await expect(
      page.getByRole('link', { name: 'Người dùng', exact: true }),
    ).toHaveAttribute('href', '/clinic-admin/users');

    // 2. Legacy frontend routes are removed (no redirect) — NotFound.
    await page.goto('/admin/users');
    await expect(page.getByText('Không tìm thấy trang.')).toBeVisible();

    // 3. Canonical route renders the functional page.
    await page.goto('/clinic-admin/users');
    await expect(
      page.getByRole('heading', { name: 'Người dùng', exact: true }),
    ).toBeVisible();
    await expect(page.getByText(ADMIN_EMAIL).first()).toBeVisible();

    // 4. Create a user via the "+" button -> modal. One-time temp password shown.
    const newEmail = `e2e.newdoc.${Date.now()}@example.test`;
    await page.getByRole('button', { name: 'Thêm người dùng' }).click();
    const createModal = page.getByRole('dialog');
    await createModal.getByLabel('Email').fill(newEmail);
    await createModal.getByLabel('Tên hiển thị').fill('E2E New Doctor');
    await createModal.getByRole('button', { name: 'Tạo người dùng' }).click();

    const temp = page.getByTestId('temp-password');
    await expect(temp).toBeVisible();
    const tempPassword = (await temp.textContent())?.trim() ?? '';
    expect(tempPassword.length).toBeGreaterThanOrEqual(12);
    await expect(page.getByRole('cell', { name: newEmail })).toBeVisible();

    // 5. The new user must change the temporary password before any action.
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await login(page, newEmail, tempPassword);
    await expect(page).toHaveURL(/\/change-password$/);
    await page.getByLabel('Mật khẩu hiện tại').fill(tempPassword);
    await page.getByLabel('Mật khẩu mới', { exact: true }).fill('E2E-New-Doctor-Pass1');
    await page
      .getByLabel('Xác nhận mật khẩu mới')
      .fill('E2E-New-Doctor-Pass1');
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();

    // 6. After the change the user lands in the normal app as a DOCTOR
    //    (no Clinic Admin capability -> no Quản trị group).
    await expect(page).toHaveURL(/\/today$/);
    await expect(
      page.getByRole('link', { name: 'Người dùng', exact: true }),
    ).toHaveCount(0);
  });
});
