import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clinicalFormsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ApiError } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { formatDateTime } from '../lib/format';
import type {
  ClinicalFieldDef,
  ClinicalFormResponseValue,
  ClinicalFormResponses,
  ClinicalFormSubmission,
  ClinicalFormTemplateDef,
} from '../types/domain';

// Generic renderer for the six Longo template families (CORE-04 T14).
// Field/section/score definitions are NOT duplicated here — they are read
// from GET /clinical-forms/templates/:templateKey (backend code-config,
// see backend/src/clinical-forms/templates), so this page stays correct
// automatically as templates evolve and never risks drifting from the
// OWNER LOCKED field definitions. This is deliberately still "functional,
// not full UI/UX redesign" per the T14 contract scope.
const TEMPLATE_LABELS: Record<string, string> = {
  LONGO_PREOP_ASSESSMENT: 'Đánh giá trước phẫu thuật Longo',
  LONGO_INTRAOP_RECORD: 'Biên bản phẫu thuật Longo',
  LONGO_EARLY_POSTOP: 'Hậu phẫu sớm Longo',
  LONGO_TWO_WEEK_FOLLOWUP: 'Tái khám 2 tuần sau phẫu thuật Longo',
  ANAL_DILATION_ASSESSMENT: 'Đánh giá nong hậu môn',
  LONGO_LONG_TERM_FOLLOWUP: 'Tái khám dài hạn sau phẫu thuật Longo',
  // Hemorrhoid Vertical Slice 2 (DEC-012 §6-7) — reuses this same
  // schema-driven renderer rather than a new page, since both templates are
  // a single required free-text field with no score/coding.
  HEMORRHOID_DIAGNOSIS: 'Chẩn đoán',
  HEMORRHOID_TREATMENT_DECISION: 'Quyết định điều trị',
};

export function LongoClinicalFormPage() {
  const { patientId, encounterId, templateKey } = useParams<{
    patientId: string;
    encounterId: string;
    templateKey: string;
  }>();

  const templateQuery = useApiQuery(
    () => clinicalFormsApi.getTemplate(templateKey as string),
    [templateKey],
  );

  const submissionQuery = useApiQuery(async () => {
    const submissions = await clinicalFormsApi.listByPatient(patientId as string);
    const chain = submissions.filter(
      (s) => s.encounterId === encounterId && s.templateKey === templateKey,
    );
    if (chain.length === 0) return null;
    // Pick the latest revision (the current head of the amendment chain),
    // not just the first chain member found.
    return chain.reduce((latest, s) =>
      s.revisionNumber > latest.revisionNumber ? s : latest,
    );
  }, [patientId, encounterId, templateKey]);

  if (templateQuery.isLoading || submissionQuery.isLoading) return <LoadingState />;
  if (templateQuery.error) return <ErrorState message={templateQuery.error} />;
  if (submissionQuery.error) return <ErrorState message={submissionQuery.error} />;
  const template = templateQuery.data;
  if (!template) return null;

  if (!submissionQuery.data) {
    return (
      <StartForm
        template={template}
        encounterId={encounterId as string}
        patientId={patientId as string}
        onCreated={submissionQuery.reload}
      />
    );
  }

  return (
    <FormEditor
      template={template}
      submission={submissionQuery.data}
      patientId={patientId as string}
      onChanged={submissionQuery.reload}
    />
  );
}

function StartForm({
  template,
  encounterId,
  patientId,
  onCreated,
}: {
  template: ClinicalFormTemplateDef;
  encounterId: string;
  patientId: string;
  onCreated: () => void;
}) {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setIsCreating(true);
    try {
      await clinicalFormsApi.create({
        encounterId,
        templateKey: template.templateKey,
        responses: {},
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được biểu mẫu.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="form-page">
      <h1>{TEMPLATE_LABELS[template.templateKey] ?? template.displayName}</h1>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(`/patients/${patientId}`)}>
          Hủy
        </button>
        <button type="button" className="btn btn-primary" disabled={isCreating} onClick={start}>
          {isCreating ? 'Đang tạo...' : 'Bắt đầu biểu mẫu'}
        </button>
      </div>
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

function FormEditor({
  template,
  submission,
  patientId,
  onChanged,
}: {
  template: ClinicalFormTemplateDef;
  submission: ClinicalFormSubmission;
  patientId: string;
  onChanged: () => void;
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
      setError(err instanceof ApiError ? err.message : 'Không hoàn tất được biểu mẫu.');
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
      setError(err instanceof ApiError ? err.message : 'Không sửa được biểu mẫu.');
    } finally {
      setIsSubmittingAmend(false);
    }
  }

  return (
    <div className="form-page">
      <h1>{TEMPLATE_LABELS[template.templateKey] ?? template.displayName}</h1>
      <p className="page-subtitle">
        Trạng thái:{' '}
        {isCompleted ? (
          <span className="badge badge-signed">Đã hoàn tất (phiên bản {submission.revisionNumber})</span>
        ) : (
          <span className="badge badge-draft">Nháp</span>
        )}
      </p>

      {template.sections.map((section) => (
        <section key={section.key}>
          <h2>{section.label}</h2>
          {section.fields.map((field) => (
            <div key={field.key}>
              <label htmlFor={field.key}>
                {field.label}
                {field.unit ? ` (${field.unit})` : ''}
                {field.required ? ' *' : ''}
              </label>
              <FieldControl
                field={field}
                value={responses[field.key]}
                disabled={isCompleted}
                onChange={(value) => setField(field.key, value)}
              />
            </div>
          ))}
        </section>
      ))}

      {template.scoreInstruments.length > 0 && (
        <section>
          <h2>Điểm tổng hợp</h2>
          {template.scoreInstruments.map((instrument) => (
            <p key={instrument.key} className="form-hint">
              {instrument.label}: {submission.computedScores?.[instrument.key] ?? '—'} /{' '}
              {instrument.maxTotal}
            </p>
          ))}
        </section>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(`/patients/${patientId}`)}>
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
            <button type="button" className="btn btn-ghost" onClick={() => setIsAmending(false)}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmittingAmend}>
              {isSubmittingAmend ? 'Đang lưu...' : 'Lưu phiên bản mới'}
            </button>
          </div>
        </form>
      )}

      {isCompleted && (
        <section>
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
