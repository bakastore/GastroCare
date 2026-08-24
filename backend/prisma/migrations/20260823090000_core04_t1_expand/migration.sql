-- CORE-04 T1 expand migration.
-- occurredAt is intentionally nullable during expand. Disposable synthetic
-- databases are reseeded with explicit clinical times before the contract
-- migration makes the column NOT NULL.

-- CreateEnum
CREATE TYPE "CareEpisodeStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- AlterTable
ALTER TABLE "encounters"
ADD COLUMN "episodeId" TEXT,
ADD COLUMN "occurredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "care_episodes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "episodeType" TEXT NOT NULL,
    "status" "CareEpisodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "care_episodes_tenantId_idx" ON "care_episodes"("tenantId");

-- CreateIndex
CREATE INDEX "care_episodes_tenantId_patientId_idx" ON "care_episodes"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "encounters_tenantId_episodeId_idx" ON "encounters"("tenantId", "episodeId");

-- AddForeignKey
ALTER TABLE "care_episodes" ADD CONSTRAINT "care_episodes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_episodes" ADD CONSTRAINT "care_episodes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "care_episodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
