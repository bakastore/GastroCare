/**
 * Normalization for Patient duplicate-matching SIGNALS only — never used as
 * identity (see docs/04_CORE_DOMAIN_MODEL.md — Patient). Strips diacritics,
 * case, and extra whitespace so Vietnamese name variants (e.g. accented vs
 * unaccented input) still surface as a possible duplicate warning.
 */
export function normalizeFullName(fullName: string): string {
  return fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}
