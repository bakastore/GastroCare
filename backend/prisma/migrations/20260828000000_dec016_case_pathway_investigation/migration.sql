-- CreateEnum
CREATE TYPE "TreatmentModality" AS ENUM ('MEDICAL', 'PROCEDURE', 'SURGERY');

-- CreateEnum
CREATE TYPE "InvestigationOrigin" AS ENUM ('INTERNAL_CURRENT', 'ECOSYSTEM_PRIOR', 'EXTERNAL_PRIOR');

-- AlterEnum
ALTER TYPE "AuthRole" ADD VALUE 'NURSE';

-- AlterTable
ALTER TABLE "encounters" ADD COLUMN     "treatmentPathwayId" TEXT;

-- CreateTable
CREATE TABLE "treatment_pathways" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "modality" "TreatmentModality" NOT NULL,
    "methodCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "legacyEpisodeId" TEXT,

    CONSTRAINT "treatment_pathways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "origin" "InvestigationOrigin" NOT NULL,
    "label" TEXT NOT NULL,
    "parentInvestigationId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "orderedByUserId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "requestText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investigation_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_results" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "orderId" TEXT,
    "rawText" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investigation_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "treatment_pathways_legacyEpisodeId_key" ON "treatment_pathways"("legacyEpisodeId");

-- CreateIndex
CREATE INDEX "treatment_pathways_tenantId_caseId_idx" ON "treatment_pathways"("tenantId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_pathways_id_tenantId_caseId_patientId_key" ON "treatment_pathways"("id", "tenantId", "caseId", "patientId");

-- CreateIndex
CREATE INDEX "investigations_tenantId_caseId_idx" ON "investigations"("tenantId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "investigations_id_tenantId_key" ON "investigations"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "investigations_id_tenantId_caseId_patientId_key" ON "investigations"("id", "tenantId", "caseId", "patientId");

-- CreateIndex
CREATE INDEX "investigation_orders_tenantId_assignedToUserId_idx" ON "investigation_orders"("tenantId", "assignedToUserId");

-- CreateIndex
CREATE UNIQUE INDEX "investigation_orders_id_tenantId_investigationId_key" ON "investigation_orders"("id", "tenantId", "investigationId");

-- CreateIndex
CREATE INDEX "investigation_results_tenantId_investigationId_idx" ON "investigation_results"("tenantId", "investigationId");

-- CreateIndex
CREATE UNIQUE INDEX "patients_id_tenantId_key" ON "patients"("id", "tenantId");

-- CreateIndex
CREATE INDEX "encounters_tenantId_treatmentPathwayId_idx" ON "encounters"("tenantId", "treatmentPathwayId");

-- CreateIndex
CREATE UNIQUE INDEX "care_episodes_id_tenantId_patientId_key" ON "care_episodes"("id", "tenantId", "patientId");

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_treatmentPathwayId_tenantId_episodeId_patientId_fkey" FOREIGN KEY ("treatmentPathwayId", "tenantId", "episodeId", "patientId") REFERENCES "treatment_pathways"("id", "tenantId", "caseId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "treatment_pathways" ADD CONSTRAINT "treatment_pathways_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_pathways" ADD CONSTRAINT "treatment_pathways_patientId_tenantId_fkey" FOREIGN KEY ("patientId", "tenantId") REFERENCES "patients"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "treatment_pathways" ADD CONSTRAINT "treatment_pathways_caseId_tenantId_patientId_fkey" FOREIGN KEY ("caseId", "tenantId", "patientId") REFERENCES "care_episodes"("id", "tenantId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "treatment_pathways" ADD CONSTRAINT "treatment_pathways_legacyEpisodeId_fkey" FOREIGN KEY ("legacyEpisodeId") REFERENCES "care_episodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_patientId_tenantId_fkey" FOREIGN KEY ("patientId", "tenantId") REFERENCES "patients"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_caseId_tenantId_patientId_fkey" FOREIGN KEY ("caseId", "tenantId", "patientId") REFERENCES "care_episodes"("id", "tenantId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_parentInvestigationId_tenantId_caseId_patie_fkey" FOREIGN KEY ("parentInvestigationId", "tenantId", "caseId", "patientId") REFERENCES "investigations"("id", "tenantId", "caseId", "patientId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investigation_orders" ADD CONSTRAINT "investigation_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_orders" ADD CONSTRAINT "investigation_orders_investigationId_tenantId_fkey" FOREIGN KEY ("investigationId", "tenantId") REFERENCES "investigations"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investigation_results" ADD CONSTRAINT "investigation_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_results" ADD CONSTRAINT "investigation_results_investigationId_tenantId_fkey" FOREIGN KEY ("investigationId", "tenantId") REFERENCES "investigations"("id", "tenantId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investigation_results" ADD CONSTRAINT "investigation_results_orderId_tenantId_investigationId_fkey" FOREIGN KEY ("orderId", "tenantId", "investigationId") REFERENCES "investigation_orders"("id", "tenantId", "investigationId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Review: additive only. No legacy clinical, identity, audit or timestamp UPDATE.
-- PostgreSQL composite FKs use MATCH SIMPLE; guard nullable ancestry explicitly.
ALTER TABLE encounters ADD CONSTRAINT encounter_pathway_requires_case
CHECK ("treatmentPathwayId" IS NULL OR "episodeId" IS NOT NULL);
ALTER TABLE treatment_pathways ADD CONSTRAINT pathway_explicit_surgery_method
CHECK ((modality = 'SURGERY' AND "methodCode" IS NOT NULL AND "methodCode" IN
('LONGO', 'MILLIGAN_MORGAN', 'FERGUSON', 'HCPT', 'LASER_DIODE_LHP', 'THD_HAL_RAR'))
OR (modality <> 'SURGERY' AND "methodCode" IS NULL));
ALTER TABLE investigations ADD CONSTRAINT investigation_not_own_parent
CHECK ("parentInvestigationId" IS NULL OR "parentInvestigationId" <> id);
