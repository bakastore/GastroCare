import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { careEpisodesApi, careTasksApi, patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { PageHeader } from '../components/PageHeader';
import { formatDate } from '../lib/format';
import type { CareEpisode, CareTask } from '../types/domain';

// DEMO UI — clinician-facing "Đợt điều trị" (treatment Cases) list.
// Composed entirely from EXISTING projections: GET /patients, then
// GET /patients/:id/care-episodes per patient, plus GET /care-tasks
// (tenant-wide) for the next follow-up date. No new backend entity, no
// aggregate endpoint. This client-side fan-out is demo-scale (a handful of
// synthetic patients); it is not a production listing strategy.

const EPISODE_TYPE_LABEL: Record<string, string> = {
  HEMORRHOID_TREATMENT: 'Điều trị trĩ',
  LONGO_TREATMENT: 'Longo',
};

function episodeTypeLabel(type: string): string {
  return EPISODE_TYPE_LABEL[type] ?? type;
}

type Filter = 'ACTIVE' | 'CLOSED' | 'ALL';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ACTIVE', label: 'Đang điều trị' },
  { value: 'CLOSED', label: 'Đã kết thúc' },
  { value: 'ALL', label: 'Tất cả' },
];

const FILTER_VALUES = new Set<Filter>(['ACTIVE', 'CLOSED', 'ALL']);

export function TreatmentCasesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('status') as Filter | null;
  const filter: Filter =
    filterParam && FILTER_VALUES.has(filterParam) ? filterParam : 'ACTIVE';
  const setFilter = (value: Filter) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('status', value);
        return next;
      },
      { replace: true },
    );
  };
  const patientsQuery = useApiQuery(() => patientsApi.list(), []);
  const tasksQuery = useApiQuery(() => careTasksApi.list(), []);

  const patients = patientsQuery.data;
  const episodesQuery = useApiQuery(async () => {
    if (!patients) return [];
    const perPatient = await Promise.all(
      patients.map(async (p) => ({
        patient: p,
        episodes: await careEpisodesApi.listByPatient(p.id),
      })),
    );
    return perPatient.flatMap(({ patient, episodes }) =>
      episodes.map((episode) => ({ patient, episode })),
    );
  }, [patients]);

  const nextFollowUpByEpisodeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasksQuery.data ?? []) {
      const episodeId = (task as CareTask).sourceEpisodeId;
      if (!episodeId || task.status !== 'OPEN') continue;
      const current = map.get(episodeId);
      if (!current || new Date(task.dueDate) < new Date(current)) {
        map.set(episodeId, task.dueDate);
      }
    }
    return map;
  }, [tasksQuery.data]);

  const isLoading =
    patientsQuery.isLoading || episodesQuery.isLoading || tasksQuery.isLoading;
  const error = patientsQuery.error ?? episodesQuery.error ?? tasksQuery.error;

  const rows = (episodesQuery.data ?? [])
    .filter(({ episode }) => filter === 'ALL' || episode.status === filter)
    .sort(
      (a, b) =>
        new Date(b.episode.startedAt).getTime() - new Date(a.episode.startedAt).getTime(),
    );

  return (
    <div>
      <PageHeader
        title="Đợt điều trị"
        subtitle="Các đợt điều trị / theo dõi đang mở và đã kết thúc."
      />

      <div className="filter-row" role="tablist" aria-label="Lọc theo trạng thái">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            className={filter === f.value ? 'filter-btn filter-btn-active' : 'filter-btn'}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!isLoading && !error && rows.length === 0 && (
        <EmptyState message="Không có đợt điều trị nào ở trạng thái này." />
      )}

      {!isLoading && !error && rows.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bệnh nhân</th>
                <th>Loại</th>
                <th>Trạng thái</th>
                <th>Bắt đầu</th>
                <th>Tái khám kế tiếp</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ patient, episode }: { patient: { id: string; fullName: string }; episode: CareEpisode }) => {
                const nextFollowUp = nextFollowUpByEpisodeId.get(episode.id);
                return (
                  <tr key={episode.id}>
                    <td>{patient.fullName}</td>
                    <td>{episodeTypeLabel(episode.episodeType)}</td>
                    <td>
                      {episode.status === 'ACTIVE' ? (
                        <span className="badge badge-open">Đang điều trị</span>
                      ) : (
                        <span className="badge badge-signed">Đã kết thúc</span>
                      )}
                    </td>
                    <td>{formatDate(episode.startedAt)}</td>
                    <td>{nextFollowUp ? formatDate(nextFollowUp) : '—'}</td>
                    <td>
                      <Link className="btn btn-ghost" to={`/patients/${patient.id}`}>
                        Mở đợt điều trị
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
