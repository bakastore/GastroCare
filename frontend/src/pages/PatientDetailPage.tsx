import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { careEpisodesApi, patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { PageHeader } from '../components/PageHeader';
import { formatDate, formatDateTime } from '../lib/format';
import { flattenTimeline } from '../types/domain';
import type { TimelineEvent } from '../types/domain';
import { LongoEpisodeWorkspace } from './LongoEpisodeWorkspace';
import { PatientDashboard } from './PatientDashboard';

const genderLabel: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

const HEMORRHOID_TREATMENT_EPISODE_TYPE = 'HEMORRHOID_TREATMENT';

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();

  const patientQuery = useApiQuery(() => patientsApi.getById(patientId as string), [patientId]);

  if (patientQuery.isLoading) return <LoadingState />;
  if (patientQuery.error) return <ErrorState message={patientQuery.error} />;
  const patient = patientQuery.data;
  if (!patient) return null;

  return (
    <div>
      <PageHeader
        parentLabel="Danh sách bệnh nhân"
        parentHref="/patients"
        title={patient.fullName}
      />
      <dl className="identity-summary">
        <dt>Ngày sinh</dt>
        <dd>{formatDate(patient.dateOfBirth)}</dd>
        <dt>Giới tính</dt>
        <dd>{genderLabel[patient.gender] ?? patient.gender}</dd>
        <dt>Điện thoại</dt>
        <dd>{patient.phone}</dd>
      </dl>

      {user?.role === 'DOCTOR' ? (
        <DoctorClinicalWorkspace patientId={patient.id} />
      ) : (
        <ReceptionistWorkspace patientId={patient.id} />
      )}
    </div>
  );
}

// DEC-020 Package B — T9 per-patient navigation.
//
//   Patient Dashboard (default)  ← factual current state, no Timeline needed
//   Lâm sàng                     ← the existing Case workspace (Examination /
//                                   Investigation / Diagnosis / Treatment /
//                                   Follow-up), reflected not reimplemented
//   Lịch sử                      ← the read-only Timeline projection, kept
//
// The active view lives in ?view= so leaving for a form page and coming
// back restores it. Package A Case/recurrence lifecycle is untouched — the
// "Lâm sàng" view renders the same LongoEpisodeWorkspace as before.
const PATIENT_VIEWS = ['dashboard', 'clinical', 'history'] as const;
type PatientView = (typeof PATIENT_VIEWS)[number];
const PATIENT_VIEW_LABEL: Record<PatientView, string> = {
  dashboard: 'Bảng tổng quan',
  clinical: 'Lâm sàng',
  history: 'Lịch sử',
};

function DoctorClinicalWorkspace({ patientId }: { patientId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const view: PatientView = PATIENT_VIEWS.includes(viewParam as PatientView)
    ? (viewParam as PatientView)
    : 'dashboard';
  const setView = (next: PatientView) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('view', next);
        return params;
      },
      { replace: true },
    );
  };

  return (
    <div>
      {/* "Tạo lượt khám" is a patient-level action, not view-specific — it
          stays available in every view. */}
      <VisitEntryMenu patientId={patientId} />

      <div className="row-actions" role="tablist" aria-label="Chế độ xem hồ sơ bệnh nhân">
        {PATIENT_VIEWS.map((name) => (
          <button
            key={name}
            role="tab"
            type="button"
            aria-selected={view === name}
            className={view === name ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setView(name)}
          >
            {PATIENT_VIEW_LABEL[name]}
          </button>
        ))}
      </div>

      {view === 'dashboard' && <PatientDashboard patientId={patientId} />}

      {view === 'clinical' && (
        <div id="case-workspace">
          <LongoEpisodeWorkspace patientId={patientId} />
        </div>
      )}

      {view === 'history' && <PatientHistoryTimeline patientId={patientId} />}
    </div>
  );
}

// DEC-020 Package B — T9: the Timeline stays as a read-only historical
// projection under "Lịch sử". It is not deleted and it is not a write
// target — the Doctor should not need it to reconstruct current state (the
// Dashboard does that), but full longitudinal history remains available.
function PatientHistoryTimeline({ patientId }: { patientId: string }) {
  const timelineQuery = useApiQuery(() => patientsApi.getTimeline(patientId), [patientId]);

  if (timelineQuery.isLoading) return <LoadingState />;
  if (timelineQuery.error) return <ErrorState message={timelineQuery.error} />;
  const timeline = timelineQuery.data;
  if (!timeline) return null;

  const events: TimelineEvent[] = flattenTimeline(timeline)
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const eventLabel: Record<TimelineEvent['type'], string> = {
    ENCOUNTER: 'Lượt khám',
    CLINICAL_FORM_SUBMITTED: 'Biểu mẫu lâm sàng hoàn tất',
    CARE_PLAN_SIGNED: 'Kế hoạch chăm sóc đã ký',
    CARE_TASK: 'Nhiệm vụ chăm sóc',
    FOLLOW_UP_TASK: 'Nhiệm vụ tái khám',
  };

  return (
    <section className="dashboard-card">
      <h3>Dòng thời gian (chỉ đọc)</h3>
      {events.length === 0 && (
        <EmptyState message="Chưa có sự kiện trong lịch sử bệnh nhân." />
      )}
      <ul className="timeline">
        {events.map((event, index) => (
          <li key={`${event.type}-${index}`} className={`timeline-item timeline-${event.type}`}>
            <span className="timeline-time">{formatDateTime(event.timestamp)}</span>
            <div>
              <strong>{eventLabel[event.type]}</strong>
              {event.type === 'ENCOUNTER' && event.data.reasonForVisit
                ? ` — ${String(event.data.reasonForVisit)}`
                : null}
              {event.type === 'CLINICAL_FORM_SUBMITTED'
                ? ` — ${String(event.data.templateKey)} (phiên bản ${String(
                    event.data.revisionNumber,
                  )})`
                : null}
              {event.type === 'CLINICAL_FORM_SUBMITTED' && event.data.summary ? (
                <p>{String(event.data.summary)}</p>
              ) : null}
              {(event.type === 'CARE_TASK' || event.type === 'FOLLOW_UP_TASK') && event.data.status
                ? ` — ${String(event.data.status)}`
                : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="form-hint">
        Đây là hình chiếu lịch sử chỉ đọc. Trạng thái hiện tại xem ở Bảng tổng quan và phần Lâm sàng.
      </p>
    </section>
  );
}

/**
 * DEMO UI — one "+ Tạo lượt khám" entry point that offers only the options
 * that make sense for this patient's real context. Pure UI orchestration:
 * it reads GET /patients/:id/care-episodes and routes to the *existing*
 * workflows/APIs. It never changes workflowKind, Encounter API meaning,
 * Case creation, Return logic or any clinical inference — and it does not
 * implement an unscheduled Return.
 */
function VisitEntryMenu({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const episodesQuery = useApiQuery(
    () => careEpisodesApi.listByPatient(patientId),
    [patientId],
  );

  const hasActiveHemorrhoidCase = (episodesQuery.data ?? []).some(
    (e) => e.episodeType === HEMORRHOID_TREATMENT_EPISODE_TYPE && e.status === 'ACTIVE',
  );

  return (
    <div className="visit-entry">
      <button
        type="button"
        className="btn btn-primary"
        aria-expanded={open}
        disabled={episodesQuery.isLoading}
        onClick={() => setOpen((v) => !v)}
      >
        + Tạo lượt khám
      </button>

      {open && (
        <div className="visit-entry-menu" role="menu">
          {hasActiveHemorrhoidCase ? (
            <>
              {/* An ACTIVE Hemorrhoid Case already exists — continue it in
                  the workspace below (where the eligible Return / follow-up
                  actions already live). No parallel "Khám trĩ mới". */}
              <a
                className="visit-entry-option"
                role="menuitem"
                href="#case-workspace"
                onClick={() => setOpen(false)}
              >
                Tiếp tục điều trị trĩ
              </a>
              <Link
                className="visit-entry-option"
                role="menuitem"
                to={`/patients/${patientId}/encounters/new`}
                onClick={() => setOpen(false)}
              >
                Khám khác
              </Link>
            </>
          ) : (
            <>
              <Link
                className="visit-entry-option"
                role="menuitem"
                to={`/patients/${patientId}/hemorrhoid/new-encounter`}
                onClick={() => setOpen(false)}
              >
                Khám trĩ
              </Link>
              <Link
                className="visit-entry-option"
                role="menuitem"
                to={`/patients/${patientId}/encounters/new`}
                onClick={() => setOpen(false)}
              >
                Khám khác
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// DEC-010 §B — a Receptionist may create the Encounter Context (Facility +
// Room + responsible clinician) but must not gain read access to detailed
// clinical content (CORE-01 section 12 role boundary, preserved
// unchanged). This entry point only lets the Receptionist reach the
// Encounter Context creation form, never the exam/clinical form pages.
function ReceptionistWorkspace({ patientId }: { patientId: string }) {
  return (
    <div>
      <div className="form-actions">
        <Link className="btn btn-primary" to={`/patients/${patientId}/hemorrhoid/new-encounter`}>
          + Lượt khám trĩ mới (tiếp đón)
        </Link>
      </div>
      <p className="form-hint">
        Không có quyền xem nội dung lâm sàng chi tiết của bệnh nhân này.
      </p>
    </div>
  );
}
