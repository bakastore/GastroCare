-- CreateEnum
CREATE TYPE "ClinicalFormStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateTable
CREATE TABLE "clinical_form_submissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "status" "ClinicalFormStatus" NOT NULL DEFAULT 'DRAFT',
    "responses" JSONB NOT NULL,
    "computedScores" JSONB,
    "actorId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinical_form_submissions_tenantId_idx" ON "clinical_form_submissions"("tenantId");

-- CreateIndex
CREATE INDEX "clinical_form_submissions_tenantId_patientId_idx" ON "clinical_form_submissions"("tenantId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_form_submissions_encounterId_templateKey_key" ON "clinical_form_submissions"("encounterId", "templateKey");

-- AddForeignKey
ALTER TABLE "clinical_form_submissions" ADD CONSTRAINT "clinical_form_submissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_form_submissions" ADD CONSTRAINT "clinical_form_submissions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_form_submissions" ADD CONSTRAINT "clinical_form_submissions_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
