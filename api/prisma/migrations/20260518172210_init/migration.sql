-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "Effort" AS ENUM ('XS', 'S', 'M', 'L', 'XL');

-- CreateEnum
CREATE TYPE "BackendNeeded" AS ENUM ('NO', 'YES', 'PARTIAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "PrototypeState" AS ENUM ('NOT_DONE', 'MOCK', 'DONE');

-- CreateEnum
CREATE TYPE "TrackStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'NA');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('DEPENDS_ON', 'ROLLS_UP_TO');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Epic" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#94a3b8',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Epic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "epicId" TEXT,
    "externalId" TEXT,
    "subArea" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "userRole" TEXT,
    "trigger" TEXT,
    "screenFile" TEXT,
    "uiElementType" TEXT,
    "prototypeState" "PrototypeState" NOT NULL DEFAULT 'NOT_DONE',
    "backendNeeded" "BackendNeeded" NOT NULL DEFAULT 'NO',
    "apiEndpointHint" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'P1',
    "estimatedEffort" "Effort",
    "sprintTarget" TEXT,
    "owner" TEXT,
    "acceptanceCriteria" TEXT,
    "notes" TEXT,
    "canvasX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "canvasY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureTrackStatus" (
    "featureId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "status" "TrackStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureTrackStatus_pkey" PRIMARY KEY ("featureId","trackId")
);

-- CreateTable
CREATE TABLE "Dependency" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromFeatureId" TEXT NOT NULL,
    "toFeatureId" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'DEPENDS_ON',
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Track_projectId_idx" ON "Track"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_projectId_name_key" ON "Track"("projectId", "name");

-- CreateIndex
CREATE INDEX "Epic_projectId_idx" ON "Epic"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Epic_projectId_name_key" ON "Epic"("projectId", "name");

-- CreateIndex
CREATE INDEX "Feature_projectId_idx" ON "Feature"("projectId");

-- CreateIndex
CREATE INDEX "Feature_epicId_idx" ON "Feature"("epicId");

-- CreateIndex
CREATE INDEX "Feature_priority_idx" ON "Feature"("priority");

-- CreateIndex
CREATE INDEX "FeatureTrackStatus_trackId_status_idx" ON "FeatureTrackStatus"("trackId", "status");

-- CreateIndex
CREATE INDEX "Dependency_projectId_idx" ON "Dependency"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Dependency_fromFeatureId_toFeatureId_type_key" ON "Dependency"("fromFeatureId", "toFeatureId", "type");

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Epic" ADD CONSTRAINT "Epic_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Epic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureTrackStatus" ADD CONSTRAINT "FeatureTrackStatus_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureTrackStatus" ADD CONSTRAINT "FeatureTrackStatus_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_fromFeatureId_fkey" FOREIGN KEY ("fromFeatureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_toFeatureId_fkey" FOREIGN KEY ("toFeatureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
