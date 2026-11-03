CREATE TABLE players (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  highest_tile INTEGER NOT NULL DEFAULT 2,
  best_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX players_record ON players(best_score DESC, best_at, id);
CREATE INDEX players_2048 ON players(highest_tile);

-- A singleton record makes equal-score ownership deterministic, including
-- submissions arriving in the same millisecond. Strictly higher scores win.
CREATE TABLE world_record (
  slot INTEGER PRIMARY KEY CHECK (slot = 1),
  player_id TEXT NOT NULL REFERENCES players(id),
  score INTEGER NOT NULL
);
CREATE TRIGGER first_record AFTER INSERT ON players WHEN NEW.best_score > 0
BEGIN
  INSERT INTO world_record (slot, player_id, score) VALUES (1, NEW.id, NEW.best_score)
  ON CONFLICT(slot) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > world_record.score;
END;
CREATE TRIGGER higher_record AFTER UPDATE OF best_score ON players WHEN NEW.best_score > 0
BEGIN
  INSERT INTO world_record (slot, player_id, score) VALUES (1, NEW.id, NEW.best_score)
  ON CONFLICT(slot) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > world_record.score;
END;

-- A record holder may send one message per day. Claims are atomic even when
-- several requests arrive together; failed deliveries release their claim.
CREATE TABLE record_messages (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  day INTEGER NOT NULL,
  score INTEGER NOT NULL,
  message TEXT NOT NULL,
  reply_to TEXT,
  status TEXT NOT NULL DEFAULT 'sending',
  created_at INTEGER NOT NULL,
  UNIQUE(player_id, day)
);
