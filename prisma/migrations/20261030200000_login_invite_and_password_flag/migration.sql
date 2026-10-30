-- Temporary password must be replaced on the next real sign-in.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- One-time invite links. tokenHash is sha256 of the secret in the URL.
CREATE TABLE "LoginInvite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoginInvite_tokenHash_key" ON "LoginInvite"("tokenHash");
CREATE INDEX "LoginInvite_userId_idx" ON "LoginInvite"("userId");

ALTER TABLE "LoginInvite" ADD CONSTRAINT "LoginInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
