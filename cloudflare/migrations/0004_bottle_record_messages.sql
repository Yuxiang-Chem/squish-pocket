-- Reuse the earlier deployment's message history when present, including its
-- daily limits. This is separate from the existing overall-record inbox.
CREATE TABLE IF NOT EXISTS bottle_messages (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  bottle TEXT NOT NULL CHECK (bottle IN ('classic', 'lab-flask')),
  day INTEGER NOT NULL,
  score INTEGER NOT NULL,
  message TEXT NOT NULL,
  reply_to TEXT,
  status TEXT NOT NULL DEFAULT 'sending',
  created_at INTEGER NOT NULL,
  UNIQUE(player_id, bottle, day)
);
