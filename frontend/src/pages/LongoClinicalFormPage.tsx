import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clinicalFormsApi, patientsApi } from '../api/resources';
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
  // schema-driven renderer. DEC016 adds multimodal Treatment Decision v2;
  // existing v1 submissions keep their original definition.
  HEMORRHOID_DIAGNOSIS: 'Chẩn đoán',
  HEMORRHOID_TREATMENT_DECISION: 'Quyết định điều trị',
  // Hemorrhoid Vertical Slice 3 continuous-care loop (DEC-013 §D-§E) — same
  // schema-driven renderer, single required free-text field each.
  HEMORRHOID_FOLLOW_UP_ASSESSMENT: 'Đánh giá tái khám',
  HEMORRHOID_NEXT_CLINICAL_DECISION: 'Quyết định điều trị tiếp theo',
};

// Longo pathway forms return to the Case; the Slice-2/3 Hemorrhoid forms
// return to the patient record. Clinician-facing labels either way.
const LONGO_PATHWAY_TEMPLATES = new Set([
  'LONGO_PREOP_ASSESSMENT',
  'LONGO_INTRAOP_RECORD',
  'LONGO_EARLY_POSTOP',
  'LONGO_TWO_WEEK_FOLLOWUP',
  'ANAL_DILATION_ASSESSMENT',
  'LONGO_LONG_TERM_FOLLOWUP',
]);

function ClinicalFormHeader({
  templateKey,
  patientId,
  patientName,
  status,
  guardUnsavedChanges,
}: {
  templateKey: string;
  patientId: string;
  patientName?: string;
  status?: React.ReactNode;
  guardUnsavedChanges?: boolean;
}) {
  const toCase = LONGO_PATHWAY_TEMPLATES.has(templateKey);
  const title = TEMPLATE_LABELS[templateKey] ?? templateKey;
  return (
    <PageHeader
      parentLabel={toCase ? 'Đợt điều trị' : 'Hồ sơ bệnh nhân'}
      parentHref={
        toCase
          ? `/patients/${patientId}?tab=${encodeURIComponent('Điều trị')}#case-workspace`
          : `/patients/${patientId}`
      }
      breadcrumb={[
        { label: 'Bệnh nhân', href: '/patients' },
        ...(patientName ? [{ label: patientName, href: `/patients/${patientId}` }] : []),
        { label: title },
      ]}
      title={title}
      subtitle={patientName}
      status={status}
      guardUnsavedChanges={guardUnsavedChanges}
    />
  );
}

export function LongoClinicalFormPage() {
  const { patientId, encounterId, templateKey } = useParams<{
    patientId: string;
    encounterId: string;
    templateKey: string;
  }>();
  const patientQuery = useApiQuery(
    () => patientsApi.getById(patientId as string),
    [patientId],
  );
  const patientName = patientQuery.data?.fullName;

  const submissionQuery = useApiQuery(async () => {
    const submissions = await clinicalFormsApi.listByPatient(patientId as string);
    const chain = submissions.filter(
      (s) => s.encounterId === encounterId && s.templateKey === templateKey,
    );
    if (chain.length === 0) return null;
    // Pick the latest revision (the current head of the amendment chain),
    // not just the first chain member found.
    return chain.reduce((latest, s) => (s.revisionNumber > latest.revisionNumber ? s : latest));
  }, [patientId, encounterId, templateKey]);

  const templateQuery = useApiQuery(
    () =>
      clinicalFormsApi.getTemplate(templateKey as string, submissionQuery.data?.templateVersion),
    [templateKey, submissionQuery.data?.templateVersion],
  );

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
        patientName={patientName}
        onCreated={submissionQuery.reload}
      />
    );
  }

  return (
    <FormEditor
      key={submissionQuery.data.id}
      template={template}
      submission={submissionQuery.data}
      patientId={patientId as string}
      patientName={patientName}
      onChanged={submissionQuery.reload}
    />
  );
}

function StartForm({
  template,
  encounterId,
  patientId,
  patientName,
  onCreated,
}: {
  template: ClinicalFormTemplateDef;
  encounterId: string;
  patientId: string;
  patientName?: string;
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
    <div className="clinical-form-page">
      <ClinicalFormHeader
        templateKey={template.templateKey}
        patientId={patientId}
        patientName={patientName}
      />
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
  patientName,
  onChanged,
}: {
  template: ClinicalFormTemplateDef;
  submission: ClinicalFormSubmission;
  patientId: string;
  patientName?: string;
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

  const isDirty =
    (!isCompleted || isAmending) &&
    JSON.stringify(responses) !== JSON.stringify(submission.responses);

  const historyQuery = useApiQuery(
    () => (isCompleted ? clinicalFormsApi.getHistory(submission.id) : Promise.resolve(null)),
    [submission.id, isCompleted, submission.revisionNumber],
  );

  function setField(key: string, value: ClinicalFormResponseValue) {
    setResponses((prev) => {
      const next = { ...prev, [key]: value };
      if (
        template.templateKey === 'HEMORRHOID_TREATMENT_DECISION' &&
        template.version === 2 &&
        key === 'treatmentModalities' &&
        Array.isArray(value)
      ) {
        if (!value.includes('MEDICAL')) delete next.medicalCareSetting;
        if (!value.includes('PROCEDURE')) delete next.procedureCareSetting;
        if (!value.includes('SURGERY')) delete next.surgeryCareSetting;
        else next.surgeryCareSetting = 'HOSPITAL';
      }
      return next;
    });
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
      await clinicalFormsApi.amend(submission.id, {
        responses,
        amendmentReason,
      });
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
    <div className="clinical-form-page">
      <ClinicalFormHeader
        templateKey={template.templateKey}
        patientId={patientId}
        patientName={patientName}
        guardUnsavedChanges={isDirty}
        status={
          isCompleted ? (
            <span className="badge badge-signed">
              Đã hoàn tất (phiên bản {submission.revisionNumber})
            </span>
          ) : (
            <span className="badge badge-draft">Nháp</span>
          )
        }
      />

      {template.sections.map((section) => (
        <section key={section.key}>
          <h2>{section.label}</h2>
          {section.fields
            .filter((field) => {
              if (
                template.templateKey !== 'HEMORRHOID_TREATMENT_DECISION' ||
                template.version !== 2
              )
                return true;
              const modality = (
                {
                  medicalCareSetting: 'MEDICAL',
                  procedureCareSetting: 'PROCEDURE',
                  surgeryCareSetting: 'SURGERY',
                } as Record<string, string>
              )[field.key];
              return (
                !modality ||
                (Array.isArray(responses.treatmentModalities) &&
                  responses.treatmentModalities.includes(modality))
              );
            })
            .map((field) => (
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
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate(`/patients/${patientId}`)}
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
