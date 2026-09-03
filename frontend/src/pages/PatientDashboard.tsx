import { Link } from 'react-router-dom';
import {
  careEpisodesApi,
  clinicalFormsApi,
  followUpTasksApi,
  investigationsApi,
  patientsApi,
} from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { formatDate, formatDateTime } from '../lib/format';
import { flattenTimeline } from '../types/domain';
import type {
  CareEpisode,
  ClinicalFormSubmission,
  Investigation,
  TimelineEvent,
} from '../types/domain';

// DEC-020 Package B — T8 Patient Dashboard.
//
// The default Doctor landing view for a patient. It answers current-state
// questions from FACTUAL existing data only (Patient / Encounter /
// CareEpisode / ClinicalFormSubmission / Investigation / CareTask read
// projections). It is composed entirely from existing endpoints — no new
// backend endpoint, no schema change (Contract §16 / T11).
//
// It MUST NOT (Contract §13): diagnose, score disease, classify result
// abnormality, recommend treatment, infer recurrence, infer episode close,
// infer a performed procedure. Whenever a value is not authoritatively
// recorded it shows "Chưa ghi nhận" — it never manufactures a conclusion.
//
// Known deferrals surfaced honestly rather than inferred:
//  - "Kế hoạch bệnh nhân đã đồng ý" has no authoritative storage in the
//    current model → shown as "Chưa ghi nhận / không có sẵn" (Contract §11).
//  - Investigation explicit order-status and Doctor-reviewed state have no
//    backing column → only "đã chỉ định" / "đã có kết quả" are shown; the
//    review state is labelled as deferred to Package C (Contract §12 / T7).

const HEMORRHOID_TREATMENT_EPISODE_TYPE = 'HEMORRHOID_TREATMENT';

const EPISODE_TYPE_LABEL: Record<string, string> = {
  HEMORRHOID_TREATMENT: 'Điều trị / theo dõi trĩ',
  LONGO_TREATMENT: 'Điều trị Longo',
};

const GENDER_LABEL: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

function latestCompleted(
  submissions: ClinicalFormSubmission[],
  templateKey: string,
): ClinicalFormSubmission | null {
  const done = submissions
    .filter((s) => s.templateKey === templateKey && s.status === 'COMPLETED')
    .sort(
      (a, b) =>
        new Date(b.completedAt ?? b.createdAt).getTime() -
        new Date(a.completedAt ?? a.createdAt).getTime(),
    );
  return done[0] ?? null;
}

function NotRecorded() {
  return <span className="dashboard-muted">Chưa ghi nhận</span>;
}

// DEC-020 Package B F1 — a failed section query must be visibly distinct from
// a query that loaded successfully and is genuinely empty. Every card that
// depends on a query other than patientQuery renders this when that query's
// `.error` is set, instead of the same "empty" copy a successful-but-empty
// load would show.
function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <p className="form-error" role="alert">
      {message}{' '}
      <button type="button" className="btn btn-ghost btn-small" onClick={onRetry}>
        Thử lại
      </button>
    </p>
  );
}

const LOAD_ERROR = 'Không tải được dữ liệu.';

export function PatientDashboard({ patientId }: { patientId: string }) {
  const patientQuery = useApiQuery(() => patientsApi.getById(patientId), [patientId]);
  const timelineQuery = useApiQuery(() => patientsApi.getTimeline(patientId), [patientId]);
  const episodesQuery = useApiQuery(() => careEpisodesApi.listByPatient(patientId), [patientId]);
  const followUpQuery = useApiQuery(() => followUpTasksApi.listByPatient(patientId), [patientId]);
  const formsQuery = useApiQuery(() => clinicalFormsApi.listByPatient(patientId), [patientId]);

  const activeHemorrhoidCase = (episodesQuery.data ?? []).find(
    (e) => e.episodeType === HEMORRHOID_TREATMENT_EPISODE_TYPE && e.status === 'ACTIVE',
  );

  const investigationsQuery = useApiQuery(
    () =>
      activeHemorrhoidCase
        ? investigationsApi.list(activeHemorrhoidCase.id)
        : Promise.resolve([] as Investigation[]),
    [activeHemorrhoidCase?.id],
  );

  if (patientQuery.isLoading) return <LoadingState />;
  if (patientQuery.error) return <ErrorState message={patientQuery.error} />;
  const patient = patientQuery.data;
  if (!patient) return null;

  const events: TimelineEvent[] = timelineQuery.data ? flattenTimeline(timelineQuery.data) : [];
  const encounters = events
    .filter((e) => e.type === 'ENCOUNTER')
    .sort(
      (a, b) =>
        new Date(String(b.data.occurredAt ?? b.timestamp)).getTime() -
        new Date(String(a.data.occurredAt ?? a.timestamp)).getTime(),
    );
  const latestEncounter = encounters[0];

  const episodes = episodesQuery.data ?? [];
  const currentEpisode: CareEpisode | undefined =
    activeHemorrhoidCase ??
    [...episodes].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )[0];

  const submissions = formsQuery.data ?? [];
  const diagnosis = latestCompleted(submissions, 'HEMORRHOID_DIAGNOSIS');
  const treatment = latestCompleted(submissions, 'HEMORRHOID_TREATMENT_DECISION');

  // DEC-020 Package B F2 — "previous vs current" must compare two distinct
  // VISITS, not two rows by date. A single examination's amendment lineage
  // (original + corrected revisions) shares one `logicalGroupId`
  // (schema.prisma: ClinicalFormSubmission.logicalGroupId /
  // @@unique([logicalGroupId, revisionNumber])); the backend also allows at
  // most one HEMORRHOID_EXAMINATION chain per Encounter. So: group COMPLETED
  // rows by logicalGroupId, keep only each group's latest revision, then take
  // the two most recent distinct groups.
  const examByGroup = new Map<string, ClinicalFormSubmission>();
  for (const s of submissions) {
    if (s.templateKey !== 'HEMORRHOID_EXAMINATION' || s.status !== 'COMPLETED') continue;
    const current = examByGroup.get(s.logicalGroupId);
    const isNewer =
      !current ||
      s.revisionNumber > current.revisionNumber ||
      (s.revisionNumber === current.revisionNumber &&
        new Date(s.completedAt ?? s.createdAt).getTime() >
          new Date(current.completedAt ?? current.createdAt).getTime());
    if (isNewer) examByGroup.set(s.logicalGroupId, s);
  }
  const examinations = [...examByGroup.values()].sort(
    (a, b) =>
      new Date(b.completedAt ?? b.createdAt).getTime() -
      new Date(a.completedAt ?? a.createdAt).getTime(),
  );
  const latestExam = examinations[0];
  const priorExam = examinations[1];

  const investigations = investigationsQuery.data ?? [];
  const orderedCount = investigations.filter((i) => (i.orders ?? []).length > 0).length;
  const resultedCount = investigations.filter((i) => (i.results ?? []).length > 0).length;
  const pendingCount = investigations.filter(
    (i) => (i.orders ?? []).length > 0 && (i.results ?? []).length === 0,
  ).length;

  const openFollowUps = (followUpQuery.data ?? [])
    .filter((t) => t.status === 'OPEN')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const vitalRows: { key: string; label: string }[] = [
    { key: 'pulse', label: 'Mạch' },
    { key: 'systolicBloodPressure', label: 'HA tâm thu' },
    { key: 'diastolicBloodPressure', label: 'HA tâm trương' },
    { key: 'respiratoryRate', label: 'Nhịp thở' },
    { key: 'temperature', label: 'Nhiệt độ' },
    { key: 'spo2', label: 'SpO2' },
    { key: 'weight', label: 'Cân nặng' },
  ];
  const vital = (s: ClinicalFormSubmission | undefined, key: string) => {
    const v = s?.responses?.[key];
    return typeof v === 'number' ? String(v) : '—';
  };

  return (
    <div className="patient-dashboard">
      <section className="dashboard-card">
        <h3>Bệnh nhân</h3>
        <dl className="identity-summary">
          <dt>Họ tên</dt>
          <dd>{patient.fullName}</dd>
          <dt>Ngày sinh</dt>
          <dd>{formatDate(patient.dateOfBirth)}</dd>
          <dt>Giới tính</dt>
          <dd>{GENDER_LABEL[patient.gender] ?? patient.gender}</dd>
          <dt>Điện thoại</dt>
          <dd>{patient.phone}</dd>
        </dl>
      </section>

      <section className="dashboard-card">
        <h3>Lượt khám lâm sàng gần nhất</h3>
        {timelineQuery.error ? (
          <SectionError message={LOAD_ERROR} onRetry={timelineQuery.reload} />
        ) : latestEncounter ? (
          <p>
            {formatDateTime(String(latestEncounter.data.occurredAt ?? latestEncounter.timestamp))}
            {' — '}
            {String(latestEncounter.data.reasonForVisit ?? '')}
          </p>
        ) : (
          <NotRecorded />
        )}
      </section>

      <section className="dashboard-card">
        <h3>Case hiện tại</h3>
        {episodesQuery.error ? (
          <SectionError message={LOAD_ERROR} onRetry={episodesQuery.reload} />
        ) : currentEpisode ? (
          <p>
            {EPISODE_TYPE_LABEL[currentEpisode.episodeType] ?? currentEpisode.episodeType}{' '}
            {currentEpisode.status === 'ACTIVE' ? (
              <span className="badge badge-open">ĐANG MỞ</span>
            ) : (
              <span className="badge badge-signed">ĐÃ ĐÓNG</span>
            )}
            {' · bắt đầu '}
            {formatDate(currentEpisode.startedAt)}
          </p>
        ) : (
          <p>
            <span className="dashboard-muted">Chưa có Case</span>
          </p>
        )}
      </section>

      <section className="dashboard-card">
        <h3>Chẩn đoán hiện tại</h3>
        {formsQuery.error ? (
          <SectionError message={LOAD_ERROR} onRetry={formsQuery.reload} />
        ) : diagnosis && typeof diagnosis.responses?.diagnosisSummary === 'string' ? (
          <>
            <p className="dashboard-freetext">{String(diagnosis.responses.diagnosisSummary)}</p>
            <p className="form-hint">
              Ghi nhận {formatDateTime(diagnosis.completedAt)} · phiên bản {diagnosis.revisionNumber}
            </p>
          </>
        ) : (
          <NotRecorded />
        )}
      </section>

      <section className="dashboard-card">
        <h3>Quyết định điều trị</h3>
        <dl className="identity-summary">
          <dt>Đề xuất của bác sĩ</dt>
          <dd>
            {formsQuery.error ? (
              <SectionError message={LOAD_ERROR} onRetry={formsQuery.reload} />
            ) : treatment && typeof treatment.responses?.decisionSummary === 'string' ? (
              <span className="dashboard-freetext">
                {String(treatment.responses.decisionSummary)}
              </span>
            ) : (
              <NotRecorded />
            )}
          </dd>
          <dt>Kế hoạch bệnh nhân đã đồng ý</dt>
          <dd>
            <span className="dashboard-muted">Chưa ghi nhận / không có sẵn</span>
          </dd>
          <dt>Điều trị đã thực hiện</dt>
          <dd>
            <span className="dashboard-muted">Chưa ghi nhận</span>
          </dd>
        </dl>
      </section>

      <section className="dashboard-card">
        <h3>Cận lâm sàng</h3>
        {episodesQuery.error ? (
          <SectionError message={LOAD_ERROR} onRetry={episodesQuery.reload} />
        ) : investigationsQuery.error ? (
          <SectionError message={LOAD_ERROR} onRetry={investigationsQuery.reload} />
        ) : !activeHemorrhoidCase ? (
          <p className="dashboard-muted">Không có Case trĩ đang mở để hiển thị cận lâm sàng.</p>
        ) : (
          <dl className="identity-summary">
            <dt>Đã chỉ định</dt>
            <dd>{orderedCount}</dd>
            <dt>Đang chờ kết quả</dt>
            <dd>{pendingCount}</dd>
            <dt>Đã có kết quả</dt>
            <dd>{resultedCount}</dd>
            <dt>Trạng thái bác sĩ đã đọc</dt>
            <dd>
              <span className="dashboard-muted">
                Chưa ghi nhận (chưa có trong mô hình dữ liệu — Package C)
              </span>
            </dd>
          </dl>
        )}
      </section>

      <section className="dashboard-card">
        <h3>Nhiệm vụ theo dõi sắp tới</h3>
        {followUpQuery.error ? (
          <SectionError message={LOAD_ERROR} onRetry={followUpQuery.reload} />
        ) : openFollowUps.length === 0 ? (
          <EmptyState message="Không có nhiệm vụ theo dõi đang mở." />
        ) : (
          <ul className="dashboard-list">
            {openFollowUps.map((t) => (
              <li key={t.id}>
                {formatDate(t.dueDate)}
                {t.overdue ? <span className="badge badge-overdue"> Quá hạn</span> : null}
                {t.timepointCode ? ` · ${t.timepointCode}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashboard-card">
        <h3>Tóm tắt khám gần nhất</h3>
        {formsQuery.error ? (
          <SectionError message={LOAD_ERROR} onRetry={formsQuery.reload} />
        ) : !latestExam ? (
          <NotRecorded />
        ) : (
          <>
            <p className="form-hint">
              {formatDateTime(latestExam.completedAt)} · phiên bản mẫu v{latestExam.templateVersion}{' '}
              · bản {latestExam.revisionNumber}
            </p>
            <dl className="identity-summary">
              <dt>Phân độ Goligher</dt>
              <dd>
                {latestExam.responses?.hemorrhoidGoligherGrade
                  ? `Độ ${String(latestExam.responses.hemorrhoidGoligherGrade)}`
                  : '—'}
              </dd>
            </dl>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sinh hiệu</th>
                    <th>Lần trước{priorExam ? ` (${formatDate(priorExam.completedAt)})` : ''}</th>
                    <th>Lần này ({formatDate(latestExam.completedAt)})</th>
                  </tr>
                </thead>
                <tbody>
                  {vitalRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td>{vital(priorExam, row.key)}</td>
                      <td>{vital(latestExam, row.key)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="form-hint">
              Đối chiếu lần trước / lần này chỉ hiển thị giá trị thực đã ghi nhận, không diễn giải
              bất thường.
            </p>
          </>
        )}
      </section>

      <section className="dashboard-card">
        <h3>Thao tác</h3>
        <div className="row-actions">
          <Link className="btn btn-primary btn-small" to={`/patients/${patientId}?view=clinical`}>
            Mở phần Lâm sàng
          </Link>
          <Link className="btn btn-ghost btn-small" to={`/patients/${patientId}?view=history`}>
            Xem Lịch sử / Dòng thời gian
          </Link>
        </div>
      </section>
    </div>
  );
}
