import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StaffFacilityAssignment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../auth/current-user.decorator';
import { StaffAccessService } from './staff-access.service';
import {
  CreateFacilityAssignmentDto,
  PatchFacilityAssignmentDto,
} from './dto/facility-assignment.dto';
import { STAFF_FACILITY_ASSIGNMENT_ENTITY } from './staff.constants';
import {
  assertOrderedDates,
  parseDateOnly,
  throwIfAssignmentConflict,
  toAssignmentView,
} from './staff-support';

/**
 * DEC-019 T4 — Facility assignment lifecycle.
 *
 * INVARIANT (DEC-019 §7.2): if a StaffProfile has any active assignment
 * (endDate IS NULL), exactly ONE active assignment must be primary.
 *
 * The two PostgreSQL PARTIAL UNIQUE INDEXES enforce only "at most one active
 * primary" / "at most one active assignment per (profile, facility)"; they
 * cannot enforce "at least one primary while active assignments exist". So
 * EVERY mutation that can affect the invariant (create / make-primary / end)
 * runs the SAME protocol inside ONE Read-Committed transaction:
 *
 *   1. `SELECT ... FROM staff_profiles WHERE id = ? AND "tenantId" = ? FOR UPDATE`
 *      — a single serialization point per StaffProfile; concurrent mutations
 *      for the same profile queue behind this row lock.
 *   2. re-read authoritative assignment state INSIDE the transaction.
 *   3. validate against that in-transaction state.
 *   4. mutate with active-state-aware / conditional writes.
 *   5. if the expected state changed and the mutation is no longer valid,
 *      throw 409 Conflict (no automatic retry).
 *   6. write AuditEvent only on a committed mutation.
 *
 * No SERIALIZABLE, no automatic retry, no generic locking framework. A
 * partial-index violation / Prisma P2002 is still mapped to 409 as the final
 * backstop. Locked write order is preserved: demote/end the outgoing primary
 * FIRST, then promote the incoming one; changing primary never ends the old
 * assignment.
 */
@Injectable()
export class StaffFacilityAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: StaffAccessService,
  ) {}

  async list(tenantId: string, userId: string) {
    const profile = await this.access.getProfileOrThrow(tenantId, userId);
    const rows = await this.prisma.staffFacilityAssignment.findMany({
      where: { tenantId, staffProfileId: profile.id },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toAssignmentView);
  }

  private async findChildOrThrow(
    tenantId: string,
    staffProfileId: string,
    assignmentId: string,
  ): Promise<StaffFacilityAssignment> {
    const row = await this.prisma.staffFacilityAssignment.findFirst({
      where: { id: assignmentId, tenantId, staffProfileId },
    });
    if (!row) throw new NotFoundException('Facility assignment not found');
    return row;
  }

  /**
   * Acquire the per-StaffProfile serialization lock inside `tx`. Every
   * invariant-affecting mutation calls this FIRST, before re-reading state.
   */
  private async lockProfile(
    tx: Prisma.TransactionClient,
    tenantId: string,
    staffProfileId: string,
  ): Promise<void> {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM staff_profiles
      WHERE id = ${staffProfileId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new NotFoundException('Staff profile not found');
    }
  }

  private activeAssignments(
    tx: Prisma.TransactionClient,
    tenantId: string,
    staffProfileId: string,
  ): Promise<StaffFacilityAssignment[]> {
    return tx.staffFacilityAssignment.findMany({
      where: { tenantId, staffProfileId, endDate: null },
    });
  }

  async create(
    actor: AuthenticatedUser,
    userId: string,
    dto: CreateFacilityAssignmentDto,
  ) {
    const profile = await this.access.getProfileOrThrow(actor.tenantId, userId);

    // Proves StaffProfile.tenantId == Facility.tenantId == actor.tenantId.
    const facility = await this.prisma.facility.findFirst({
      where: { id: dto.facilityId, tenantId: actor.tenantId },
    });
    if (!facility) throw new NotFoundException('Facility not found');

    const startDate = parseDateOnly(dto.startDate, 'startDate');
    if (!startDate) throw new BadRequestException('startDate is required');

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await this.lockProfile(tx, actor.tenantId, profile.id);

        // Authoritative in-transaction state.
        const active = await this.activeAssignments(
          tx,
          actor.tenantId,
          profile.id,
        );
        const isFirstActive = active.length === 0;
        const wantPrimary = isFirstActive || dto.makePrimary === true;

        let demotedPriorPrimary = false;
        if (wantPrimary && !isFirstActive) {
          const demote = await tx.staffFacilityAssignment.updateMany({
            where: {
              tenantId: actor.tenantId,
              staffProfileId: profile.id,
              endDate: null,
              isPrimary: true,
            },
            data: { isPrimary: false },
          });
          demotedPriorPrimary = demote.count > 0;
        }

        const row = await tx.staffFacilityAssignment.create({
          data: {
            tenantId: actor.tenantId,
            staffProfileId: profile.id,
            facilityId: facility.id,
            isPrimary: wantPrimary,
            startDate,
          },
        });

        await this.audit.record(
          {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            action: 'FACILITY_ASSIGNMENT_ADDED',
            entityType: STAFF_FACILITY_ASSIGNMENT_ENTITY,
            entityId: row.id,
            metadata: {
              targetUserId: userId,
              staffProfileId: profile.id,
              assignmentId: row.id,
              facilityId: facility.id,
              isPrimary: row.isPrimary,
            },
          },
          tx,
        );
        if (demotedPriorPrimary) {
          await this.audit.record(
            {
              tenantId: actor.tenantId,
              actorId: actor.userId,
              action: 'FACILITY_ASSIGNMENT_PRIMARY_CHANGED',
              entityType: STAFF_FACILITY_ASSIGNMENT_ENTITY,
              entityId: row.id,
              metadata: {
                targetUserId: userId,
                staffProfileId: profile.id,
                newPrimaryAssignmentId: row.id,
                facilityId: facility.id,
              },
            },
            tx,
          );
        }
        return row;
      });
      return toAssignmentView(created);
    } catch (err) {
      throwIfAssignmentConflict(err);
    }
  }

  async patch(
    actor: AuthenticatedUser,
    userId: string,
    assignmentId: string,
    dto: PatchFacilityAssignmentDto,
  ) {
    const profile = await this.access.getProfileOrThrow(actor.tenantId, userId);
    // Pre-check for a clean 404 non-leak; authoritative re-read happens in-tx.
    const pre = await this.findChildOrThrow(
      actor.tenantId,
      profile.id,
      assignmentId,
    );

    const wantsPrimary = dto.makePrimary === true;
    const wantsEnd = dto.end === true;
    if (wantsPrimary === wantsEnd) {
      throw new BadRequestException(
        'Provide exactly one intent: makePrimary or end',
      );
    }

    // Deterministically invalid request (already ended before this call, not a
    // race): an ended assignment can never be reopened or made primary.
    if (wantsPrimary && pre.endDate !== null) {
      throw new BadRequestException(
        'An ended assignment cannot be made primary',
      );
    }

    if (wantsPrimary) {
      return this.makePrimary(actor, userId, profile.id, assignmentId);
    }

    // Whether a replacement was ALREADY required based on the state observed
    // when the request began (pre `FOR UPDATE`). Used to tell a deterministic
    // "you must supply a replacement" (400) apart from a replacement that
    // became required only because state changed while we waited for the lock
    // (409).
    const preOtherActive =
      pre.endDate === null && pre.isPrimary
        ? await this.prisma.staffFacilityAssignment.count({
            where: {
              tenantId: actor.tenantId,
              staffProfileId: profile.id,
              endDate: null,
              id: { not: assignmentId },
            },
          })
        : 0;
    const preNeedsReplacement =
      pre.endDate === null && pre.isPrimary && preOtherActive > 0;

    return this.end(
      actor,
      userId,
      profile.id,
      assignmentId,
      dto,
      preNeedsReplacement,
    );
  }

  private async makePrimary(
    actor: AuthenticatedUser,
    userId: string,
    staffProfileId: string,
    assignmentId: string,
  ) {
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.lockProfile(tx, actor.tenantId, staffProfileId);

        const current = await tx.staffFacilityAssignment.findFirst({
          where: { id: assignmentId, tenantId: actor.tenantId, staffProfileId },
        });
        if (!current) {
          throw new NotFoundException('Facility assignment not found');
        }
        if (current.endDate !== null) {
          // State changed under us (concurrently ended) — not retriable here.
          throw new ConflictException(
            'Assignment is no longer active — reload and retry',
          );
        }
        if (current.isPrimary) return current;

        // 1. DEMOTE the current active primary FIRST (endDate untouched).
        await tx.staffFacilityAssignment.updateMany({
          where: {
            tenantId: actor.tenantId,
            staffProfileId,
            endDate: null,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
        // 2. PROMOTE the target (still active, re-checked above).
        const row = await tx.staffFacilityAssignment.update({
          where: { id: current.id },
          data: { isPrimary: true },
        });
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            action: 'FACILITY_ASSIGNMENT_PRIMARY_CHANGED',
            entityType: STAFF_FACILITY_ASSIGNMENT_ENTITY,
            entityId: row.id,
            metadata: {
              targetUserId: userId,
              staffProfileId,
              newPrimaryAssignmentId: row.id,
              facilityId: row.facilityId,
            },
          },
          tx,
        );
        return row;
      });
      return toAssignmentView(updated);
    } catch (err) {
      throwIfAssignmentConflict(err);
    }
  }

  private async end(
    actor: AuthenticatedUser,
    userId: string,
    staffProfileId: string,
    assignmentId: string,
    dto: PatchFacilityAssignmentDto,
    preNeedsReplacement: boolean,
  ) {
    const requestedEnd = parseDateOnly(dto.endDate, 'endDate');

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.lockProfile(tx, actor.tenantId, staffProfileId);

        const current = await tx.staffFacilityAssignment.findFirst({
          where: { id: assignmentId, tenantId: actor.tenantId, staffProfileId },
        });
        if (!current) {
          throw new NotFoundException('Facility assignment not found');
        }
        if (current.endDate !== null) {
          throw new ConflictException('Assignment is already ended');
        }

        const endDate = requestedEnd ?? new Date(dateOnlyToday());
        assertOrderedDates(
          current.startDate,
          endDate,
          'endDate must be on or after the assignment startDate',
        );

        const otherActive = (
          await this.activeAssignments(tx, actor.tenantId, staffProfileId)
        ).filter((a) => a.id !== current.id);

        const needsReplacement =
          current.isPrimary && otherActive.length > 0;
        let replacement: StaffFacilityAssignment | undefined;

        // 1. If a replacement was explicitly supplied, it must resolve to an
        //    active sibling of this profile — regardless of whether one is
        //    strictly required now. A supplied id that no longer resolves is a
        //    bogus id (deterministic 400) unless it names a real assignment of
        //    this profile that has since become inactive (concurrent → 409).
        if (dto.replacementPrimaryAssignmentId) {
          replacement = otherActive.find(
            (a) => a.id === dto.replacementPrimaryAssignmentId,
          );
          if (!replacement) {
            const known = await tx.staffFacilityAssignment.findFirst({
              where: {
                id: dto.replacementPrimaryAssignmentId,
                tenantId: actor.tenantId,
                staffProfileId,
              },
            });
            if (known) {
              throw new ConflictException(
                'The chosen replacement primary is no longer active — reload and retry',
              );
            }
            throw new BadRequestException(
              'replacementPrimaryAssignmentId must reference another active assignment for this profile',
            );
          }
        }

        // 2. If a replacement is required but none was supplied: deterministic
        //    400 when it was required from the outset, 409 when the requirement
        //    only appeared because state changed while we waited for the lock
        //    (target promoted concurrently, sibling created concurrently, ...).
        if (needsReplacement && !replacement) {
          if (preNeedsReplacement) {
            throw new BadRequestException(
              'replacementPrimaryAssignmentId is required when ending the primary assignment while other active assignments remain',
            );
          }
          throw new ConflictException(
            'Assignment state changed concurrently — reload and choose a replacement primary',
          );
        }

        // 3. Only promote a supplied replacement when the assignment being
        //    ended is actually the active primary (nothing to hand over
        //    otherwise).
        if (replacement && !current.isPrimary) {
          replacement = undefined;
        }

        // 1. END the outgoing assignment FIRST so it leaves the active-primary
        //    partial unique index.
        const row = await tx.staffFacilityAssignment.update({
          where: { id: current.id },
          data: { endDate },
        });
        await this.audit.record(
          {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            action: 'FACILITY_ASSIGNMENT_ENDED',
            entityType: STAFF_FACILITY_ASSIGNMENT_ENTITY,
            entityId: row.id,
            metadata: {
              targetUserId: userId,
              staffProfileId,
              assignmentId: row.id,
              facilityId: row.facilityId,
            },
          },
          tx,
        );

        // 2. Only then promote the explicit replacement.
        if (replacement) {
          const promoted = await tx.staffFacilityAssignment.update({
            where: { id: replacement.id },
            data: { isPrimary: true },
          });
          await this.audit.record(
            {
              tenantId: actor.tenantId,
              actorId: actor.userId,
              action: 'FACILITY_ASSIGNMENT_PRIMARY_CHANGED',
              entityType: STAFF_FACILITY_ASSIGNMENT_ENTITY,
              entityId: promoted.id,
              metadata: {
                targetUserId: userId,
                staffProfileId,
                newPrimaryAssignmentId: promoted.id,
                facilityId: promoted.facilityId,
              },
            },
            tx,
          );
        }
        return row;
      });
      return toAssignmentView(updated);
    } catch (err) {
      throwIfAssignmentConflict(err);
    }
  }
}

function dateOnlyToday(): string {
  return `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
}
