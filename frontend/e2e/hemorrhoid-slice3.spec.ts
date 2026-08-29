import { test, expect, request as playwrightRequest } from '@playwright/test';

// Hemorrhoid Vertical Slice 3 — T7 focused browser acceptance (DEC-013;
// docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md). Synthetic data
// only. Requires the disposable test PostgreSQL + backend + frontend
// preview server to already be running and seeded — see
// frontend/e2e/run-e2e.sh (same runtime as gastrocare.spec.ts).
//
// Scope: this file proves the CONTINUOUS-CARE loop (Return Encounter,
// Follow-up Assessment, Next Clinical Decision, episode reuse, close) in a
// real rendered browser. The initial branch (Examination -> Diagnosis ->
// Treatment Decision -> CarePlan #1 -> sign) is already covered by existing
// generic-form browser/unit/e2e coverage elsewhere and is NOT re-proven
// here — it is driven directly via the backend API (same token the UI
// login just placed in localStorage) purely as setup, so this spec's
// browser interactions focus entirely on what is new in Slice 3.

const DOCTOR_EMAIL = 'doctor.a@example.test';
const DOCTOR_PASSWORD = 'CoreDoctorE2E-Pass1!';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3100';

const PATIENT_NAME = 'Trần Thị Hồng';
const uniquePhone = `08${Date.now().toString().slice(-8)}`;

test.describe('Hemorrhoid Vertical Slice 3 — continuous-care browser golden path', () => {
  test('Return Encounter, Assessment/Next Decision/CarePlan sequence, episode reuse, and close all render correctly', async ({
    page,
  }) => {
    // 1. Login as Doctor (real rendered browser).
    await page.goto('/login');
    await page.getByLabel('Email').fill(DOCTOR_EMAIL);
    await page.getByLabel('Mật khẩu').fill(DOCTOR_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/today$/);

    const accessToken = await page.evaluate(() =>
      window.localStorage.getItem('gastrocare.accessToken'),
    );
    expect(accessToken).toBeTruthy();
    const api = await playwrightRequest.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
    });

    // 2. Create synthetic Patient via the real UI.
    await page.getByRole('link', { name: 'Bệnh nhân' }).click();
    await expect(page).toHaveURL(/\/patients$/);
    await page.getByRole('button', { name: '+ Bệnh nhân mới' }).click();
    await page.getByLabel('Họ tên').fill(PATIENT_NAME);
    await page.getByLabel('Ngày sinh').fill('1975-02-02');
    await page.getByLabel('Điện thoại').fill(uniquePhone);
    await page.getByRole('button', { name: 'Tạo bệnh nhân mới' }).click();
    await expect(page).toHaveURL(/\/patients\/[^/]+$/);
    const patientId = page.url().split('/patients/')[1];

    // 3. Drive the initial branch through to a signed CarePlan #1 + OPEN
    // follow-up task via the API — this exact sequence is already proven
    // in a real rendered browser by gastrocare.spec.ts's own golden path
    // and by the Slice 2/3 backend acceptance suites; re-driving every
    // generic form field here would not add new evidence.
    // DEC-015 — this helper only ever creates the INITIAL Hemorrhoid
    // Encounter for this spec, so it stamps the explicit persisted
    // discriminator (mirrors NewHemorrhoidEncounterPage).
    async function apiCreateEncounter(reasonForVisit: string) {
      const res = await api.post('/encounters', {
        data: {
          patientId,
          occurredAt: '2026-09-01T09:00:00.000Z',
          reasonForVisit,
          workflowKind: 'HEMORRHOID_INITIAL',
        },
      });
      expect(res.ok()).toBeTruthy();
      return (await res.json()).id as string;
    }
    async function apiCreateSubmission(
      encounterId: string,
      templateKey: string,
      responses: Record<string, unknown>,
    ) {
      const res = await api.post('/clinical-forms', {
        data: { encounterId, templateKey, responses },
      });
      expect(res.ok()).toBeTruthy();
      return (await res.json()).id as string;
    }
    async function apiComplete(id: string) {
      const res = await api.post(`/clinical-forms/${id}/complete`);
      expect(res.ok()).toBeTruthy();
    }

    const initialEncounterId = await apiCreateEncounter('Khám trĩ (browser T7, synthetic)');
    await apiComplete(await apiCreateSubmission(initialEncounterId, 'HEMORRHOID_EXAMINATION', {}));
    await apiComplete(
      await apiCreateSubmission(initialEncounterId, 'HEMORRHOID_DIAGNOSIS', {
        diagnosisSummary: 'Trĩ nội độ II (browser T7, synthetic)',
      }),
    );
    await apiComplete(
      await apiCreateSubmission(initialEncounterId, 'HEMORRHOID_TREATMENT_DECISION', {
        decisionSummary: 'Điều trị nội khoa (browser T7, synthetic)',
        treatmentModalities: ['MEDICAL'],
        medicalCareSetting: 'synthetic clinic',
      }),
    );
    const carePlan1Res = await api.post('/care-plans', {
      data: {
        encounterId: initialEncounterId,
        instructions: 'Tái khám theo lịch (browser T7, synthetic)',
        followUpDate: '2026-11-10',
      },
    });
    expect(carePlan1Res.ok()).toBeTruthy();
    const carePlan1Id = (await carePlan1Res.json()).id as string;
    const sign1Res = await api.post(`/care-plans/${carePlan1Id}/sign`);
    expect(sign1Res.ok()).toBeTruthy();

    // 4. Reload the browser and verify (Contract §S/§I): the OPEN generic
    // follow-up task shows "Bắt đầu tái khám" inside the Case created at Initial.
    await page.goto(`/patients/${patientId}`);
    await expect(page.getByRole('button', { name: 'Bắt đầu tái khám' })).toBeVisible();
    // DEC016: the Case already exists before the first Return.
    await expect(page.getByText('Case trĩ')).toHaveCount(1);

    // 5. Submit the Return Encounter form via the browser (Contract §H):
    // succeeds, reloads timeline, task becomes completed/linked, new Return
    // Encounter appears.
    await page.getByRole('button', { name: 'Bắt đầu tái khám' }).click();
    await page.getByLabel('Thời điểm tái khám').fill('2026-10-01T09:00');
    await page.getByLabel('Lý do khám').fill('Tái khám lần 1 (browser T7, synthetic)');
    await page.getByRole('button', { name: 'Xác nhận tái khám' }).click();

    // Required proof 1: HEMORRHOID_TREATMENT episode header wording.
    await expect(page.getByText('Case trĩ')).toBeVisible();
    // Required proof 2: no Longo-only controls leak onto this card.
    await expect(page.getByRole('link', { name: '+ Lượt khám trong đợt điều trị' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Đóng đợt điều trị' })).toHaveCount(0);
    await expect(page.getByText('Hàng đợi tái khám (kế hoạch so với thực tế)')).toHaveCount(0);
    // Required proof: new Return Encounter appears, task shows completed.
    await expect(page.getByText('Lượt tái khám', { exact: true })).toBeVisible();
    await expect(page.getByText('COMPLETED')).toBeVisible();
    await expect(page.getByText(/Hoàn thành qua lượt tái khám/)).toBeVisible();

    // 6. On the Return Encounter: Follow-up Assessment -> Next Clinical
    // Decision -> new CarePlan sequence, driven in the rendered browser.
    await page.getByRole('link', { name: 'Đánh giá tái khám' }).click();
    await expect(page).toHaveURL(/\/clinical-forms\/HEMORRHOID_FOLLOW_UP_ASSESSMENT$/);
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page.getByLabel('Đánh giá tái khám').fill('Cải thiện một phần (browser T7, synthetic)');
    await page.getByRole('button', { name: 'Lưu bản nháp' }).click();
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất', { exact: false })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/patients\/[^/]+$/);

    // Correction batch C3 — once the Return Encounter Assessment is
    // COMPLETED and the episode is ACTIVE, BOTH explicit paths are offered:
    // Continue ("Quyết định điều trị tiếp theo") and Terminate ("Kết thúc
    // đợt theo dõi"). Neither is inferred from the responseSummary.
    await expect(page.getByRole('link', { name: 'Quyết định điều trị tiếp theo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kết thúc đợt theo dõi' }).first()).toBeVisible();

    await page.getByRole('link', { name: 'Quyết định điều trị tiếp theo' }).click();
    await expect(page).toHaveURL(/\/clinical-forms\/HEMORRHOID_NEXT_CLINICAL_DECISION$/);
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page
      .getByLabel('Quyết định điều trị tiếp theo')
      .fill('Tiếp tục theo dõi (browser T7, synthetic)');
    await page.getByRole('button', { name: 'Lưu bản nháp' }).click();
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất', { exact: false })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/patients\/[^/]+$/);
    await page.getByRole('link', { name: 'Tạo kế hoạch chăm sóc' }).click();
    await expect(page).toHaveURL(/\/care-plan\/new/);
    await page.getByLabel('Điều trị / dặn dò').fill('Kế hoạch #2 (browser T7, synthetic)');
    await page.getByLabel('Ngày tái khám (tùy chọn)').fill('2026-12-10');
    await page.getByRole('button', { name: 'Lưu bản nháp' }).click();
    await expect(page).toHaveURL(/\/care-plans\/[^/]+$/);
    await page.getByRole('button', { name: 'Ký kế hoạch' }).click();
    await page.getByRole('button', { name: 'Xác nhận ký' }).click();
    await expect(page.getByText('Đã ký', { exact: true })).toBeVisible();

    // 7. Second Return Encounter reuses the same Hemorrhoid episode — only
    // one Case card exists throughout.
    await page.goto(`/patients/${patientId}`);
    await expect(page.getByText('Case trĩ')).toHaveCount(1);
    await page.getByRole('button', { name: 'Bắt đầu tái khám' }).click();
    await page.getByLabel('Thời điểm tái khám').fill('2026-11-01T09:00');
    await page.getByLabel('Lý do khám').fill('Tái khám lần 2 (browser T7, synthetic)');
    await page.getByRole('button', { name: 'Xác nhận tái khám' }).click();
    await expect(page.getByText('Case trĩ')).toHaveCount(1);

    await expect(page.getByText('Lượt tái khám', { exact: true })).toHaveCount(2);

    // 8. Correction batch R2 — termination is decided on the CURRENT Return
    // Encounter, only after ITS OWN Follow-up Assessment is COMPLETED. On
    // the freshly-created Return #2 there is no Terminate action yet.
    await expect(page.getByRole('button', { name: 'Kết thúc đợt theo dõi' })).toHaveCount(0);

    // Complete Assessment #2 on Return #2 via the browser (Return #1's link
    // now reads "Đánh giá tái khám ✓", so match exactly).
    await page.getByRole('link', { name: 'Đánh giá tái khám', exact: true }).click();
    await expect(page).toHaveURL(/\/clinical-forms\/HEMORRHOID_FOLLOW_UP_ASSESSMENT$/);
    await page.getByRole('button', { name: 'Bắt đầu biểu mẫu' }).click();
    await page
      .getByLabel('Đánh giá tái khám')
      .fill('Ổn định, ngừng theo dõi (browser T7, synthetic)');
    await page.getByRole('button', { name: 'Lưu bản nháp' }).click();
    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page.getByText('Đã hoàn tất', { exact: false })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/patients\/[^/]+$/);

    // Termination branch: Assessment #2 COMPLETED -> explicit "Kết thúc đợt
    // theo dõi" with NO Next Clinical Decision #2 and NO CarePlan #3.
    await page.getByRole('button', { name: 'Kết thúc đợt theo dõi' }).click();
    await expect(page.getByText('ĐÃ ĐÓNG')).toBeVisible();
    // History is preserved after close, still visible in the same card.
    await expect(page.getByText('Lượt tái khám', { exact: true })).toHaveCount(2);
    await expect(page.getByText('Cải thiện một phần (browser T7, synthetic)')).toBeVisible();
    // No Longo close/reopen wording on a Hemorrhoid episode.
    await expect(page.getByRole('button', { name: 'Đóng đợt điều trị' })).toHaveCount(0);

    // The termination created neither a second Next Clinical Decision nor a
    // third CarePlan — assert against the authoritative Timeline projection.
    const closedTimeline = await (await api.get(`/patients/${patientId}/timeline`)).json();
    const episodeEvents = closedTimeline.episodes[0].events as Array<{
      type: string;
      data: Record<string, unknown>;
    }>;
    expect(
      episodeEvents.filter(
        (e) =>
          e.type === 'CLINICAL_FORM_SUBMITTED' &&
          e.data.templateKey === 'HEMORRHOID_NEXT_CLINICAL_DECISION',
      ),
    ).toHaveLength(1);
    // DEC016: Initial and Return #1 plans both belong to this same Case.
    expect(episodeEvents.filter((e) => e.type === 'CARE_PLAN_SIGNED')).toHaveLength(2);

    // 9. Correction batch C2/§D — explicit reopen with a required reason via
    // the existing (T4-audited) careEpisodesApi.reopen.
    await page.getByRole('button', { name: 'Mở lại đợt theo dõi' }).click();
    await page.getByLabel('Lý do mở lại').fill('Cần theo dõi thêm (browser, synthetic)');
    await page.getByRole('button', { name: 'Xác nhận mở lại' }).click();
    await expect(page.getByText('ĐANG ĐIỀU TRỊ')).toBeVisible();

    await api.dispose();
  });
});
