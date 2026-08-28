import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { careEpisodesApi, encountersApi, followUpTasksApi, patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ApiError } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { formatDate, formatDateTime } from '../lib/format';
import type { CareEpisode, TimelineEvent } from '../types/domain';

// Hemorrhoid Vertical Slice 3 continuous-care loop (DEC-013;
// docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §C). This episode
// type is never started via the generic "+ start episode" flow below (that
// remains Longo-only, DOCTOR manual action) — a HEMORRHOID_TREATMENT episode
// only ever starts as a side effect of the backend-authoritative dedicated
// Return Encounter endpoint (T2), the first time a patient's generic
// Hemorrhoid follow-up CareTask is completed.
const HEMORRHOID_TREATMENT_EPISODE_TYPE = 'HEMORRHOID_TREATMENT';

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

  // Correction batch C5-A — patient-wide Encounter lookup across every
  // Timeline bucket (episode groups + ungrouped). A generic follow-up
  // CareTask can carry a completedByEncounterId that points at a Return
  // Encounter living in a *different* bucket (the task under the ungrouped
  // initial Encounter, the Return Encounter inside the HEMORRHOID_TREATMENT
  // episode). Resolving only within one bucket leaked the raw UUID.
  const encountersById = useMemo(() => {
    const map = new Map<string, { reasonForVisit: string; occurredAt: string }>();
    const timeline = timelineQuery.data;
    if (timeline) {
      const all = [
        ...timeline.episodes.flatMap((g) => g.events),
        ...timeline.ungroupedEncounters,
      ];
      for (const e of all) {
        if (e.type === 'ENCOUNTER') {
          map.set(String(e.data.id), {
            reasonForVisit: String(e.data.reasonForVisit ?? ''),
            occurredAt: String(e.data.occurredAt ?? e.timestamp),
          });
        }
      }
    }
    return map;
  }, [timelineQuery.data]);

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
      {/* Correction batch C4 §5 — neutral heading: this workspace mixes
          Longo episodes, Hemorrhoid continuous-care episodes and ungrouped
          Encounters for one patient, so the static "Đợt điều trị Longo"
          heading was misleading. */}
      <h2>Đợt điều trị / theo dõi</h2>

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
          encountersById={encountersById}
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
          onReloadAll={reloadAll}
        />
      ))}

      {(timelineQuery.data?.ungroupedEncounters.filter((e) => e.type === 'ENCOUNTER').length ?? 0) > 0 && (
        <div className="episode-card">
          <h3>Lượt khám ngoài đợt điều trị</h3>
          <TimelineEventList
            events={timelineQuery.data?.ungroupedEncounters ?? []}
            patientId={patientId}
            episodeType={null}
            episodeStatus={null}
            encountersById={encountersById}
            onReloadAll={reloadAll}
          />
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
  encountersById,
  onReloadAll,
}: {
  episode: CareEpisode;
  patientId: string;
  encountersById: Map<string, { reasonForVisit: string; occurredAt: string }>;
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
  onReloadAll: () => void;
}) {
  const isHemorrhoidContinuousCare = episode.episodeType === HEMORRHOID_TREATMENT_EPISODE_TYPE;
  return (
    <div className="episode-card">
      <h3>
        {isHemorrhoidContinuousCare
          ? 'Đợt theo dõi trĩ (tái khám liên tục)'
          : 'Đợt điều trị Longo'}{' '}
        — bắt đầu {formatDate(episode.startedAt)}{' '}
        {episode.status === 'ACTIVE' ? (
          <span className="badge badge-open">ĐANG ĐIỀU TRỊ</span>
        ) : (
          <span className="badge badge-signed">ĐÃ ĐÓNG</span>
        )}
      </h3>

      {/* Longo Episode manual Encounter + close/reopen (CORE-04 T14 wording,
          unchanged). */}
      {!isHemorrhoidContinuousCare && (
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
      )}

      {/* Correction batch C2 + R2 — Hemorrhoid continuous-care reopen only.
          There is deliberately NO generic Close button on the ACTIVE
          episode header: termination is an explicit decision made on the
          CURRENT Return Encounter *after* its Follow-up Assessment is
          COMPLETED (rendered inline in the Timeline below, R2). Backend
          careEpisodesApi.close/reopen are unchanged and T4-audited. */}
      {isHemorrhoidContinuousCare && episode.status === 'CLOSED' && !isReopening && (
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onStartReopen}>
            Mở lại đợt theo dõi
          </button>
        </div>
      )}

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
            <button
              type="button"
              className="btn btn-primary"
              disabled={isPending || !reopenReason.trim()}
              onClick={onConfirmReopen}
            >
              Xác nhận mở lại
            </button>
          </div>
        </div>
      )}

      <h4>Dòng thời gian trong đợt điều trị</h4>
      <TimelineEventList
        events={events}
        patientId={patientId}
        episodeType={episode.episodeType}
        episodeStatus={episode.status}
        encountersById={encountersById}
        onTerminateEpisode={onClose}
        onReloadAll={onReloadAll}
      />

      {!isHemorrhoidContinuousCare && (
        <>
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
        </>
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

// Hemorrhoid Vertical Slice 3 continuous-care branch (DEC-013 §D-§E, §G;
// docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md). Every Encounter
// inside a HEMORRHOID_TREATMENT episode bucket is a Return Encounter (the
// permanently-ungrouped initial Encounter never has an episodeId) — this
// chain applies to all of them, with no Examination step (Contract §N/§O).
const HEMORRHOID_CONTINUOUS_PREREQ_CHAIN = [
  'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
  'HEMORRHOID_NEXT_CLINICAL_DECISION',
];
const HEMORRHOID_CONTINUOUS_SEQUENCE: { templateKey: string; label: string }[] = [
  { templateKey: 'HEMORRHOID_FOLLOW_UP_ASSESSMENT', label: 'Đánh giá tái khám' },
  { templateKey: 'HEMORRHOID_NEXT_CLINICAL_DECISION', label: 'Quyết định điều trị tiếp theo' },
];

function TimelineEventList({
  events,
  patientId,
  episodeType,
  episodeStatus,
  encountersById,
  onTerminateEpisode,
  onReloadAll,
}: {
  events: TimelineEvent[];
  patientId: string;
  episodeType: string | null;
  episodeStatus?: CareEpisode['status'] | null;
  encountersById?: Map<string, { reasonForVisit: string; occurredAt: string }>;
  onTerminateEpisode?: () => void;
  onReloadAll: () => void;
}) {
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
  // Seed from the patient-wide lookup (C5-A) so a CareTask whose
  // completedByEncounterId points into a different Timeline bucket still
  // resolves to human-readable context; local bucket events below refine it.
  const encounterById = new Map<string, { reasonForVisit: string; occurredAt: string }>(
    encountersById ?? [],
  );
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
  // R2 — the CURRENT/LATEST Return Encounter in this episode bucket (by
  // occurredAt). Only this Encounter may expose the explicit termination
  // action, and only after its own Follow-up Assessment is COMPLETED.
  // Historical Return Encounters never render an actionable Close.
  let latestReturnEncounterId: string | null = null;
  let latestOccurredAt = '';
  for (const e of events) {
    if (e.type === 'ENCOUNTER') {
      const occurredAt = String(e.data.occurredAt ?? e.timestamp);
      if (!latestReturnEncounterId || occurredAt >= latestOccurredAt) {
        latestReturnEncounterId = String(e.data.id);
        latestOccurredAt = occurredAt;
      }
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
            episodeType={episodeType}
            episodeStatus={episodeStatus ?? null}
            isLatestReturnEncounter={
              event.type === 'ENCOUNTER' && String(event.data.id) === latestReturnEncounterId
            }
            onTerminateEpisode={onTerminateEpisode}
            onReloadAll={onReloadAll}
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
  episodeType,
  episodeStatus,
  isLatestReturnEncounter,
  onTerminateEpisode,
  onReloadAll,
}: {
  event: TimelineEvent;
  patientId: string;
  completedByEncounter: Map<string, Set<string>>;
  encounterById: Map<string, { reasonForVisit: string; occurredAt: string }>;
  episodeType: string | null;
  episodeStatus: CareEpisode['status'] | null;
  isLatestReturnEncounter: boolean;
  onTerminateEpisode?: () => void;
  onReloadAll: () => void;
}) {
  if (event.type === 'ENCOUNTER') {
    const encounterId = String(event.data.id);
    const completed = completedByEncounter.get(encounterId) ?? new Set<string>();
    const isHemorrhoidContinuousCare = episodeType === HEMORRHOID_TREATMENT_EPISODE_TYPE;
    // F2 — an Encounter is 1:1 with CarePlan; once one exists (DRAFT or
    // SIGNED) the sequence must offer to view it, never re-offer creation.
    const carePlanId = event.data.carePlanId as string | null;

    if (isHemorrhoidContinuousCare) {
      // Hemorrhoid Slice 3 continuous-care branch (DEC-013 §D-§G): every
      // Encounter here is a Return Encounter — Assessment -> Next Clinical
      // Decision -> optional new CarePlan, never the initial-branch
      // Examination/Diagnosis/Treatment-Decision links or Longo form links.
      const episodeActive = episodeStatus === 'ACTIVE';
      const nextChainIndex = HEMORRHOID_CONTINUOUS_PREREQ_CHAIN.findIndex(
        (key) => !completed.has(key),
      );
      const nextDecisionDone = completed.has('HEMORRHOID_NEXT_CLINICAL_DECISION');
      // Correction batch C3 — once the Follow-up Assessment on THIS Return
      // Encounter is COMPLETED, the doctor explicitly chooses between two
      // paths; neither is inferred from responseSummary. Before that, the
      // termination action is not offered as the next clinical action.
      const assessmentDone = completed.has('HEMORRHOID_FOLLOW_UP_ASSESSMENT');
      return (
        <div>
          <strong>Lượt tái khám</strong> — {String(event.data.reasonForVisit)}
          <div className="row-actions">
            {HEMORRHOID_CONTINUOUS_SEQUENCE.map((step, index) => {
              const isDone = completed.has(step.templateKey);
              const isNext = index === nextChainIndex;
              if (isDone) {
                return (
                  <Link
                    key={step.templateKey}
                    className="btn btn-ghost btn-small"
                    to={`/patients/${patientId}/encounters/${encounterId}/clinical-forms/${step.templateKey}`}
                  >
                    {`${step.label} ✓`}
                  </Link>
                );
              }
              // C3 — after the episode is CLOSED, active-workflow controls
              // must not create a new Next Clinical Decision.
              if (!isNext || !episodeActive) {
                return (
                  <span
                    key={step.templateKey}
                    className="btn btn-ghost btn-small btn-disabled"
                    aria-disabled="true"
                    title={
                      episodeActive
                        ? 'Cần hoàn tất bước trước'
                        : 'Đợt theo dõi đã kết thúc'
                    }
                  >
                    {step.label}
                  </span>
                );
              }
              return (
                <Link
                  key={step.templateKey}
                  className="btn btn-primary btn-small"
                  to={`/patients/${patientId}/encounters/${encounterId}/clinical-forms/${step.templateKey}`}
                >
                  {step.label}
                </Link>
              );
            })}
            {carePlanId ? (
              <Link className="btn btn-ghost btn-small" to={`/care-plans/${carePlanId}`}>
                Xem kế hoạch chăm sóc
              </Link>
            ) : nextDecisionDone && episodeActive ? (
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
                title={
                  episodeActive
                    ? 'Cần hoàn tất Quyết định điều trị tiếp theo'
                    : 'Đợt theo dõi đã kết thúc'
                }
              >
                Tạo kế hoạch chăm sóc
              </span>
            )}
          </div>
          {/* R2 — the explicit termination action lives ONLY on the current
              Return Encounter, and only once its own Follow-up Assessment is
              COMPLETED and the episode is still ACTIVE. Historical Return
              Encounters never render it. Terminating needs neither a Next
              Clinical Decision nor a CarePlan. */}
          {isLatestReturnEncounter && assessmentDone && episodeActive && onTerminateEpisode && (
            <div className="inline-form">
              <p className="form-hint">
                Đánh giá tái khám đã hoàn tất. Bác sĩ chọn tường minh: tiếp tục
                bằng "Quyết định điều trị tiếp theo" ở trên, hoặc kết thúc đợt
                theo dõi. Không bắt buộc phải có Quyết định điều trị tiếp theo
                hay Kế hoạch chăm sóc để kết thúc.
              </p>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={onTerminateEpisode}
                >
                  Kết thúc đợt theo dõi
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Correction batch C4 — functional context separation. A
    // LONGO_TREATMENT episode bucket shows ONLY the six Longo episode forms;
    // the Hemorrhoid initial sequence / legacy follow-up link must not leak
    // in. (Longo's six templates require episodeId != null, so they never
    // apply to an ungrouped Encounter.)
    if (episodeType === 'LONGO_TREATMENT') {
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
          </div>
        </div>
      );
    }

    // Ungrouped Encounter (episodeId === null). DEC-015 resolves the former
    // R3 blocker: the persisted, explicit Encounter.workflowKind is the
    // authoritative discriminator — never reasonForVisit / clinical text /
    // form existence / URL / frontend state.
    const workflowKind = (event.data.workflowKind as string | null) ?? null;

    // C4-C — ungrouped + workflowKind === 'HEMORRHOID_INITIAL': the initial
    // Hemorrhoid sequence only (Khám trĩ -> Chẩn đoán -> Quyết định điều trị
    // -> CarePlan). No Longo forms, no legacy "Phiếu khám lại (cũ)" in the
    // active current-workflow navigation.
    if (workflowKind === 'HEMORRHOID_INITIAL') {
      const nextChainIndex = HEMORRHOID_PREREQ_CHAIN.findIndex(
        (key) => !completed.has(key),
      );
      const treatmentDecisionDone = completed.has('HEMORRHOID_TREATMENT_DECISION');
      return (
        <div>
          <strong>Lượt khám</strong> — {String(event.data.reasonForVisit)}
          <div className="row-actions">
            <Link
              className="btn btn-ghost btn-small"
              to={`/patients/${patientId}/encounters/${encounterId}/hemorrhoid-examination`}
            >
              Khám trĩ
            </Link>
            {HEMORRHOID_SEQUENCE.map((step, index) => {
              const isDone = completed.has(step.templateKey);
              const isNext = index + 1 === nextChainIndex;
              if (!isDone && !isNext) {
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

    // C4-D — generic ungrouped (workflowKind === null): NOT assigned to any
    // specialty workflow. No Hemorrhoid initial chain, no six Longo form
    // buttons, no Hemorrhoid CarePlan sequence, no legacy follow-up link as
    // an active entrypoint. Only a link to view an already-existing CarePlan
    // (created through the generic "Lưu và tạo kế hoạch chăm sóc" flow).
    return (
      <div>
        <strong>Lượt khám</strong> — {String(event.data.reasonForVisit)}
        {carePlanId && (
          <div className="row-actions">
            <Link className="btn btn-ghost btn-small" to={`/care-plans/${carePlanId}`}>
              Xem kế hoạch chăm sóc
            </Link>
          </div>
        )}
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
    // §17) and, for the Slice 3 continuous-care branch,
    // HEMORRHOID_FOLLOW_UP_ASSESSMENT / HEMORRHOID_NEXT_CLINICAL_DECISION
    // (DEC-013 §D-§E) — the backend Timeline projection (F3 data
    // minimization) exposes only this named `summary` field, never the full
    // ClinicalFormSubmission.responses object.
    const SUMMARY_LABEL_BY_TEMPLATE_KEY: Record<string, string> = {
      HEMORRHOID_DIAGNOSIS: 'Chẩn đoán',
      HEMORRHOID_TREATMENT_DECISION: 'Quyết định điều trị',
      HEMORRHOID_FOLLOW_UP_ASSESSMENT: 'Đánh giá tái khám',
      HEMORRHOID_NEXT_CLINICAL_DECISION: 'Quyết định điều trị tiếp theo',
    };
    const summaryLabel = SUMMARY_LABEL_BY_TEMPLATE_KEY[String(event.data.templateKey)];
    if (summaryLabel) {
      const summary = event.data.summary;
      return (
        <div>
          <strong>{summaryLabel}</strong>
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
    const taskId = String(event.data.id);
    const isOpenGenericFollowUp =
      event.data.status === 'OPEN' && event.data.timepointCode == null;
    // C4-E — the dedicated Hemorrhoid Return trigger is only valid when the
    // task authoritatively belongs to the Hemorrhoid workflow: its source
    // Encounter (CareTask -> CarePlan -> Encounter, from the Timeline
    // projection's sourceWorkflowKind) is the initial Hemorrhoid Encounter,
    // OR this CARE_TASK event is inside a HEMORRHOID_TREATMENT episode
    // bucket (the continuous-care flow). Never inferred from text / task
    // title / dueDate / CarePlan instructions.
    const sourceWorkflowKind =
      (event.data.sourceWorkflowKind as string | null) ?? null;
    const isHemorrhoidReturnEligible =
      sourceWorkflowKind === 'HEMORRHOID_INITIAL' ||
      episodeType === HEMORRHOID_TREATMENT_EPISODE_TYPE;
    return (
      <div>
        <strong>Nhiệm vụ theo dõi</strong> — {String(event.data.status)}
        {completedByEncounterId && (
          <p>
            Hoàn thành qua lượt tái khám:{' '}
            {completingEncounter
              ? `${formatDateTime(completingEncounter.occurredAt)}${
                  completingEncounter.reasonForVisit
                    ? ` — ${completingEncounter.reasonForVisit}`
                    : ''
                }`
              : 'một lượt tái khám trước đó'}
          </p>
        )}
        {/* Hemorrhoid Slice 3 T2 (DEC-013 §H): the only way to complete this
            generic follow-up task via a real visit is the dedicated,
            backend-authoritative atomic Return Encounter endpoint — never a
            plain "mark completed" action, and never a client-supplied
            patientId/episodeId. */}
        {isOpenGenericFollowUp && isHemorrhoidReturnEligible && (
          <HemorrhoidReturnEncounterTrigger careTaskId={taskId} onCreated={onReloadAll} />
        )}
      </div>
    );
  }
  return null;
}

/**
 * Inline trigger for `POST /encounters/hemorrhoid-return` (DEC-013 §H;
 * docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §H). Only
 * occurredAt/reasonForVisit are collected here — patientId is derived
 * server-side from the CareTask and episodeId is resolved server-side; this
 * component never sends either.
 */
function HemorrhoidReturnEncounterTrigger({
  careTaskId,
  onCreated,
}: {
  careTaskId: string;
  onCreated: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [occurredAt, setOccurredAt] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await encountersApi.createHemorrhoidReturn({
        careTaskId,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
        reasonForVisit: reasonForVisit.trim() || 'Tái khám',
      });
      setIsOpen(false);
      setOccurredAt('');
      setReasonForVisit('');
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được lượt tái khám.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <div className="form-actions">
        <button type="button" className="btn btn-primary btn-small" onClick={() => setIsOpen(true)}>
          Bắt đầu tái khám
        </button>
      </div>
    );
  }

  return (
    <div className="inline-form">
      {error && <ErrorState message={error} />}
      <label htmlFor={`returnOccurredAt-${careTaskId}`}>Thời điểm tái khám</label>
      <input
        id={`returnOccurredAt-${careTaskId}`}
        type="datetime-local"
        value={occurredAt}
        onChange={(e) => setOccurredAt(e.target.value)}
      />
      <label htmlFor={`returnReason-${careTaskId}`}>Lý do khám</label>
      <input
        id={`returnReason-${careTaskId}`}
        value={reasonForVisit}
        onChange={(e) => setReasonForVisit(e.target.value)}
        placeholder="Tái khám"
      />
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
          Hủy
        </button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={isSubmitting}>
          Xác nhận tái khám
        </button>
      </div>
    </div>
  );
}
