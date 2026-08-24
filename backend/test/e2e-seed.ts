// CORE-02 browser E2E seed script — synthetic data only.
//
// Resets the disposable test database and creates one Tenant plus one
// DOCTOR and one RECEPTIONIST synthetic account for Playwright to log in
// as. Not used by the Nest app itself, and never touches a real database
// (see docker-compose.test.yml / .env — disposable/test PostgreSQL only).
import * as bcrypt from 'bcrypt';
import { PrismaClient, AuthRole } from '@prisma/client';

export const E2E_DOCTOR_EMAIL = 'doctor.a@example.test';
export const E2E_DOCTOR_PASSWORD = 'CoreDoctorE2E-Pass1!';
export const E2E_RECEPTIONIST_EMAIL = 'reception.a@example.test';
export const E2E_RECEPTIONIST_PASSWORD = 'CoreReceptionE2E-Pass1!';

export async function seedE2eDatabase(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await prisma.clinicalFormSubmission.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.careTask.deleteMany();
    await prisma.carePlanVersion.deleteMany();
    await prisma.carePlan.deleteMany();
    await prisma.encounter.deleteMany();
    await prisma.careEpisode.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.foundationProbeRecord.deleteMany();
    await prisma.authUser.deleteMany();
    await prisma.tenant.deleteMany();

    const tenant = await prisma.tenant.create({
      data: { name: 'CORE-02 Browser E2E Tenant' },
    });

    await prisma.authUser.create({
      data: {
        email: E2E_DOCTOR_EMAIL,
        passwordHash: await bcrypt.hash(E2E_DOCTOR_PASSWORD, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenant.id,
      },
    });

    await prisma.authUser.create({
      data: {
        email: E2E_RECEPTIONIST_EMAIL,
        passwordHash: await bcrypt.hash(E2E_RECEPTIONIST_PASSWORD, 10),
        role: AuthRole.RECEPTIONIST,
        tenantId: tenant.id,
      },
    });

    console.log('CORE-02 browser E2E seed complete.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedE2eDatabase().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
