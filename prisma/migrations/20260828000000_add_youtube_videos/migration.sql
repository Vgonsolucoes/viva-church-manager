-- CreateEnum
CREATE TYPE "YoutubeSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'ERROR');

-- CreateTable
CREATE TABLE "YoutubeVideo" (
    "id" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "duration" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "visibleOnSite" BOOLEAN NOT NULL DEFAULT false,
    "syncStatus" "YoutubeSyncStatus" NOT NULL DEFAULT 'SYNCED',
    "syncError" TEXT,
    "syncedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeVideo_youtubeId_key" ON "YoutubeVideo"("youtubeId");

-- CreateIndex
CREATE INDEX "YoutubeVideo_visibleOnSite_idx" ON "YoutubeVideo"("visibleOnSite");

-- CreateIndex
CREATE INDEX "YoutubeVideo_publishedAt_idx" ON "YoutubeVideo"("publishedAt");

-- CreateIndex
CREATE INDEX "YoutubeVideo_youtubeId_idx" ON "YoutubeVideo"("youtubeId");

-- AddForeignKey
ALTER TABLE "YoutubeVideo" ADD CONSTRAINT "YoutubeVideo_syncedById_fkey" FOREIGN KEY ("syncedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
