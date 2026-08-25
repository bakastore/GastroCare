import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Room } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    dto: { facilityId: string; name: string },
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

    return this.prisma.room.create({
      data: { tenantId, facilityId: dto.facilityId, name: dto.name },
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
