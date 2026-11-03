-- Each bottle keeps its own score, tile, world record, and daily message.
-- Records saved before this split stay on the original bottle.

CREATE TABLE player_scores (
  id TEXT NOT NULL,
  bottle TEXT NOT NULL CHECK (bottle IN ('classic', 'lab-flask')),
  token_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  highest_tile INTEGER NOT NULL DEFAULT 2,
  best_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (id, bottle)
);
INSERT INTO player_scores (id, bottle, token_hash, name, best_score, highest_tile, best_at, created_at)
SELECT id, 'classic', token_hash, name, best_score, highest_tile, best_at, created_at FROM players;
CREATE INDEX player_scores_record ON player_scores(bottle, best_score DESC, best_at, id);
CREATE INDEX player_scores_2048 ON player_scores(bottle, highest_tile);

CREATE TABLE bottle_record (
  bottle TEXT PRIMARY KEY CHECK (bottle IN ('classic', 'lab-flask')),
  player_id TEXT NOT NULL,
  score INTEGER NOT NULL
);
INSERT INTO bottle_record (bottle, player_id, score)
SELECT 'classic', player_id, score FROM world_record WHERE slot = 1;

-- Inserts above ran before these triggers, so the copied record holder is kept.
CREATE TRIGGER first_bottle_record AFTER INSERT ON player_scores WHEN NEW.best_score > 0
BEGIN
  INSERT INTO bottle_record (bottle, player_id, score) VALUES (NEW.bottle, NEW.id, NEW.best_score)
  ON CONFLICT(bottle) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > bottle_record.score;
END;
CREATE TRIGGER higher_bottle_record AFTER UPDATE OF best_score ON player_scores WHEN NEW.best_score > 0
BEGIN
  INSERT INTO bottle_record (bottle, player_id, score) VALUES (NEW.bottle, NEW.id, NEW.best_score)
  ON CONFLICT(bottle) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > bottle_record.score;
END;

CREATE TABLE bottle_messages (
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
INSERT INTO bottle_messages (id, player_id, bottle, day, score, message, reply_to, status, created_at)
SELECT id, player_id, 'classic', day, score, message, reply_to, status, created_at FROM record_messages;
