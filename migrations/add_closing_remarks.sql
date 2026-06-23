-- Add closing_remarks to all three submission tables
ALTER TABLE bbs_observations        ADD COLUMN IF NOT EXISTS closing_remarks TEXT;
ALTER TABLE nearmiss_reports        ADD COLUMN IF NOT EXISTS closing_remarks TEXT;
ALTER TABLE inspection_checklists   ADD COLUMN IF NOT EXISTS closing_remarks TEXT;

-- Ensure inspection_checklists has a status column with a default
ALTER TABLE inspection_checklists   ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Open';
