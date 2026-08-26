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

// DEC-012 §19 — the Hemorrhoid Slice 2 golden path
// (Examination -> Diagnosis -> Treatment Decision -> CarePlan) is
// backend-authoritative; these buttons only guide sequence, they never
// replace the backend prerequisite check (creating out of order still 400s).
// HEMORRHOID_EXAMINATION is deliberately NOT part of this list — it keeps
// the original, always-visible "Khám trĩ" link below unchanged (accepted
// Slice 1 E2E baseline asserts on that exact, non-checkmarked text).
const HEMORRHOID_PREREQ_CHAIN = [
  'HEMORRHOID_EXAMINATION',
  'HEMORRHOID_DIAGNOSIS',
  'HEMORRHOID_TREATMENT_DECISION',
];
const HEMORRHOID_SEQUENCE: { templateKey: string; label: string }[] = [
  { templateKey: 'HEMORRHOID_DIAGNOSIS', label: 'Chẩn đoán' },
  { templateKey: 'HEMORRHOID_TREATMENT_DECISION', label: 'Quyết định điều trị' },
];

function TimelineEventList({ events, patientId }: { events: TimelineEvent[]; patientId: string }) {
  if (events.length === 0) {
    return <EmptyState message="Chưa có sự kiện." />;
  }
  // Per-Encounter set of COMPLETED templateKeys, derived from this same
  // events list — used only to guide (disable/hide) the next hemorrhoid
  // workflow step; the backend remains the sole authority on sequence.
  const completedByEncounter = new Map<string, Set<string>>();
  // F1 — ENCOUNTER events already present in this same bucket, so an
  // explicit Return Encounter linkage (CareTask.completedByEncounterId) can
  // be resolved to human-readable context without a new API call.
  const encounterById = new Map<string, { reasonForVisit: string; occurredAt: string }>();
  for (const e of events) {
    if (e.type === 'CLINICAL_FORM_SUBMITTED' && e.data.encounterId) {
      const encId = String(e.data.encounterId);
      const set = completedByEncounter.get(encId) ?? new Set<string>();
      set.add(String(e.data.templateKey));
      completedByEncounter.set(encId, set);
    }
    if (e.type === 'ENCOUNTER') {
      encounterById.set(String(e.data.id), {
        reasonForVisit: String(e.data.reasonForVisit ?? ''),
        occurredAt: String(e.data.occurredAt ?? e.timestamp),
      });
    }
  }
  return (
    <ul className="timeline">
      {events.map((event, index) => (
        <li key={`${event.type}-${index}`} className={`timeline-item timeline-${event.type}`}>
          <span className="timeline-time">{formatDateTime(event.timestamp)}</span>
          <EpisodeTimelineEventBody
            event={event}
            patientId={patientId}
            completedByEncounter={completedByEncounter}
            encounterById={encounterById}
          />
        </li>
      ))}
    </ul>
  );
}

function EpisodeTimelineEventBody({
  event,
  patientId,
  completedByEncounter,
  encounterById,
}: {
  event: TimelineEvent;
  patientId: string;
  completedByEncounter: Map<string, Set<string>>;
  encounterById: Map<string, { reasonForVisit: string; occurredAt: string }>;
}) {
  if (event.type === 'ENCOUNTER') {
    const encounterId = String(event.data.id);
    const completed = completedByEncounter.get(encounterId) ?? new Set<string>();
    // Next unblocked step in the Examination -> Diagnosis -> Treatment
    // Decision chain, plus whether CarePlan creation is reachable — guidance
    // only, see HEMORRHOID_SEQUENCE comment above. Index within the full
    // prerequisite chain (Examination included) so Diagnosis only becomes
    // reachable once Examination is COMPLETED.
    const nextChainIndex = HEMORRHOID_PREREQ_CHAIN.findIndex(
      (key) => !completed.has(key),
    );
    const treatmentDecisionDone = completed.has('HEMORRHOID_TREATMENT_DECISION');
    // F2 — an Encounter is 1:1 with CarePlan; once one exists (DRAFT or
    // SIGNED) the sequence must offer to view it, never re-offer creation.
    const carePlanId = event.data.carePlanId as string | null;
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
          {HEMORRHOID_SEQUENCE.map((step, index) => {
            const isDone = completed.has(step.templateKey);
            // This step's position in the full prerequisite chain (offset by
            // 1 since Examination — chain[0] — is rendered separately above).
            const isNext = index + 1 === nextChainIndex;
            if (!isDone && !isNext) {
              // Not reachable yet — show as a disabled hint rather than a
              // dead link, so the sequence chain stays visible end-to-end.
              return (
                <span
                  key={step.templateKey}
                  className="btn btn-ghost btn-small btn-disabled"
                  aria-disabled="true"
                  title="Cần hoàn tất bước trước"
                >
                  {step.label}
                </span>
              );
            }
            return (
              <Link
                key={step.templateKey}
                className={
                  isDone ? 'btn btn-ghost btn-small' : 'btn btn-primary btn-small'
                }
                to={`/patients/${patientId}/encounters/${encounterId}/clinical-forms/${step.templateKey}`}
              >
                {isDone ? `${step.label} ✓` : step.label}
              </Link>
            );
          })}
          {carePlanId ? (
            <Link className="btn btn-ghost btn-small" to={`/care-plans/${carePlanId}`}>
              Xem kế hoạch chăm sóc
            </Link>
          ) : treatmentDecisionDone ? (
            <Link
              className="btn btn-primary btn-small"
              to={`/patients/${patientId}/care-plan/new?encounterId=${encounterId}`}
            >
              Tạo kế hoạch chăm sóc
            </Link>
          ) : (
            <span
              className="btn btn-ghost btn-small btn-disabled"
              aria-disabled="true"
              title="Cần hoàn tất Quyết định điều trị"
            >
              Tạo kế hoạch chăm sóc
            </span>
          )}
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
    // HEMORRHOID_DIAGNOSIS / HEMORRHOID_TREATMENT_DECISION (DEC-012 §6-7,
    // §17) — the backend Timeline projection (F3 data minimization) exposes
    // only this named `summary` field, never the full
    // ClinicalFormSubmission.responses object.
    if (
      event.data.templateKey === 'HEMORRHOID_DIAGNOSIS' ||
      event.data.templateKey === 'HEMORRHOID_TREATMENT_DECISION'
    ) {
      const isDiagnosis = event.data.templateKey === 'HEMORRHOID_DIAGNOSIS';
      const summary = event.data.summary;
      return (
        <div>
          <strong>{isDiagnosis ? 'Chẩn đoán' : 'Quyết định điều trị'}</strong>
          {' '}(phiên bản {String(event.data.revisionNumber)})
          {summary ? <p>{String(summary)}</p> : null}
          {event.data.amendmentReason ? <span> — Sửa: {String(event.data.amendmentReason)}</span> : null}
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
    // F1 — explicit Return Encounter linkage (DEC-012 §16): once
    // completedByEncounterId is set, show which Encounter closed this task,
    // resolved from the ENCOUNTER events already in this same Timeline
    // bucket — never inferred by date/time.
    const completedByEncounterId = event.data.completedByEncounterId as string | null;
    const completingEncounter = completedByEncounterId
      ? encounterById.get(completedByEncounterId)
      : undefined;
    return (
      <div>
        <strong>Nhiệm vụ theo dõi</strong> — {String(event.data.status)}
        {completedByEncounterId && (
          <p>
            Hoàn thành qua lượt tái khám:{' '}
            {completingEncounter
              ? `${formatDateTime(completingEncounter.occurredAt)} — ${completingEncounter.reasonForVisit}`
              : completedByEncounterId}
          </p>
        )}
      </div>
    );
  }
  return null;
}
