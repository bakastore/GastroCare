import { facilitiesApi, roomsApi } from '../../api/resources';
import { useApiQuery } from '../../api/useApiQuery';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncStates';
import { PageHeader } from '../../components/PageHeader';
import type { Facility } from '../../types/domain';

// DEMO UI — view-only. GET /facilities and GET /rooms?facilityId= exist
// (DEC-010 §C). No create/edit here; management is out of demo scope.
export function FacilitiesRoomsPage() {
  const facilitiesQuery = useApiQuery(() => facilitiesApi.list(), []);

  return (
    <div>
      <PageHeader title="Cơ sở & phòng" subtitle="Cơ sở khám bệnh và phòng (chỉ xem)." />

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
  const roomsQuery = useApiQuery(
    () => roomsApi.listByFacility(facility.id),
    [facility.id],
  );

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
    </section>
  );
}
