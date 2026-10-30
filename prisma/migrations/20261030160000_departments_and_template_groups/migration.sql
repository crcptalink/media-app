-- Departments the homepage can list, plus a group for each service template.
-- Existing Link rows and memberships are kept. New columns have defaults.
-- Every current user is given Link access if they do not already have it.

ALTER TABLE "Department" ADD COLUMN "sort" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Department" ADD COLUMN "blurb" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Department" ADD COLUMN "ready" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "Department" ("id", "name", "slug", "active", "sort", "blurb", "ready")
VALUES
  ('dept_cameras', 'Cameras', 'cameras', true, 1, 'Cameras for services.', false),
  ('dept_directors', 'Directors / Vision mixers', 'directors', true, 2, 'Directing and vision mixing.', false),
  ('dept_graphics', 'Graphic operators', 'graphics', true, 3, 'Lyrics and graphics.', false),
  ('dept_link', 'Link', 'link', true, 4, 'Livestream, Link, and service leading. Answer slots, check in, and see who is serving.', true),
  ('dept_comms', 'Comms', 'comms', true, 5, 'Communications.', false)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "sort" = EXCLUDED."sort",
  "blurb" = EXCLUDED."blurb",
  "ready" = EXCLUDED."ready",
  "active" = true;

INSERT INTO "DepartmentMember" ("userId", "departmentId", "role")
SELECT u."id", d."id", 'VOLUNTEER'::"DeptRole"
FROM "User" u
JOIN "Department" d ON d."slug" = 'link'
WHERE NOT EXISTS (
  SELECT 1 FROM "DepartmentMember" m
  WHERE m."userId" = u."id" AND m."departmentId" = d."id"
);

CREATE TABLE "TemplateGroup" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TemplateGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TemplateGroup_departmentId_name_key" ON "TemplateGroup"("departmentId", "name");

ALTER TABLE "TemplateGroup" ADD CONSTRAINT "TemplateGroup_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceTemplate" ADD COLUMN "groupId" TEXT;

ALTER TABLE "ServiceTemplate" ADD CONSTRAINT "ServiceTemplate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TemplateGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ServiceTemplate_groupId_idx" ON "ServiceTemplate"("groupId");

-- One group per department for each day that already has a template.
INSERT INTO "TemplateGroup" ("id", "departmentId", "name", "sort")
SELECT DISTINCT
  'tg_' || t."departmentId" || '_' || g.slug,
  t."departmentId",
  g.name,
  g.sort
FROM (
  SELECT "departmentId",
    CASE
      WHEN lower("name") LIKE '%sunday%' OR weekday = 0 THEN 'Sunday'
      WHEN lower("name") LIKE '%thursday%' OR weekday = 4 THEN 'Thursday'
      WHEN weekday = 1 THEN 'Monday'
      WHEN weekday = 2 THEN 'Tuesday'
      WHEN weekday = 3 THEN 'Wednesday'
      WHEN weekday = 5 THEN 'Friday'
      WHEN weekday = 6 THEN 'Saturday'
      ELSE 'Other'
    END AS gname
  FROM "ServiceTemplate"
) t
JOIN (
  VALUES
    ('Sunday', 'sunday', 0),
    ('Monday', 'monday', 1),
    ('Tuesday', 'tuesday', 2),
    ('Wednesday', 'wednesday', 3),
    ('Thursday', 'thursday', 4),
    ('Friday', 'friday', 5),
    ('Saturday', 'saturday', 6),
    ('Other', 'other', 7)
) AS g(name, slug, sort) ON g.name = t.gname
ON CONFLICT ("departmentId", "name") DO NOTHING;

UPDATE "ServiceTemplate" AS t
SET "groupId" = g."id"
FROM "TemplateGroup" AS g
WHERE t."groupId" IS NULL
  AND g."departmentId" = t."departmentId"
  AND g."name" = CASE
    WHEN lower(t."name") LIKE '%sunday%' OR t.weekday = 0 THEN 'Sunday'
    WHEN lower(t."name") LIKE '%thursday%' OR t.weekday = 4 THEN 'Thursday'
    WHEN t.weekday = 1 THEN 'Monday'
    WHEN t.weekday = 2 THEN 'Tuesday'
    WHEN t.weekday = 3 THEN 'Wednesday'
    WHEN t.weekday = 5 THEN 'Friday'
    WHEN t.weekday = 6 THEN 'Saturday'
    ELSE 'Other'
  END;
