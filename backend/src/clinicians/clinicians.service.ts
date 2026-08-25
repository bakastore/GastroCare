import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthRole, AuthUser } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Resolves and validates the "responsible clinician" concept for the
 * Hemorrhoid Vertical Slice 1 Encounter Context (DEC-010 §B).
 *
 * DEC-010 requires the pilot UI's default clinician ("BS Thái") to be
 * resolved through a legitimate seed/config/lookup mechanism — never a
 * hard-coded raw user id baked into UI/business logic. This service is that
 * mechanism: it looks up a named seed clinician by a stable, configurable
 * identifier (email — `PILOT_DEFAULT_CLINICIAN_EMAIL`).
 *
 * Fail-closed (blocking finding correction): if the configuration is
 * missing, or the configured email does not resolve to a DOCTOR-role
 * AuthUser in the caller's own tenant, resolution FAILS with a clear error.
 * There is intentionally no fallback to a hard-coded synthetic email and no
 * fallback to "earliest-created DOCTOR in the tenant" — either of those
 * would silently assign clinical responsibility to a clinician nobody
 * chose. Synthetic seed/test setups that need a working default must
 * configure `PILOT_DEFAULT_CLINICIAN_EMAIL` explicitly to point at a real
 * seeded DOCTOR in their own tenant.
 */
@Injectable()
export class CliniciansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Resolves the tenant's default pilot clinician (e.g. "BS Thái") when an
   * Encounter Context is created without an explicit responsibleClinicianId
   * (e.g. by a Receptionist). Looked up strictly by the configured email
   * (`PILOT_DEFAULT_CLINICIAN_EMAIL`) scoped to the current tenant.
   *
   * FAIL CLOSED: if the config value is missing, or does not resolve to a
   * DOCTOR-role AuthUser in this tenant (including "exists, but in a
   * different tenant"), this throws rather than silently picking a
   * different clinician. Never falls back to a hard-coded email or to the
   * earliest-created DOCTOR in the tenant.
   */
  async resolveDefaultClinician(tenantId: string): Promise<AuthUser> {
    const configuredEmail = this.config.get<string>(
      'PILOT_DEFAULT_CLINICIAN_EMAIL',
    );
    if (!configuredEmail) {
      throw new NotFoundException(
        'PILOT_DEFAULT_CLINICIAN_EMAIL is not configured — refusing to ' +
          'silently pick a default clinician (fail closed)',
      );
    }

    const byEmail = await this.prisma.authUser.findFirst({
      where: { tenantId, role: AuthRole.DOCTOR, email: configuredEmail },
    });
    if (!byEmail) {
      throw new NotFoundException(
        `Configured default clinician (${configuredEmail}) was not found ` +
          'as a DOCTOR-role account in this tenant — refusing to silently ' +
          'fall back to a different clinician (fail closed)',
      );
    }
    return byEmail;
  }

  /**
   * Validates that `clinicianId` is a DOCTOR-role AuthUser within the same
   * tenant. Used both for explicit responsibleClinicianId assignment and
   * for handover targets — cross-tenant or non-DOCTOR ids are rejected.
   */
  async assertClinicianInTenant(
    tenantId: string,
    clinicianId: string,
  ): Promise<AuthUser> {
    const clinician = await this.prisma.authUser.findFirst({
      where: { id: clinicianId, tenantId, role: AuthRole.DOCTOR },
    });
    if (!clinician) {
      throw new NotFoundException(
        'Clinician not found in this tenant, or is not a DOCTOR-role account',
      );
    }
    return clinician;
  }

  /** Lists selectable DOCTOR-role clinicians for the current tenant. */
  async listClinicians(tenantId: string) {
    const clinicians = await this.prisma.authUser.findMany({
      where: { tenantId, role: AuthRole.DOCTOR },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true },
    });
    return clinicians;
  }
}
