-- People from the Sunday sheet have no email. Postgres unique allows many NULLs.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Raw sheet code on an assignment (LS, LST, Shadow, …). Null for assignments made in the app.
ALTER TABLE "Assignment" ADD COLUMN "rawCode" TEXT;

-- Written only after a full successful import, so a retry can finish a partial run.
CREATE TABLE "DataImport" (
    "key" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataImport_pkey" PRIMARY KEY ("key")
);
