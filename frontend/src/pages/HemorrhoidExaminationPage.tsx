import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  clinicalFormsApi,
  cliniciansApi,
  encountersApi,
  facilitiesApi,
  patientsApi,
  roomsApi,
} from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ApiError } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { PageHeader } from '../components/PageHeader';
import { formatDateTime } from '../lib/format';
import type {
  ClinicalFieldDef,
  ClinicalFormResponseValue,
  ClinicalFormResponses,
  ClinicalFormSubmission,
  ClinicalFormTemplateDef,
} from '../types/domain';

// HEMORRHOID_EXAMINATION v1 (DEC-010, ChatGPT review Finding 1) — minimum
// usable, functional (not redesigned) UI. Field/section definitions are
// read from GET /clinical-forms/templates/HEMORRHOID_EXAMINATION exactly
// like LongoClinicalFormPage.tsx does for the six Longo templates
// (CORE-04 T14 pattern) — this page intentionally mirrors that same
// StartForm/FormEditor/amend/history structure rather than inventing a new
// one. Kept as its own file (not merged into LongoClinicalFormPage.tsx) so
// this correction cannot regress the already-accepted Longo browser E2E
// baseline. Adds two things the Longo page does not need: vital-sign
// copy-forward prefill on create (DEC-010 §6) and an Encounter Context
// panel (Facility/Room/responsible clinician + handover, DEC-010 §B/§C).
//
// A3-UX-01 (Owner Synthetic Acceptance) — the clinical layout only:
// page-scoped section cards, a label-above field grid, readable
// completed/read-only controls and a header "back to patient record"
// action. No clinical-model / responses / validation / navigation change:
// the same 29 template-driven fields still render from the template query,
// Draft/Completed/amend/version-history behaviour is untouched.
const TEMPLATE_KEY = 'HEMORRHOID_EXAMINATION';

// A textarea or a (multi-)select needs the full grid row to stay readable.
function fieldSpansFullRow(field: ClinicalFieldDef): boolean {
  return field.type === 'textarea' || field.type === 'multi_select';
}

// A3-UX-02 — explicit presentation mapping: the clock-face position
// multi-selects (internal / external / mixed HemorrhoidLocation — the
// established key convention, options = CLOCK_FACE_OPTIONS 1h..12h) render
// as a compact ring of circular toggle buttons instead of a scrolling
// list box. Presentation only — same field key, same multi-select
// semantics, same stored number[] format. No other multi-select is
// affected.
const CLOCK_POSITION_KEY_RE = /HemorrhoidLocation$/;
function isClockPositionField(field: ClinicalFieldDef): boolean {
  return field.type === 'multi_select' && CLOCK_POSITION_KEY_RE.test(field.key);
}

function ClockPositionSelector({
  field,
  value,
  disabled,
  onChange,
}: {
  field: ClinicalFieldDef;
  value: ClinicalFormResponseValue | undefined;
  disabled: boolean;
  onChange: (value: ClinicalFormResponseValue) => void;
}) {
  const selectedKeys = Array.isArray(value) ? value.map(String) : [];

  function toggle(optionValue: number | string) {
    const key = String(optionValue);
    const isSelected = selectedKeys.includes(key);
    // Keep existing order and append new selections at the end — never
    // reorder or normalise the stored array (Finding §7). Map each key
    // back to its declared option value so the stored type (number for
    // clock hours) is preserved exactly as before.
    const nextKeys = isSelected
      ? selectedKeys.filter((k) => k !== key)
      : [...selectedKeys, key];
    const next = nextKeys.map((k) => {
      const option = field.options?.find((o) => String(o.value) === k);
      return option ? option.value : k;
    });
    onChange(next);
  }

  return (
    <div className="clinical-clock" role="group" aria-label={field.label}>
      {(field.options ?? []).map((option) => {
        const isSelected = selectedKeys.includes(String(option.value));
        return (
          <button
            key={String(option.value)}
            type="button"
            className="clock-btn"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => toggle(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function FieldControl({
  field,
  value,
  disabled,
  onChange,
}: {
  field: ClinicalFieldDef;
  value: ClinicalFormResponseValue | undefined;
  disabled: boolean;
  onChange: (value: ClinicalFormResponseValue) => void;
}) {
  const id = field.key;

  if (field.type === 'boolean') {
    return (
      <select
        id={id}
        disabled={disabled}
        value={value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="" disabled>
          Chọn
        </option>
        <option value="true">Có</option>
        <option value="false">Không</option>
      </select>
    );
  }

  if (field.type === 'single_choice') {
    return (
      <select
        id={id}
        disabled={disabled}
        value={value === undefined ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const option = field.options?.find((o) => String(o.value) === raw);
          onChange(option ? option.value : raw);
        }}
      >
        <option value="" disabled>
          Chọn
        </option>
        {(field.options ?? []).map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'multi_select') {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <select
        id={id}
        multiple
        disabled={disabled}
        value={selected}
        onChange={(e) => {
          const chosen = Array.from(e.target.selectedOptions).map((o) => o.value);
          const mapped = chosen
            .map((raw) => field.options?.find((o) => String(o.value) === raw)?.value)
            .filter((v): v is number | string => v !== undefined);
          onChange(mapped);
        }}
      >
        {(field.options ?? []).map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'number') {
    return (
      <input
        id={id}
        type="number"
        min={field.min}
        max={field.max}
        disabled={disabled}
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        id={id}
        rows={3}
        maxLength={field.maxLength}
        disabled={disabled}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      id={id}
      type="text"
      maxLength={field.maxLength}
      disabled={disabled}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function FormField({
  field,
  value,
  disabled,
  onChange,
}: {
  field: ClinicalFieldDef;
  value: ClinicalFormResponseValue | undefined;
  disabled: boolean;
  onChange: (value: ClinicalFormResponseValue) => void;
}) {
  const isClock = isClockPositionField(field);
  return (
    <div
      className={
        fieldSpansFullRow(field) ? 'clinical-field clinical-field--full' : 'clinical-field'
      }
    >
      {isClock ? (
        <span className="clinical-field-label">
          {field.label}
          {field.required ? ' *' : ''}
        </span>
      ) : (
        <label htmlFor={field.key}>
          {field.label}
          {field.unit ? ` (${field.unit})` : ''}
          {field.required ? ' *' : ''}
        </label>
      )}
      {isClock ? (
        <ClockPositionSelector
          field={field}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      ) : (
        <FieldControl field={field} value={value} disabled={disabled} onChange={onChange} />
      )}
    </div>
  );
}

function EncounterContextPanel({ encounterId }: { encounterId: string }) {
  const encounterQuery = useApiQuery(() => encountersApi.getById(encounterId), [encounterId]);
  const cliniciansQuery = useApiQuery(() => cliniciansApi.list(), []);
  const roomQuery = useApiQuery(
    () =>
      encounterQuery.data?.roomId
        ? roomsApi.getById(encounterQuery.data.roomId)
        : Promise.resolve(null),
    [encounterQuery.data?.roomId],
  );
  const facilityQuery = useApiQuery(
    () => (roomQuery.data ? facilitiesApi.getById(roomQuery.data.facilityId) : Promise.resolve(null)),
    [roomQuery.data?.facilityId],
  );

  const [isHandingOver, setIsHandingOver] = useState(false);
  const [newClinicianId, setNewClinicianId] = useState('');
  const [handoverReason, setHandoverReason] = useState('');
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);

  if (encounterQuery.isLoading) return <LoadingState />;
  if (encounterQuery.error) return <ErrorState message={encounterQuery.error} />;
  const encounter = encounterQuery.data;
  if (!encounter) return null;

  const currentClinician = (cliniciansQuery.data ?? []).find(
    (c) => c.id === encounter.responsibleClinicianId,
  );

  async function submitHandover() {
    setHandoverError(null);
    setIsSubmittingHandover(true);
    try {
      await encountersApi.handover(encounter!.id, {
        newClinicianId,
        reason: handoverReason || undefined,
      });
      setIsHandingOver(false);
      setNewClinicianId('');
      setHandoverReason('');
      encounterQuery.reload();
    } catch (err) {
      setHandoverError(
        err instanceof ApiError ? err.message : 'Không đổi được bác sĩ phụ trách.',
      );
    } finally {
      setIsSubmittingHandover(false);
    }
  }

  return (
    <section className="clinical-section">
      <h2>Bối cảnh lượt khám</h2>
      <dl className="identity-summary">
        <dt>Cơ sở</dt>
        <dd>{facilityQuery.data?.name ?? '—'}</dd>
        <dt>Phòng</dt>
        <dd>{roomQuery.data?.name ?? '—'}</dd>
        <dt>Bác sĩ phụ trách</dt>
        <dd>{currentClinician?.email ?? encounter.responsibleClinicianId}</dd>
      </dl>

      {!isHandingOver && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setIsHandingOver(true)}
        >
          Đổi bác sĩ phụ trách (bàn giao)
        </button>
      )}

      {isHandingOver && (
        <div className="inline-form">
          <label htmlFor="newClinicianId">Bác sĩ phụ trách mới</label>
          <select
            id="newClinicianId"
            value={newClinicianId}
            onChange={(e) => setNewClinicianId(e.target.value)}
          >
            <option value="">Chọn bác sĩ</option>
            {(cliniciansQuery.data ?? [])
              .filter((c) => c.id !== encounter.responsibleClinicianId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.email}
                </option>
              ))}
          </select>
          <label htmlFor="handoverReason">Lý do bàn giao (tùy chọn)</label>
          <input
            id="handoverReason"
            value={handoverReason}
            onChange={(e) => setHandoverReason(e.target.value)}
          />
          {handoverError && (
            <p className="form-error" role="alert">
              {handoverError}
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setIsHandingOver(false)}>
              Hủy
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!newClinicianId || isSubmittingHandover}
              onClick={submitHandover}
            >
              {isSubmittingHandover ? 'Đang lưu...' : 'Xác nhận bàn giao'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function HemorrhoidExaminationPage() {
  const { patientId, encounterId } = useParams<{
    patientId: string;
    encounterId: string;
  }>();
  const [formDirty, setFormDirty] = useState(false);

  const patientQuery = useApiQuery(
    () => patientsApi.getById(patientId as string),
    [patientId],
  );
  const submissionQuery = useApiQuery(async () => {
    const submissions = await clinicalFormsApi.listByPatient(patientId as string);
    const chain = submissions.filter(
      (s) => s.encounterId === encounterId && s.templateKey === TEMPLATE_KEY,
    );
    if (chain.length === 0) return null;
    return chain.reduce((latest, s) =>
      s.revisionNumber > latest.revisionNumber ? s : latest,
    );
  }, [patientId, encounterId]);

  // DEC-020 Package B — render/amend an existing submission against the
  // EXACT template version it was captured under (v1 stays v1); a brand-new
  // examination uses the latest version (v2). Never render a v1 submission's
  // stored responses through the v2 field set.
  const submissionTemplateVersion = submissionQuery.data?.templateVersion;
  const templateQuery = useApiQuery(
    () => clinicalFormsApi.getTemplate(TEMPLATE_KEY, submissionTemplateVersion),
    [submissionTemplateVersion],
  );

  if (templateQuery.isLoading || submissionQuery.isLoading) return <LoadingState />;
  if (templateQuery.error) return <ErrorState message={templateQuery.error} />;
  if (submissionQuery.error) return <ErrorState message={submissionQuery.error} />;
  const template = templateQuery.data;
  if (!template) return null;

  const submission = submissionQuery.data;
  const isCompleted = submission?.status === 'COMPLETED';
  const patientName = patientQuery.data?.fullName;

  return (
    <div className="clinical-form-page">
      <PageHeader
        parentLabel="Hồ sơ bệnh nhân"
        parentHref={`/patients/${patientId}?view=clinical`}
        breadcrumb={[
          { label: 'Bệnh nhân', href: '/patients' },
          ...(patientName
            ? [{ label: patientName, href: `/patients/${patientId}?view=clinical` }]
            : []),
          { label: 'Khám trĩ' },
        ]}
        title="Khám trĩ"
        subtitle={patientName}
        status={
          submission &&
          (isCompleted ? (
            <span className="badge badge-signed">
              Đã hoàn tất (phiên bản {submission.revisionNumber})
            </span>
          ) : (
            <span className="badge badge-draft">Nháp</span>
          ))
        }
        guardUnsavedChanges={formDirty}
      />

      <EncounterContextPanel encounterId={encounterId as string} />

      {!submission ? (
        <StartForm
          patientId={patientId as string}
          encounterId={encounterId as string}
          onCreated={submissionQuery.reload}
        />
      ) : (
        <FormEditor
          template={template}
          submission={submission}
          patientId={patientId as string}
          onChanged={submissionQuery.reload}
          onDirtyChange={setFormDirty}
        />
      )}
    </div>
  );
}

function StartForm({
  patientId,
  encounterId,
  onCreated,
}: {
  patientId: string;
  encounterId: string;
  onCreated: () => void;
}) {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DEC-010 §6 — vital-sign copy-forward: look up the latest prior
  // COMPLETED clinical record's vitals so they can be pre-filled (and
  // edited) rather than re-entered. Finding 2 correction — target-aware:
  // pass this Encounter's id so the backend can enforce
  // sourceEncounter.occurredAt < targetEncounter.occurredAt itself; the
  // frontend never computes/decides this clinical ordering.
  const vitalsQuery = useApiQuery(
    () => clinicalFormsApi.getVitalsCopyForward(encounterId),
    [encounterId],
  );

  async function start() {
    setError(null);
    setIsCreating(true);
    try {
      const vitals = vitalsQuery.data?.vitals ?? {};
      await clinicalFormsApi.create({
        encounterId,
        templateKey: TEMPLATE_KEY,
        responses: vitals as ClinicalFormResponses,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được phiếu khám trĩ.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="clinical-section">
      {vitalsQuery.data && (
        <p className="form-hint">
          Đã sao chép sinh hiệu từ lần khám gần nhất đã hoàn tất (
          {formatDateTime(vitalsQuery.data.sourceOccurredAt)}). Có thể chỉnh sửa sau khi bắt
          đầu.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate(`/patients/${patientId}?view=clinical`)}
        >
          Hủy
        </button>
        <button type="button" className="btn btn-primary" disabled={isCreating} onClick={start}>
          {isCreating ? 'Đang tạo...' : 'Bắt đầu phiếu khám trĩ'}
        </button>
      </div>
    </section>
  );
}

function FormEditor({
  template,
  submission,
  patientId,
  onChanged,
  onDirtyChange,
}: {
  template: ClinicalFormTemplateDef;
  submission: ClinicalFormSubmission;
  patientId: string;
  onChanged: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const navigate = useNavigate();
  const isCompleted = submission.status === 'COMPLETED';
  const [responses, setResponses] = useState<ClinicalFormResponses>(submission.responses);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAmending, setIsAmending] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState('');
  const [isSubmittingAmend, setIsSubmittingAmend] = useState(false);

  // Dirty tracking for the unsaved-changes guard (Finding H). A completed
  // form that is NOT in amendment mode is read-only → never "dirty".
  const isDirty =
    (!isCompleted || isAmending) &&
    JSON.stringify(responses) !== JSON.stringify(submission.responses);
  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  const historyQuery = useApiQuery(
    () => (isCompleted ? clinicalFormsApi.getHistory(submission.id) : Promise.resolve(null)),
    [submission.id, isCompleted, submission.revisionNumber],
  );

  function setField(key: string, value: ClinicalFormResponseValue) {
    setResponses((prev) => ({ ...prev, [key]: value }));
  }

  async function saveDraft() {
    setError(null);
    setIsSaving(true);
    try {
      await clinicalFormsApi.updateDraft(submission.id, { responses });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được bản nháp.');
    } finally {
      setIsSaving(false);
    }
  }

  async function completeForm() {
    setError(null);
    setIsCompleting(true);
    try {
      await clinicalFormsApi.updateDraft(submission.id, { responses });
      await clinicalFormsApi.complete(submission.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không hoàn tất được phiếu khám trĩ.');
    } finally {
      setIsCompleting(false);
    }
  }

  async function submitAmendment() {
    setError(null);
    setIsSubmittingAmend(true);
    try {
      await clinicalFormsApi.amend(submission.id, { responses, amendmentReason });
      setIsAmending(false);
      setAmendmentReason('');
      onChanged();
      historyQuery.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không sửa được phiếu khám trĩ.');
    } finally {
      setIsSubmittingAmend(false);
    }
  }

  // Finding 5 correction — a COMPLETED submission is read-only UNLESS the
  // user has explicitly entered amendment mode ("Sửa (tạo phiên bản mới)").
  const fieldsDisabled = isCompleted && !isAmending;

  return (
    <div className={fieldsDisabled ? 'clinical-form-body clinical-readonly' : 'clinical-form-body'}>
      {template.sections.map((section) => (
        <section key={section.key} className="clinical-section">
          <h2>{section.label}</h2>
          <div className="clinical-grid">
            {section.fields.map((field) => (
              <FormField
                key={field.key}
                field={field}
                value={responses[field.key]}
                disabled={fieldsDisabled}
                onChange={(value) => setField(field.key, value)}
              />
            ))}
          </div>
        </section>
      ))}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate(`/patients/${patientId}?view=clinical`)}
        >
          Về hồ sơ bệnh nhân
        </button>
        {!isCompleted && (
          <>
            <button type="button" className="btn btn-ghost" disabled={isSaving} onClick={saveDraft}>
              {isSaving ? 'Đang lưu...' : 'Lưu bản nháp'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isCompleting}
              onClick={completeForm}
            >
              {isCompleting ? 'Đang hoàn tất...' : 'Hoàn tất'}
            </button>
          </>
        )}
        {isCompleted && !isAmending && (
          <button type="button" className="btn btn-ghost" onClick={() => setIsAmending(true)}>
            Sửa (tạo phiên bản mới)
          </button>
        )}
      </div>

      {isCompleted && isAmending && (
        <form
          className="amend-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submitAmendment();
          }}
        >
          <h2>Sửa (Amendment)</h2>
          <label htmlFor="amendmentReason">Lý do sửa</label>
          <input
            id="amendmentReason"
            required
            value={amendmentReason}
            onChange={(e) => setAmendmentReason(e.target.value)}
          />
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                // Discard any unsaved in-progress edits and go back to
                // read-only view of the current head revision.
                setResponses(submission.responses);
                setAmendmentReason('');
                setIsAmending(false);
              }}
            >
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmittingAmend}>
              {isSubmittingAmend ? 'Đang lưu...' : 'Lưu phiên bản mới'}
            </button>
          </div>
        </form>
      )}

      {isCompleted && (
        <section className="clinical-section">
          <h2>Lịch sử phiên bản</h2>
          {historyQuery.isLoading && <LoadingState />}
          {historyQuery.data && historyQuery.data.revisions.length === 0 && (
            <EmptyState message="Chưa có lịch sử." />
          )}
          {historyQuery.data && historyQuery.data.revisions.length > 0 && (
            <ul className="version-history">
              {historyQuery.data.revisions.map((revision) => (
                <li key={revision.id}>
                  <strong>Phiên bản {revision.revisionNumber}</strong> —{' '}
                  {formatDateTime(revision.completedAt ?? revision.createdAt)}
                  {revision.amendmentReason && <span> — Lý do: {revision.amendmentReason}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
