import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { careEpisodesApi, patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ErrorState, LoadingState } from '../components/AsyncStates';
import { PageHeader } from '../components/PageHeader';
import { formatDate } from '../lib/format';
import { LongoEpisodeWorkspace } from './LongoEpisodeWorkspace';

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

function DoctorClinicalWorkspace({ patientId }: { patientId: string }) {
  return (
    <div>
      <VisitEntryMenu patientId={patientId} />
      <div id="case-workspace">
        <LongoEpisodeWorkspace patientId={patientId} />
      </div>
    </div>
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
