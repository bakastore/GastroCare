import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { formatDate, formatDateTime } from '../lib/format';

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
        <p className="form-hint">
          Không có quyền xem nội dung lâm sàng chi tiết của bệnh nhân này.
        </p>
      )}
    </div>
  );
}

function DoctorClinicalWorkspace({ patientId }: { patientId: string }) {
  const timelineQuery = useApiQuery(() => patientsApi.getTimeline(patientId), [patientId]);

  return (
    <div>
      <div className="form-actions">
        <Link className="btn btn-primary" to={`/patients/${patientId}/encounters/new`}>
          + Lượt khám mới
        </Link>
      </div>

      <h2>Dòng thời gian</h2>
      {timelineQuery.isLoading && <LoadingState />}
      {timelineQuery.error && <ErrorState message={timelineQuery.error} />}
      {!timelineQuery.isLoading && !timelineQuery.error && (timelineQuery.data ?? []).length === 0 && (
        <EmptyState message="Chưa có dữ liệu lâm sàng." />
      )}
      {!timelineQuery.isLoading && !timelineQuery.error && (timelineQuery.data ?? []).length > 0 && (
        <ul className="timeline">
          {(timelineQuery.data ?? []).map((event, index) => (
            <li key={`${event.type}-${index}`} className={`timeline-item timeline-${event.type}`}>
              <span className="timeline-time">{formatDateTime(event.timestamp)}</span>
              <TimelineEventBody event={event} patientId={patientId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TimelineEventBody({
  event,
  patientId,
}: {
  event: { type: string; data: Record<string, unknown> };
  patientId: string;
}) {
  if (event.type === 'ENCOUNTER') {
    const encounterId = String(event.data.id);
    return (
      <div>
        <strong>Lượt khám</strong> — {String(event.data.reasonForVisit)}
        <p>{String(event.data.assessment)}</p>
        <Link to={`/patients/${patientId}/encounters/${encounterId}/clinical-forms/hemorrhoid-longo-followup`}>
          Phiếu khám lại (Longo)
        </Link>
      </div>
    );
  }
  if (event.type === 'CLINICAL_FORM_SUBMITTED') {
    const scores = event.data.computedScores as Record<string, number | null> | null;
    return (
      <div>
        <strong>Phiếu khám lại đã hoàn tất</strong> — {String(event.data.templateKey)}
        {scores?.wexner !== undefined && scores?.wexner !== null && (
          <p>Tổng điểm Wexner: {scores.wexner} / 20</p>
        )}
      </div>
    );
  }
  if (event.type === 'CARE_PLAN_SIGNED') {
    return (
      <div>
        <strong>Kế hoạch chăm sóc đã ký (phiên bản {String(event.data.versionNumber)})</strong>
        <p>{String(event.data.instructions)}</p>
        <Link to={`/care-plans/${event.data.carePlanId}`}>Xem kế hoạch chăm sóc</Link>
      </div>
    );
  }
  if (event.type === 'CARE_TASK') {
    return (
      <div>
        <strong>Nhiệm vụ theo dõi</strong> — {String(event.data.status)} — hạn{' '}
        {formatDate(String(event.data.dueDate))}
      </div>
    );
  }
  return null;
}
