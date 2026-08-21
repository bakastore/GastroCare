import { SetMetadata } from '@nestjs/common';
import { AuthRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given Core roles (CORE-01 section 12).
 * Routes with no @Roles() are reachable by any authenticated role.
 */
export const Roles = (...roles: AuthRole[]) => SetMetadata(ROLES_KEY, roles);
