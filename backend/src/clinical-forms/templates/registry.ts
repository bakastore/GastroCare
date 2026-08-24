import { ClinicalFormTemplate } from './types';
import { hemorrhoidLongoFollowupV1 } from './hemorrhoid-longo-followup.v1';
import { longoPreopAssessmentV1 } from './longo-preop-assessment.v1';
import { longoIntraopRecordV1 } from './longo-intraop-record.v1';
import { longoEarlyPostopV1 } from './longo-early-postop.v1';
import { longoTwoWeekFollowupV1 } from './longo-two-week-followup.v1';
import { analDilationAssessmentV1 } from './anal-dilation-assessment.v1';
import { longoLongTermFollowupV1 } from './longo-long-term-followup.v1';
import { hemorrhoidExaminationV1 } from './hemorrhoid-examination.v1';

const TEMPLATES: ClinicalFormTemplate[] = [
  hemorrhoidLongoFollowupV1,
  longoPreopAssessmentV1,
  longoIntraopRecordV1,
  longoEarlyPostopV1,
  longoTwoWeekFollowupV1,
  analDilationAssessmentV1,
  longoLongTermFollowupV1,
  hemorrhoidExaminationV1,
];

/** Latest version per templateKey — new submissions are created against this. */
const LATEST_VERSION_BY_KEY = new Map<string, number>();
for (const t of TEMPLATES) {
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
