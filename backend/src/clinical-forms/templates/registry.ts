import { hemorrhoidTreatmentDecisionV2 } from './hemorrhoid-treatment-decision.v2';
import { ClinicalFormTemplate } from './types';
import { hemorrhoidLongoFollowupV1 } from './hemorrhoid-longo-followup.v1';
import { longoPreopAssessmentV1 } from './longo-preop-assessment.v1';
import { longoIntraopRecordV1 } from './longo-intraop-record.v1';
import { longoEarlyPostopV1 } from './longo-early-postop.v1';
import { longoTwoWeekFollowupV1 } from './longo-two-week-followup.v1';
import { analDilationAssessmentV1 } from './anal-dilation-assessment.v1';
import { longoLongTermFollowupV1 } from './longo-long-term-followup.v1';
import { hemorrhoidExaminationV1 } from './hemorrhoid-examination.v1';
import { hemorrhoidDiagnosisV1 } from './hemorrhoid-diagnosis.v1';
import { hemorrhoidTreatmentDecisionV1 } from './hemorrhoid-treatment-decision.v1';
import { hemorrhoidTreatmentDecisionV3 } from './hemorrhoid-treatment-decision.v3';
import { hemorrhoidFollowUpAssessmentV1 } from './hemorrhoid-follow-up-assessment.v1';
import { hemorrhoidNextClinicalDecisionV1 } from './hemorrhoid-next-clinical-decision.v1';

const TEMPLATES: ClinicalFormTemplate[] = [
  hemorrhoidLongoFollowupV1,
  longoPreopAssessmentV1,
  longoIntraopRecordV1,
  longoEarlyPostopV1,
  longoTwoWeekFollowupV1,
  analDilationAssessmentV1,
  longoLongTermFollowupV1,
  hemorrhoidExaminationV1,
  hemorrhoidDiagnosisV1,
  hemorrhoidTreatmentDecisionV1,
  hemorrhoidTreatmentDecisionV2,
  hemorrhoidTreatmentDecisionV3,
  hemorrhoidFollowUpAssessmentV1,
  hemorrhoidNextClinicalDecisionV1,
];

/**
 * DEC-021 §3.2 / §11 — HEMORRHOID_TREATMENT_DECISION v3 is the machine-
 * readable source consumed *explicitly* by Structured Treatment Activation
 * (and, later, by the Package B Contract rebaseline). Package R is a
 * *selective* rebaseline: it does NOT force-migrate the existing Slice-2
 * Initial-branch create flow (or its tests) onto v3. So v3 is registered
 * (resolvable by explicit (key, version)) but deliberately excluded from the
 * "latest" resolution — a bare `POST /clinical-forms` for
 * HEMORRHOID_TREATMENT_DECISION still yields v2 unless the caller asks for
 * v3 explicitly (`templateVersion: 3`). Historical v1/v2 submissions are
 * untouched.
 */
const EXPLICIT_VERSION_ONLY = new Set<string>(['HEMORRHOID_TREATMENT_DECISION:3']);

/** Latest version per templateKey — new submissions are created against this. */
const LATEST_VERSION_BY_KEY = new Map<string, number>();
for (const t of TEMPLATES) {
  if (EXPLICIT_VERSION_ONLY.has(`${t.templateKey}:${t.version}`)) continue;
  const current = LATEST_VERSION_BY_KEY.get(t.templateKey) ?? 0;
  if (t.version > current) {
    LATEST_VERSION_BY_KEY.set(t.templateKey, t.version);
  }
}

export function getTemplate(
  templateKey: string,
  version: number,
): ClinicalFormTemplate | undefined {
  return TEMPLATES.find(
    (t) => t.templateKey === templateKey && t.version === version,
  );
}

export function getLatestTemplate(
  templateKey: string,
): ClinicalFormTemplate | undefined {
  const version = LATEST_VERSION_BY_KEY.get(templateKey);
  if (version === undefined) return undefined;
  return getTemplate(templateKey, version);
}
