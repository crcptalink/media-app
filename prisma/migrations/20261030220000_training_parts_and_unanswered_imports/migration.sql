-- Two answers per Thursday: pre-prayer and the training session.
CREATE TYPE "TrainingPart" AS ENUM ('PREPRAYER', 'SESSION');

ALTER TABLE "TrainingRsvp" ADD COLUMN "part" "TrainingPart" NOT NULL DEFAULT 'SESSION';
ALTER TABLE "TrainingRsvp" DROP CONSTRAINT "TrainingRsvp_pkey";
ALTER TABLE "TrainingRsvp" ADD CONSTRAINT "TrainingRsvp_pkey" PRIMARY KEY ("eventId", "userId", "part");

-- Sheet rows were stored as accepted even though nobody pressed Accept.
-- A real answer sets decidedById, so those stay accepted.
UPDATE "Assignment"
SET "status" = 'PROPOSED', "decidedAt" = NULL
WHERE "status" = 'ACCEPTED'
  AND "icsUid" LIKE 'import:%'
  AND "decidedById" IS NULL
  AND "checkedInAt" IS NULL;
