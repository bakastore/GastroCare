import { useState } from 'react';
import type { FormEvent } from 'react';
import { facilitiesApi, roomsApi } from '../../api/resources';
import { useApiQuery } from '../../api/useApiQuery';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncStates';
import { PageHeader } from '../../components/PageHeader';
import { useNotification } from '../../components/NotificationProvider';
import { ApiError } from '../../api/client';
import type { Facility } from '../../types/domain';

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

// DEC-018 T5 — Facility/Room management is a Clinic Admin capability
// (RequireClinicAdmin). Create actions are re-authorized server-side and
// report PROCESSING / SUCCESS / ERROR.
export function FacilitiesRoomsPage() {
  const notify = useNotification();
  const facilitiesQuery = useApiQuery(() => facilitiesApi.list(), []);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function createFacility(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await facilitiesApi.create(name.trim());
      setName('');
      notify.success('Đã tạo cơ sở');
      facilitiesQuery.reload();
    } catch (err) {
      const message = errMessage(err, 'Không tạo được cơ sở.');
      setError(message);
      notify.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Cơ sở & phòng"
        subtitle="Cơ sở khám bệnh và phòng. Tạo mới yêu cầu quyền quản trị cơ sở."
      />

      <form className="clinical-section" onSubmit={createFacility}>
        <h2>Thêm cơ sở</h2>
        <label htmlFor="new-facility-name">Tên cơ sở</label>
        <input
          id="new-facility-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>
          {busy ? 'Đang xử lý…' : 'Thêm cơ sở'}
        </button>
      </form>

      {error && <ErrorState message={error} />}
      {facilitiesQuery.isLoading && <LoadingState />}
      {facilitiesQuery.error && <ErrorState message={facilitiesQuery.error} />}
      {!facilitiesQuery.isLoading &&
        !facilitiesQuery.error &&
        (facilitiesQuery.data ?? []).length === 0 && (
          <EmptyState message="Chưa có cơ sở nào." />
        )}
      {(facilitiesQuery.data ?? []).map((facility) => (
        <FacilityCard key={facility.id} facility={facility} />
      ))}
    </div>
  );
}

function FacilityCard({ facility }: { facility: Facility }) {
  const notify = useNotification();
  const roomsQuery = useApiQuery(
    () => roomsApi.listByFacility(facility.id),
    [facility.id],
  );
  const [roomName, setRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await roomsApi.create({ facilityId: facility.id, name: roomName.trim() });
      setRoomName('');
      notify.success('Đã tạo phòng');
      roomsQuery.reload();
    } catch (err) {
      const message = errMessage(err, 'Không tạo được phòng.');
      setError(message);
      notify.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="clinical-section">
      <h2>{facility.name}</h2>
      {roomsQuery.isLoading && <LoadingState />}
      {roomsQuery.error && <ErrorState message={roomsQuery.error} />}
      {!roomsQuery.isLoading && !roomsQuery.error && (
        <ul>
          {(roomsQuery.data ?? []).length === 0 ? (
            <li>Chưa có phòng.</li>
          ) : (
            (roomsQuery.data ?? []).map((room) => <li key={room.id}>{room.name}</li>)
          )}
        </ul>
      )}
      <form className="inline-form" onSubmit={createRoom}>
        <label htmlFor={`new-room-${facility.id}`}>Tên phòng</label>
        <input
          id={`new-room-${facility.id}`}
          type="text"
          required
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
        />
        <button
          type="submit"
          className="btn btn-ghost"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? 'Đang xử lý…' : 'Thêm phòng'}
        </button>
      </form>
      {error && <ErrorState message={error} />}
    </section>
  );
}
