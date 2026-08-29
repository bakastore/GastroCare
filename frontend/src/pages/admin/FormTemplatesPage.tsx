import { clinicalFormsApi } from '../../api/resources';
import { useApiQuery } from '../../api/useApiQuery';
import { ErrorState, LoadingState } from '../../components/AsyncStates';
import { PageHeader } from '../../components/PageHeader';
import type { ClinicalFormTemplateDef } from '../../types/domain';

// DEMO UI — view-only. There is no "list templates" API; the set of
// templateKeys is a fixed, code-owned catalogue (backend
// clinical-forms/templates/registry.ts). Each row is fetched from the real
// GET /clinical-forms/templates/:key endpoint. No template builder, no edit.
const TEMPLATE_KEYS = [
  'HEMORRHOID_EXAMINATION',
  'HEMORRHOID_DIAGNOSIS',
  'HEMORRHOID_TREATMENT_DECISION',
  'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
  'HEMORRHOID_NEXT_CLINICAL_DECISION',
  'HEMORRHOID_LONGO_FOLLOWUP',
  'LONGO_PREOP_ASSESSMENT',
  'LONGO_INTRAOP_RECORD',
  'LONGO_EARLY_POSTOP',
  'LONGO_TWO_WEEK_FOLLOWUP',
  'ANAL_DILATION_ASSESSMENT',
  'LONGO_LONG_TERM_FOLLOWUP',
];

export function FormTemplatesPage() {
  const query = useApiQuery(async () => {
    const results = await Promise.all(
      TEMPLATE_KEYS.map((key) =>
        clinicalFormsApi
          .getTemplate(key)
          .then((tpl) => ({ key, tpl }))
          .catch(() => ({ key, tpl: null as ClinicalFormTemplateDef | null })),
      ),
    );
    return results;
  }, []);

  return (
    <div>
      <PageHeader
        title="Mẫu biểu"
        subtitle="Danh mục mẫu biểu lâm sàng (chỉ xem — định nghĩa nằm trong mã nguồn, không chỉnh sửa qua giao diện)."
      />

      {query.isLoading && <LoadingState />}
      {query.error && <ErrorState message={query.error} />}
      {!query.isLoading && !query.error && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên hiển thị</th>
                <th>Phiên bản</th>
                <th>Số mục</th>
                <th>Số trường</th>
              </tr>
            </thead>
            <tbody>
              {(query.data ?? []).map(({ key, tpl }) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{tpl?.displayName ?? '—'}</td>
                  <td>{tpl?.version ?? '—'}</td>
                  <td>{tpl ? tpl.sections.length : '—'}</td>
                  <td>
                    {tpl
                      ? tpl.sections.reduce((n, s) => n + s.fields.length, 0)
                      : '—'}
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
