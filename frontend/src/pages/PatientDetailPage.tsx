import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ErrorState, LoadingState } from '../components/AsyncStates';
import { formatDate } from '../lib/format';
import { LongoEpisodeWorkspace } from './LongoEpisodeWorkspace';

const genderLabel: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

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
      <h1>{patient.fullName}</h1>
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
      <div className="form-actions">
        <Link className="btn btn-primary" to={`/patients/${patientId}/encounters/new`}>
          + Lượt khám mới (ngoài đợt điều trị)
        </Link>
        <Link className="btn btn-primary" to={`/patients/${patientId}/hemorrhoid/new-encounter`}>
          + Lượt khám trĩ mới
        </Link>
      </div>

      <LongoEpisodeWorkspace patientId={patientId} />
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
