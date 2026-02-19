-- CreateTable
CREATE TABLE "detection_logs" (
    "id" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personId" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,

    CONSTRAINT "detection_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "detection_logs_personId_idx" ON "detection_logs"("personId");

-- CreateIndex
CREATE INDEX "detection_logs_cameraId_idx" ON "detection_logs"("cameraId");

-- CreateIndex
CREATE INDEX "detection_logs_businessId_idx" ON "detection_logs"("businessId");

-- CreateIndex
CREATE INDEX "detection_logs_createdAt_idx" ON "detection_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "detection_logs" ADD CONSTRAINT "detection_logs_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_logs" ADD CONSTRAINT "detection_logs_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection_logs" ADD CONSTRAINT "detection_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
