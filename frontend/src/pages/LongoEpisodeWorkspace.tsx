import { useState } from 'react';
import { Link } from 'react-router-dom';
import { careEpisodesApi, followUpTasksApi, patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ApiError } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { formatDate, formatDateTime } from '../lib/format';
import type { CareEpisode, TimelineEvent } from '../types/domain';

// CORE-04 T14 — functional (not redesigned) UI for the Longo Episode
// workflow: explicit start/close/reopen, the six Longo forms reachable from
// each Encounter, the Episode-aware Timeline (grouped, not flattened), and
// the follow-up queue (planned vs actual). See
// docs/09_CORE04_IMPLEMENTATION_CONTRACT.md T14.
const LONGO_FORM_LINKS: { templateKey: string; label: string }[] = [
  { templateKey: 'LONGO_PREOP_ASSESSMENT', label: 'Tiền phẫu' },
  { templateKey: 'LONGO_INTRAOP_RECORD', label: 'Biên bản mổ' },
  { templateKey: 'LONGO_EARLY_POSTOP', label: 'Hậu phẫu sớm' },
  { templateKey: 'LONGO_TWO_WEEK_FOLLOWUP', label: 'Tái khám 2 tuần' },
  { templateKey: 'ANAL_DILATION_ASSESSMENT', label: 'Nong hậu môn' },
  { templateKey: 'LONGO_LONG_TERM_FOLLOWUP', label: 'Tái khám dài hạn' },
];

const TIMEPOINT_LABELS: Record<string, string> = {
  TWO_WEEK: '2 tuần',
  MONTH_1: 'Tháng 1',
  MONTH_3: 'Tháng 3',
  MONTH_6: 'Tháng 6',
};

export function LongoEpisodeWorkspace({ patientId }: { patientId: string }) {
  const episodesQuery = useApiQuery(() => careEpisodesApi.listByPatient(patientId), [patientId]);
  const followUpQuery = useApiQuery(() => followUpTasksApi.listByPatient(patientId), [patientId]);
  const timelineQuery = useApiQuery(() => patientsApi.getTimeline(patientId), [patientId]);

  const [isStarting, setIsStarting] = useState(false);
  const [startedAt, setStartedAt] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingEpisodeId, setPendingEpisodeId] = useState<string | null>(null);
  const [reopeningEpisodeId, setReopeningEpisodeId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  const activeEpisode = (episodesQuery.data ?? []).find((e) => e.status === 'ACTIVE');

  function reloadAll() {
    episodesQuery.reload();
    followUpQuery.reload();
    timelineQuery.reload();
  }

  async function startEpisode() {
    setActionError(null);
    try {
      await careEpisodesApi.create({
        patientId,
        episodeType: 'LONGO_TREATMENT',
        startedAt: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString(),
      });
      setIsStarting(false);
      setStartedAt('');
      reloadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không bắt đầu được đợt điều trị.');
    }
  }

  async function closeEpisode(episodeId: string) {
    setActionError(null);
    setPendingEpisodeId(episodeId);
    try {
      await careEpisodesApi.close(episodeId);
      reloadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không đóng được đợt điều trị.');
    } finally {
      setPendingEpisodeId(null);
    }
  }

  async function reopenEpisode(episodeId: string) {
    setActionError(null);
    setPendingEpisodeId(episodeId);
    try {
      await careEpisodesApi.reopen(episodeId, { reason: reopenReason });
      setReopeningEpisodeId(null);
      setReopenReason('');
      reloadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không mở lại được đợt điều trị.');
    } finally {
      setPendingEpisodeId(null);
    }
  }

  return (
    <div className="longo-workspace">
      <h2>Đợt điều trị Longo</h2>

      {actionError && <ErrorState message={actionError} />}

      {episodesQuery.isLoading && <LoadingState />}
      {episodesQuery.error && <ErrorState message={episodesQuery.error} />}

      {!episodesQuery.isLoading && !episodesQuery.error && !activeEpisode && !isStarting && (
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={() => setIsStarting(true)}>
            + Bắt đầu đợt điều trị Longo
          </button>
        </div>
      )}

      {isStarting && (
        <div className="inline-form">
          <label htmlFor="episodeStartedAt">Thời điểm bắt đầu</label>
          <input
            id="episodeStartedAt"
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
          />
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setIsStarting(false)}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary" onClick={startEpisode}>
              Xác nhận bắt đầu
            </button>
          </div>
        </div>
      )}

      {!episodesQuery.isLoading && (episodesQuery.data ?? []).length === 0 && !isStarting && (
        <EmptyState message="Chưa có đợt điều trị Longo nào." />
      )}

      {(episodesQuery.data ?? []).map((episode) => (
        <EpisodeCard
          key={episode.id}
          episode={episode}
          patientId={patientId}
          isPending={pendingEpisodeId === episode.id}
          isReopening={reopeningEpisodeId === episode.id}
          reopenReason={reopenReason}
          onSetReopenReason={setReopenReason}
          onClose={() => closeEpisode(episode.id)}
          onStartReopen={() => setReopeningEpisodeId(episode.id)}
          onCancelReopen={() => setReopeningEpisodeId(null)}
          onConfirmReopen={() => reopenEpisode(episode.id)}
          events={
            timelineQuery.data?.episodes.find((g) => g.episode.id === episode.id)?.events ?? []
          }
          followUpTasks={(followUpQuery.data ?? []).filter((task) =>
            timelineQuery.data?.episodes
              .find((g) => g.episode.id === episode.id)
              ?.events.some(
                (e) => e.type === 'ENCOUNTER' && e.data.id === task.sourceEncounterId,
              ),
          )}
        />
      ))}

      {(timelineQuery.data?.ungroupedEncounters.filter((e) => e.type === 'ENCOUNTER').length ?? 0) > 0 && (
        <div className="episode-card">
          <h3>Lượt khám ngoài đợt điều trị</h3>
          <TimelineEventList events={timelineQuery.data?.ungroupedEncounters ?? []} patientId={patientId} />
        </div>
      )}
    </div>
  );
}

function EpisodeCard({
  episode,
  patientId,
  isPending,
  isReopening,
  reopenReason,
  onSetReopenReason,
  onClose,
  onStartReopen,
  onCancelReopen,
  onConfirmReopen,
  events,
  followUpTasks,
}: {
  episode: CareEpisode;
  patientId: string;
  isPending: boolean;
  isReopening: boolean;
  reopenReason: string;
  onSetReopenReason: (value: string) => void;
  onClose: () => void;
  onStartReopen: () => void;
  onCancelReopen: () => void;
  onConfirmReopen: () => void;
  events: TimelineEvent[];
  followUpTasks: import('../types/domain').CareTask[];
}) {
  return (
    <div className="episode-card">
      <h3>
        Đợt điều trị Longo — bắt đầu {formatDate(episode.startedAt)}{' '}
        {episode.status === 'ACTIVE' ? (
          <span className="badge badge-open">ĐANG ĐIỀU TRỊ</span>
        ) : (
          <span className="badge badge-signed">ĐÃ ĐÓNG</span>
        )}
      </h3>

      <div className="form-actions">
        {episode.status === 'ACTIVE' && (
          <>
            <Link
              className="btn btn-primary"
              to={`/patients/${patientId}/encounters/new?episodeId=${episode.id}`}
            >
              + Lượt khám trong đợt điều trị
            </Link>
            <button type="button" className="btn btn-ghost" disabled={isPending} onClick={onClose}>
              Đóng đợt điều trị
            </button>
          </>
        )}
        {episode.status === 'CLOSED' && !isReopening && (
          <button type="button" className="btn btn-ghost" onClick={onStartReopen}>
            Mở lại đợt điều trị
          </button>
        )}
      </div>

      {isReopening && (
        <div className="inline-form">
          <label htmlFor={`reopenReason-${episode.id}`}>Lý do mở lại</label>
          <input
            id={`reopenReason-${episode.id}`}
            required
            value={reopenReason}
            onChange={(e) => onSetReopenReason(e.target.value)}
          />
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancelReopen}>
              Hủy
            </button>
            <button type="button" className="btn btn-primary" disabled={isPending} onClick={onConfirmReopen}>
              Xác nhận mở lại
            </button>
          </div>
        </div>
      )}

      <h4>Dòng thời gian trong đợt điều trị</h4>
      <TimelineEventList events={events} patientId={patientId} />

      <h4>Hàng đợi tái khám (kế hoạch so với thực tế)</h4>
      {followUpTasks.length === 0 ? (
        <EmptyState message="Chưa có nhiệm vụ tái khám (được sinh tự động sau khi hoàn tất biên bản mổ)." />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mốc</th>
                <th>Ngày dự kiến</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {followUpTasks
                .slice()
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                .map((task) => (
                  <tr key={task.id}>
                    <td>{TIMEPOINT_LABELS[task.timepointCode ?? ''] ?? task.timepointCode}</td>
                    <td>{formatDate(task.dueDate)}</td>
                    <td>
                      {task.status === 'COMPLETED' ? (
                        <span className="badge badge-signed">Đã tái khám (thực tế)</span>
                      ) : task.overdue ? (
                        <span className="badge badge-overdue">Quá hạn (kế hoạch)</span>
                      ) : (
                        <span className="badge badge-open">Kế hoạch</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TimelineEventList({ events, patientId }: { events: TimelineEvent[]; patientId: string }) {
  if (events.length === 0) {
    return <EmptyState message="Chưa có sự kiện." />;
  }
  return (
    <ul className="timeline">
      {events.map((event, index) => (
        <li key={`${event.type}-${index}`} className={`timeline-item timeline-${event.type}`}>
          <span className="timeline-time">{formatDateTime(event.timestamp)}</span>
          <EpisodeTimelineEventBody event={event} patientId={patientId} />
        </li>
      ))}
    </ul>
  );
}

function EpisodeTimelineEventBody({
  event,
  patientId,
}: {
  event: TimelineEvent;
  patientId: string;
}) {
  if (event.type === 'ENCOUNTER') {
    const encounterId = String(event.data.id);
    return (
      <div>
        <strong>Lượt khám</strong> — {String(event.data.reasonForVisit)}
        <div className="row-actions">
          {LONGO_FORM_LINKS.map((form) => (
            <Link
              key={form.templateKey}
              className="btn btn-ghost btn-small"
              to={`/patients/${patientId}/encounters/${encounterId}/longo-forms/${form.templateKey}`}
            >
              {form.label}
            </Link>
          ))}
          <Link
            className="btn btn-ghost btn-small"
            to={`/patients/${patientId}/encounters/${encounterId}/clinical-forms/hemorrhoid-longo-followup`}
          >
            Phiếu khám lại (cũ)
          </Link>
          <Link
            className="btn btn-ghost btn-small"
            to={`/patients/${patientId}/encounters/${encounterId}/hemorrhoid-examination`}
          >
            Khám trĩ
          </Link>
        </div>
      </div>
    );
  }
  if (event.type === 'CLINICAL_FORM_SUBMITTED') {
    // HEMORRHOID_LONGO_FOLLOWUP predates the six Longo templates (CORE-03)
    // and its accepted browser E2E baseline checks this exact wording/
    // Wexner display — kept verbatim rather than switched to the generic
    // wording below, to avoid regressing an accepted baseline.
    if (event.data.templateKey === 'HEMORRHOID_LONGO_FOLLOWUP') {
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
    return (
      <div>
        <strong>Biểu mẫu đã hoàn tất</strong> — {String(event.data.templateKey)}
        {' '}(phiên bản {String(event.data.revisionNumber)})
        {event.data.amendmentReason ? <span> — Sửa: {String(event.data.amendmentReason)}</span> : null}
      </div>
    );
  }
  if (event.type === 'FOLLOW_UP_TASK') {
    return (
      <div>
        <strong>Nhiệm vụ tái khám</strong> —{' '}
        {TIMEPOINT_LABELS[String(event.data.timepointCode)] ?? String(event.data.timepointCode)} —{' '}
        {String(event.data.status)}
      </div>
    );
  }
  if (event.type === 'CARE_PLAN_SIGNED') {
    return (
      <div>
        <strong>Kế hoạch chăm sóc đã ký</strong> (phiên bản {String(event.data.versionNumber)})
        <Link to={`/care-plans/${event.data.carePlanId}`}> — Xem kế hoạch chăm sóc</Link>
      </div>
    );
  }
  if (event.type === 'CARE_TASK') {
    return (
      <div>
        <strong>Nhiệm vụ theo dõi</strong> — {String(event.data.status)}
      </div>
    );
  }
  return null;
}
