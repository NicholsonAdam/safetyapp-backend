-- Tracks which action items have been emailed to which owner, and when.
-- Used by the Monday cron to split "newly assigned" vs "already informed".

CREATE TABLE IF NOT EXISTS action_item_notifications (
  id              SERIAL PRIMARY KEY,
  action_item_id  INTEGER NOT NULL,
  owner_user_id   INTEGER NOT NULL,
  first_notified  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_notified   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (action_item_id, owner_user_id)
);

CREATE INDEX IF NOT EXISTS idx_ain_owner ON action_item_notifications (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_ain_item  ON action_item_notifications (action_item_id);
