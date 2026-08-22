import { ClinicalFormTemplate } from './types';
import { hemorrhoidLongoFollowupV1 } from './hemorrhoid-longo-followup.v1';

const TEMPLATES: ClinicalFormTemplate[] = [hemorrhoidLongoFollowupV1];

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
