import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { cliniciansApi, encountersApi, facilitiesApi, roomsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ApiError } from '../api/client';
import { ErrorState, LoadingState } from '../components/AsyncStates';
import type { Encounter } from '../types/domain';

// Hemorrhoid Vertical Slice 1 correction (DEC-010, ChatGPT review Finding
// 1) — minimum usable Encounter Context creation covering
// Facility -> Room -> responsible clinician (pilot default shown, resolved
// through config/lookup via GET /clinicians, never hardcoded) selection,
// ahead of opening HEMORRHOID_EXAMINATION. Reuses the existing
// form-page/page-actions conventions already established by
// NewEncounterPage.tsx rather than inventing a new UI pattern. Accessible
// to both DOCTOR and RECEPTIONIST (DEC-010 §B: a Receptionist may create
// the Encounter Context). Deliberately has no clinicalNote/assessment
// fields — a Receptionist has no clinical content to record yet.
export function NewHemorrhoidEncounterPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const facilitiesQuery = useApiQuery(() => facilitiesApi.list(), []);
  const cliniciansQuery = useApiQuery(() => cliniciansApi.list(), []);

  const [facilityId, setFacilityId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [responsibleClinicianId, setResponsibleClinicianId] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState('Khám trĩ');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<Encounter | null>(null);

  const roomsQuery = useApiQuery(
    () => (facilityId ? roomsApi.listByFacility(facilityId) : Promise.resolve([])),
    [facilityId],
  );

  function handleFacilityChange(nextFacilityId: string) {
    setFacilityId(nextFacilityId);
    // Reset the Room selection directly from the event that caused the
    // change (Facility -> Room is a dependent selection) rather than in a
    // useEffect, so there is no extra cascading render.
    setRoomId('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!patientId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const encounter = await encountersApi.create({
        patientId,
        occurredAt: new Date(occurredAt).toISOString(),
        reasonForVisit,
        roomId: roomId || undefined,
        // Omitted when left on "Mặc định" — the backend resolves the
        // configured pilot default clinician (DEC-010 §B), never a
        // hardcoded id here.
        responsibleClinicianId: responsibleClinicianId || undefined,
      });
      setCreated(encounter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được lượt khám.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (created) {
    const facility = (facilitiesQuery.data ?? []).find((f) => f.id === facilityId);
    const room = (roomsQuery.data ?? []).find((r) => r.id === roomId);
    const clinician = (cliniciansQuery.data ?? []).find(
      (c) => c.id === created.responsibleClinicianId,
    );
    return (
      <div className="form-page">
        <h1>Đã tạo lượt khám trĩ</h1>
        <dl className="identity-summary">
          <dt>Cơ sở</dt>
          <dd>{facility?.name ?? '—'}</dd>
          <dt>Phòng</dt>
          <dd>{room?.name ?? '—'}</dd>
          <dt>Bác sĩ phụ trách</dt>
          <dd>
            {clinician?.email ?? created.responsibleClinicianId}
            {!responsibleClinicianId && ' (mặc định hệ thống)'}
          </dd>
        </dl>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(`/patients/${patientId}`)}
          >
            Về hồ sơ bệnh nhân
          </button>
          {user?.role === 'DOCTOR' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                navigate(
                  `/patients/${patientId}/encounters/${created.id}/hemorrhoid-examination`,
                )
              }
            >
              Mở phiếu khám trĩ
            </button>
          )}
        </div>
      </div>
    );
  }

  if (facilitiesQuery.isLoading || cliniciansQuery.isLoading) return <LoadingState />;
  if (facilitiesQuery.error) return <ErrorState message={facilitiesQuery.error} />;
  if (cliniciansQuery.error) return <ErrorState message={cliniciansQuery.error} />;

  return (
    <div className="form-page">
      <h1>Lượt khám trĩ mới (tiếp đón)</h1>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="occurredAt">Thời điểm khám</label>
        <input
          id="occurredAt"
          type="datetime-local"
          required
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />

        <label htmlFor="reasonForVisit">Lý do khám</label>
        <input
          id="reasonForVisit"
          required
          value={reasonForVisit}
          onChange={(e) => setReasonForVisit(e.target.value)}
        />

        <label htmlFor="facilityId">Cơ sở khám</label>
        <select
          id="facilityId"
          value={facilityId}
          onChange={(e) => handleFacilityChange(e.target.value)}
        >
          <option value="">Chọn cơ sở</option>
          {(facilitiesQuery.data ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        <label htmlFor="roomId">Phòng khám</label>
        <select
          id="roomId"
          value={roomId}
          disabled={!facilityId}
          onChange={(e) => setRoomId(e.target.value)}
        >
          <option value="">Chọn phòng</option>
          {(roomsQuery.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <label htmlFor="responsibleClinicianId">Bác sĩ phụ trách</label>
        <select
          id="responsibleClinicianId"
          value={responsibleClinicianId}
          onChange={(e) => setResponsibleClinicianId(e.target.value)}
        >
          <option value="">Mặc định (bác sĩ trực — cấu hình hệ thống)</option>
          {(cliniciansQuery.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.email}
            </option>
          ))}
        </select>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(`/patients/${patientId}`)}
          >
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Tạo lượt khám'}
          </button>
        </div>
      </form>
    </div>
  );
}
