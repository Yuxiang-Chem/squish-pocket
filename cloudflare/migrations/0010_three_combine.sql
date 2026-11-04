-- Separate Three Combine identities, scores and records from the original game.
CREATE TABLE three_players (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  highest_tile INTEGER NOT NULL DEFAULT 1,
  best_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX three_players_record ON three_players(best_score DESC, best_at, id);
CREATE INDEX three_players_milestone ON three_players(highest_tile);

-- A singleton record makes equal-score ownership deterministic, including
-- submissions arriving in the same millisecond. Strictly higher scores win.
CREATE TABLE three_world_record (
  slot INTEGER PRIMARY KEY CHECK (slot = 1),
  player_id TEXT NOT NULL REFERENCES three_players(id),
  score INTEGER NOT NULL
);
CREATE TRIGGER three_first_record AFTER INSERT ON three_players WHEN NEW.best_score > 0
BEGIN
  INSERT INTO three_world_record (slot, player_id, score) VALUES (1, NEW.id, NEW.best_score)
  ON CONFLICT(slot) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > three_world_record.score;
END;
CREATE TRIGGER three_higher_record AFTER UPDATE OF best_score ON three_players WHEN NEW.best_score > 0
BEGIN
  INSERT INTO three_world_record (slot, player_id, score) VALUES (1, NEW.id, NEW.best_score)
  ON CONFLICT(slot) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > three_world_record.score;
END;

-- A record holder may send one message per day. Claims are atomic even when
-- several requests arrive together; failed deliveries release their claim.
CREATE TABLE three_record_messages (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES three_players(id),
  day INTEGER NOT NULL,
  score INTEGER NOT NULL,
  message TEXT NOT NULL,
  reply_to TEXT,
  status TEXT NOT NULL DEFAULT 'sending',
  created_at INTEGER NOT NULL,
  UNIQUE(player_id, day)
);

-- Per-vessel Three Combine bests and champion ownership.
CREATE TABLE three_bottle_scores (
  player_id TEXT NOT NULL REFERENCES three_players(id),
  bottle_id TEXT NOT NULL CHECK (bottle_id IN ('classic', 'lab-flask', 'classic-water', 'lab-flask-water', 'separating-funnel', 'conical-flask', 'separating-funnel-water', 'conical-flask-water')),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  highest_tile INTEGER NOT NULL DEFAULT 1,
  best_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, bottle_id)
);
CREATE INDEX three_bottle_scores_record ON three_bottle_scores(bottle_id, best_score DESC);

CREATE TABLE three_bottle_records (
  bottle_id TEXT PRIMARY KEY CHECK (bottle_id IN ('classic', 'lab-flask', 'classic-water', 'lab-flask-water', 'separating-funnel', 'conical-flask', 'separating-funnel-water', 'conical-flask-water')),
  player_id TEXT NOT NULL REFERENCES three_players(id),
  score INTEGER NOT NULL
);
CREATE TRIGGER three_first_bottle_scores_record AFTER INSERT ON three_bottle_scores WHEN NEW.best_score > 0 AND NEW.bottle_id <> 'lab-flask'
BEGIN
  INSERT INTO three_bottle_records (bottle_id, player_id, score) VALUES (NEW.bottle_id, NEW.player_id, NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > three_bottle_records.score;
END;
CREATE TRIGGER three_higher_bottle_scores_record AFTER UPDATE OF best_score ON three_bottle_scores WHEN NEW.best_score > 0 AND NEW.bottle_id <> 'lab-flask'
BEGIN
  INSERT INTO three_bottle_records (bottle_id, player_id, score) VALUES (NEW.bottle_id, NEW.player_id, NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > three_bottle_records.score;
END;

-- Three Combine message limits are separate from Two Combine limits.
CREATE TABLE IF NOT EXISTS three_bottle_messages (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  bottle TEXT NOT NULL CHECK (bottle IN ('classic', 'lab-flask', 'classic-water', 'lab-flask-water', 'separating-funnel', 'conical-flask', 'separating-funnel-water', 'conical-flask-water')),
  day INTEGER NOT NULL,
  score INTEGER NOT NULL,
  message TEXT NOT NULL,
  reply_to TEXT,
  status TEXT NOT NULL DEFAULT 'sending',
  created_at INTEGER NOT NULL,
  UNIQUE(player_id, bottle, day)
);

CREATE TABLE IF NOT EXISTS three_flask_current_scores (
  player_id TEXT PRIMARY KEY REFERENCES three_players(id),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  highest_tile INTEGER NOT NULL DEFAULT 1,
  best_at INTEGER NOT NULL
);

CREATE TRIGGER IF NOT EXISTS three_first_current_flask_record AFTER INSERT ON three_flask_current_scores WHEN NEW.best_score>0
BEGIN
  INSERT INTO three_bottle_records (bottle_id,player_id,score) VALUES ('lab-flask',NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score
  WHERE excluded.score>three_bottle_records.score;
END;
CREATE TRIGGER IF NOT EXISTS three_higher_current_flask_record AFTER UPDATE OF best_score ON three_flask_current_scores WHEN NEW.best_score>0
BEGIN
  INSERT INTO three_bottle_records (bottle_id,player_id,score) VALUES ('lab-flask',NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score
  WHERE excluded.score>three_bottle_records.score;
END;
