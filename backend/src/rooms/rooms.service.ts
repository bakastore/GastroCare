import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Room } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Room — physical location within a Facility, tenant-scoped (DEC-010 §C).
 * Enforces the Room -> Facility ancestry invariant: a Room's Facility must
 * exist AND belong to the same tenant as the Room. A Room referencing a
 * Facility in another tenant, or a nonexistent Facility, is rejected here
 * (Prisma's schema DSL cannot express a cross-field tenant-equality
 * constraint at the database layer).
 */
@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * DEC-018 — creation is a Clinic Admin action (gated in the controller).
   * The Room row and its ROOM_CREATED AuditEvent are written in the same
   * transaction.
   */
  async create(
    tenantId: string,
    dto: { facilityId: string; name: string },
    actorId: string,
  ): Promise<Room> {
    const facility = await this.prisma.facility.findFirst({
      where: { id: dto.facilityId, tenantId },
      select: { id: true },
    });
    if (!facility) {
      throw new BadRequestException(
        'Room facilityId must reference a Facility in the same tenant',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: { tenantId, facilityId: dto.facilityId, name: dto.name },
      });
      await this.audit.record(
        {
          tenantId,
          actorId,
          action: 'ROOM_CREATED',
          entityType: 'Room',
          entityId: room.id,
          metadata: {
            roomId: room.id,
            facilityId: room.facilityId,
            name: room.name,
          },
        },
        tx,
      );
      return room;
    });
  }

  async listByFacility(tenantId: string, facilityId: string): Promise<Room[]> {
    return this.prisma.room.findMany({
      where: { tenantId, facilityId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getById(tenantId: string, id: string): Promise<Room> {
    const room = await this.prisma.room.findFirst({ where: { id, tenantId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }

  /** Used by EncountersService to validate an Encounter's roomId is tenant-scoped. */
  async assertRoomInTenant(tenantId: string, roomId: string): Promise<Room> {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, tenantId },
    });
    if (!room) {
      throw new NotFoundException('Room not found in this tenant');
    }
    return room;
  }
}
