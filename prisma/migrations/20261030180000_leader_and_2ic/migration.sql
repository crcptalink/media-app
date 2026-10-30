-- Rename the department role Lead -> Leader, and add 2IC between Leader and Member.
-- Existing LEAD rows become LEADER. Volunteer rows are unchanged.
ALTER TYPE "DeptRole" RENAME VALUE 'LEAD' TO 'LEADER';
ALTER TYPE "DeptRole" ADD VALUE 'TWO_IC' BEFORE 'VOLUNTEER';
