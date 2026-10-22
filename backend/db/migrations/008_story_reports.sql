-- story reports: one per user per story; 3 reports hide a story until an admin reviews it
CREATE TABLE IF NOT EXISTS story_reports (
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

-- hidden: left out of the public feed (auto at 3 reports, or by an admin)
-- reviewed_at: an admin restored it; reports from before then no longer count
ALTER TABLE stories ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS stories_hidden_created_idx ON stories (hidden, created_at DESC);
