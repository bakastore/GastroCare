import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CarePlanStatus, CareTask } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCarePlanDto } from './dto/create-care-plan.dto';
import { UpdateDraftCarePlanDto } from './dto/update-draft-care-plan.dto';
import { AmendCarePlanDto } from './dto/amend-care-plan.dto';

/**
 * CarePlan lifecycle: DRAFT (mutable) -> SIGNED (immutable content, snapshot
 * in CarePlanVersion) -> amend (new CarePlanVersion, lineage preserved).
 * See docs/04_CORE_DOMAIN_MODEL.md — CarePlan and
 * docs/05_ARCHITECTURE_BASELINE.md — "Signed-record immutability".
 */
@Injectable()
export class CarePlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async findRootOrThrow(tenantId: string, carePlanId: string) {
    const carePlan = await this.prisma.carePlan.findFirst({
      where: { id: carePlanId, tenantId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });
    if (!carePlan) {
      throw new NotFoundException('CarePlan not found');
    }
    return carePlan;
  }

  async create(tenantId: string, actorId: string, dto: CreateCarePlanDto) {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: dto.encounterId, tenantId },
    });
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    const existing = await this.prisma.carePlan.findUnique({
      where: { encounterId: dto.encounterId },
    });
    if (existing) {
      throw new ConflictException(
        'A CarePlan already exists for this Encounter',
      );
    }

    const carePlan = await this.prisma.carePlan.create({
      data: {
        tenantId,
        encounterId: dto.encounterId,
        patientId: encounter.patientId,
        instructions: dto.instructions,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        status: CarePlanStatus.DRAFT,
      },
    });

    return carePlan;
  }

  async updateDraft(
    tenantId: string,
    carePlanId: string,
    dto: UpdateDraftCarePlanDto,
  ) {
    const carePlan = await this.findRootOrThrow(tenantId, carePlanId);
    if (carePlan.status !== CarePlanStatus.DRAFT) {
      throw new ConflictException(
        'CarePlan is already SIGNED — a DRAFT can only be edited before signing',
      );
    }

    return this.prisma.carePlan.update({
      where: { id: carePlanId },
      data: {
        instructions: dto.instructions ?? undefined,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
      },
    });
  }

  /**
   * DRAFT -> SIGNED. Snapshots current root content into CarePlanVersion 1
   * (append-only, never updated afterward). If followUpDate is present, a
   * CareTask is created deterministically — normal software automation, not
   * AI (CORE-01 section 9).
   */
  async sign(tenantId: string, actorId: string, carePlanId: string) {
    const carePlan = await this.findRootOrThrow(tenantId, carePlanId);
    if (carePlan.status !== CarePlanStatus.DRAFT) {
      throw new ConflictException('CarePlan is already SIGNED');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const version = await tx.carePlanVersion.create({
        data: {
          tenantId,
          carePlanId,
          versionNumber: 1,
          instructions: carePlan.instructions,
          followUpDate: carePlan.followUpDate,
          actorId,
          reason: null,
          previousVersionId: null,
        },
      });

      const signedPlan = await tx.carePlan.update({
        where: { id: carePlanId },
        data: {
          status: CarePlanStatus.SIGNED,
          currentVersionId: version.id,
        },
      });

      let careTask: CareTask | null = null;
      if (carePlan.followUpDate) {
        careTask = await tx.careTask.create({
          data: {
            tenantId,
            patientId: carePlan.patientId,
            carePlanId,
            dueDate: carePlan.followUpDate,
          },
        });
      }

      return { signedPlan, version, careTask };
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'CARE_PLAN_SIGNED',
      entityType: 'CarePlan',
      entityId: carePlanId,
      metadata: { versionNumber: 1 },
    });

    if (result.careTask) {
      await this.audit.record({
        tenantId,
        actorId,
        action: 'CARE_TASK_CREATED',
        entityType: 'CareTask',
        entityId: result.careTask.id,
        metadata: { source: 'CARE_PLAN_SIGN', carePlanId },
      });
    }

    return result;
  }

  /**
   * SIGNED -> new signed CarePlanVersion with lineage to the previous one.
   * The previous CarePlanVersion row is never updated or deleted — only a
   * new row is appended and CarePlan.currentVersionId is repointed.
   */
  async amend(
    tenantId: string,
    actorId: string,
    carePlanId: string,
    dto: AmendCarePlanDto,
  ) {
    const carePlan = await this.findRootOrThrow(tenantId, carePlanId);
    if (
      carePlan.status !== CarePlanStatus.SIGNED ||
      !carePlan.currentVersionId
    ) {
      throw new ConflictException(
        'CarePlan must be SIGNED before it can be amended',
      );
    }

    const currentVersion = carePlan.versions.find(
      (v) => v.id === carePlan.currentVersionId,
    );
    if (!currentVersion) {
      throw new ConflictException('CarePlan has no current signed version');
    }

    const newVersion = await this.prisma.$transaction(async (tx) => {
      const version = await tx.carePlanVersion.create({
        data: {
          tenantId,
          carePlanId,
          versionNumber: currentVersion.versionNumber + 1,
          instructions: dto.instructions,
          followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
          actorId,
          reason: dto.reason,
          previousVersionId: currentVersion.id,
        },
      });

      await tx.carePlan.update({
        where: { id: carePlanId },
        data: {
          currentVersionId: version.id,
          instructions: dto.instructions,
          followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        },
      });

      return version;
    });

    await this.audit.record({
      tenantId,
      actorId,
      action: 'CARE_PLAN_AMENDED',
      entityType: 'CarePlan',
      entityId: carePlanId,
      metadata: {
        previousVersionId: currentVersion.id,
        newVersionId: newVersion.id,
        reason: dto.reason,
      },
    });

    return newVersion;
  }

  async getById(tenantId: string, carePlanId: string) {
    return this.findRootOrThrow(tenantId, carePlanId);
  }
}
