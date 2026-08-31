import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser, Prisma, StaffProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * DEC-019 tenant-scoped resolution. Every Clinic Admin lookup is scoped by
 * `id + actor.tenantId`; a foreign-tenant id is reported as a plain 404 with
 * no existence leak (Contract T2 / §8). Child lookups additionally scope by
 * the parent `staffProfileId`.
 */
@Injectable()
export class StaffAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async findUserInTenantOrThrow(
    tenantId: string,
    userId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<AuthUser> {
    const user = await client.authUser.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Profile is optional — returns null when the user has none. */
  async getProfileOrNull(
    tenantId: string,
    userId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<StaffProfile | null> {
    await this.findUserInTenantOrThrow(tenantId, userId, client);
    return client.staffProfile.findFirst({
      where: { authUserId: userId, tenantId },
    });
  }

  async getProfileOrThrow(
    tenantId: string,
    userId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<StaffProfile> {
    const profile = await this.getProfileOrNull(tenantId, userId, client);
    if (!profile) {
      throw new NotFoundException('Staff profile not found');
    }
    return profile;
  }
}
