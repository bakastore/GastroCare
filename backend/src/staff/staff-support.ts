import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  EmploymentHistory,
  Prisma,
  StaffCredential,
  StaffCredentialStatus,
  StaffFacilityAssignment,
  StaffProfile,
} from '@prisma/client';

/**
 * Parse a `YYYY-MM-DD` date-only string into a Date pinned to UTC midnight,
 * matching Prisma `@db.Date` semantics. Throws 400 on a malformed value.
 * `undefined` passes through (field not supplied); explicit `null` clears.
 */
export function parseDateOnly(
  value: string | null | undefined,
  field: string,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new BadRequestException(`${field} must be a YYYY-MM-DD date`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Timezone-safe construction matching @db.Date (UTC midnight). JS silently
  // normalizes impossible calendar dates (2026-02-29 -> 2026-03-01), so round-
  // trip the components and require exact equality.
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(d.getTime()) ||
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${field} is not a valid calendar date`);
  }
  return d;
}

/** Format a stored `@db.Date` back to `YYYY-MM-DD` for API responses. */
export function formatDateOnly(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export function assertOrderedDates(
  earlier: Date | null | undefined,
  later: Date | null | undefined,
  message: string,
): void {
  if (earlier && later && later.getTime() < earlier.getTime()) {
    throw new BadRequestException(message);
  }
}

export type EffectiveCredentialStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

/**
 * Effective credential status is DERIVED at read time and never persisted
 * (Contract T3.1): REVOKED > EXPIRED > ACTIVE. A credential is valid through
 * its expiryDate and only becomes EXPIRED from the following day.
 */
export function effectiveCredentialStatus(
  stored: StaffCredentialStatus,
  expiryDate: Date | null,
  now: Date = new Date(),
): EffectiveCredentialStatus {
  if (stored === StaffCredentialStatus.REVOKED) return 'REVOKED';
  if (expiryDate) {
    const today = new Date(
      `${now.toISOString().slice(0, 10)}T00:00:00.000Z`,
    ).getTime();
    if (expiryDate.getTime() < today) return 'EXPIRED';
  }
  return 'ACTIVE';
}

export function toProfileView(profile: StaffProfile) {
  return {
    id: profile.id,
    authUserId: profile.authUserId,
    fullName: profile.fullName,
    professionalTitle: profile.professionalTitle,
    workPhone: profile.workPhone,
    primarySpecialty: profile.primarySpecialty,
    secondarySpecialties: profile.secondarySpecialties,
    specialtyOtherLabel: profile.specialtyOtherLabel,
    biography: profile.biography,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function toCredentialView(c: StaffCredential) {
  return {
    id: c.id,
    staffProfileId: c.staffProfileId,
    credentialType: c.credentialType,
    name: c.name,
    credentialNumber: c.credentialNumber,
    issuingOrganization: c.issuingOrganization,
    issueDate: formatDateOnly(c.issueDate),
    expiryDate: formatDateOnly(c.expiryDate),
    status: c.status,
    effectiveStatus: effectiveCredentialStatus(c.status, c.expiryDate),
    note: c.note,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function toEmploymentView(e: EmploymentHistory) {
  return {
    id: e.id,
    staffProfileId: e.staffProfileId,
    organizationName: e.organizationName,
    department: e.department,
    positionTitle: e.positionTitle,
    startDate: formatDateOnly(e.startDate),
    endDate: formatDateOnly(e.endDate),
    employmentType: e.employmentType,
    note: e.note,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export function toAssignmentView(a: StaffFacilityAssignment) {
  return {
    id: a.id,
    staffProfileId: a.staffProfileId,
    facilityId: a.facilityId,
    isPrimary: a.isPrimary,
    startDate: formatDateOnly(a.startDate),
    endDate: formatDateOnly(a.endDate),
    active: a.endDate === null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

/**
 * Map a PostgreSQL partial-unique-index violation (Prisma P2002) to 409
 * Conflict with reload-and-retry guidance (Contract T4.3). No automatic retry.
 */
export function throwIfAssignmentConflict(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    throw new ConflictException(
      'Facility assignment state changed concurrently — reload and retry',
    );
  }
  throw err as Error;
}

/** Trim a string field; empty-after-trim collapses to null. */
export function trimToNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}
