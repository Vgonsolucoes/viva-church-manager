BEGIN;

ALTER TABLE "YoutubeVideo" ADD COLUMN "visibilityCustomized" BOOLEAN NOT NULL DEFAULT false;

UPDATE "YoutubeVideo" AS video
SET "visibilityCustomized" = true
WHERE EXISTS (
    SELECT 1 FROM "AuditLog" AS audit
    WHERE audit."entityType" = 'YoutubeVideo'
      AND audit."entityId" = video.id
      AND audit.action IN ('YOUTUBE_SHOW_ON_SITE', 'YOUTUBE_HIDE_ON_SITE')
);

COMMIT;
