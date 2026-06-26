-- Add facility/site column to support multi-site (Muskogee, Dickson, Corporate)
-- Existing data defaults to MUSKOGEE

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS facility TEXT DEFAULT 'MUSKOGEE';

ALTER TABLE bbs_observations
  ADD COLUMN IF NOT EXISTS facility TEXT DEFAULT 'MUSKOGEE';

ALTER TABLE nearmiss_reports
  ADD COLUMN IF NOT EXISTS facility TEXT DEFAULT 'MUSKOGEE';

ALTER TABLE inspection_checklists
  ADD COLUMN IF NOT EXISTS facility TEXT DEFAULT 'MUSKOGEE';

ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS facility TEXT DEFAULT 'MUSKOGEE';

ALTER TABLE incident_investigations
  ADD COLUMN IF NOT EXISTS facility TEXT DEFAULT 'MUSKOGEE';

ALTER TABLE gemba_sessions
  ADD COLUMN IF NOT EXISTS facility TEXT DEFAULT 'MUSKOGEE';

-- facility values: 'MUSKOGEE' | 'DICKSON' | 'CORPORATE'
-- All existing rows inherit MUSKOGEE as default.
-- New Dickson submissions will set facility = 'DICKSON'.
