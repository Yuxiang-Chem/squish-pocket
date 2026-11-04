-- Fresh Three Combine achievements for the 30% larger blobs.
-- Keep all original records as history; Two Combine tables are unchanged.
-- Separate Three Combine identities, scores and records from the original game.
CREATE TABLE three_v2_players (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  highest_tile INTEGER NOT NULL DEFAULT 1,
  best_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX three_v2_players_record ON three_v2_players(best_score DESC, best_at, id);
CREATE INDEX three_v2_players_milestone ON three_v2_players(highest_tile);

-- A singleton record makes equal-score ownership deterministic, including
-- submissions arriving in the same millisecond. Strictly higher scores win.
CREATE TABLE three_v2_world_record (
  slot INTEGER PRIMARY KEY CHECK (slot = 1),
  player_id TEXT NOT NULL REFERENCES three_v2_players(id),
  score INTEGER NOT NULL
);
CREATE TRIGGER three_v2_first_record AFTER INSERT ON three_v2_players WHEN NEW.best_score > 0
BEGIN
  INSERT INTO three_v2_world_record (slot, player_id, score) VALUES (1, NEW.id, NEW.best_score)
  ON CONFLICT(slot) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > three_v2_world_record.score;
END;
CREATE TRIGGER three_v2_higher_record AFTER UPDATE OF best_score ON three_v2_players WHEN NEW.best_score > 0
BEGIN
  INSERT INTO three_v2_world_record (slot, player_id, score) VALUES (1, NEW.id, NEW.best_score)
  ON CONFLICT(slot) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > three_v2_world_record.score;
END;

-- A record holder may send one message per day. Claims are atomic even when
-- several requests arrive together; failed deliveries release their claim.
CREATE TABLE three_v2_record_messages (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES three_v2_players(id),
  day INTEGER NOT NULL,
  score INTEGER NOT NULL,
  message TEXT NOT NULL,
  reply_to TEXT,
  status TEXT NOT NULL DEFAULT 'sending',
  created_at INTEGER NOT NULL,
  UNIQUE(player_id, day)
);

-- Per-vessel Three Combine bests and champion ownership.
CREATE TABLE three_v2_bottle_scores (
  player_id TEXT NOT NULL REFERENCES three_v2_players(id),
  bottle_id TEXT NOT NULL CHECK (bottle_id IN ('classic', 'lab-flask', 'classic-water', 'lab-flask-water', 'separating-funnel', 'conical-flask', 'separating-funnel-water', 'conical-flask-water')),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  highest_tile INTEGER NOT NULL DEFAULT 1,
  best_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, bottle_id)
);
CREATE INDEX three_v2_bottle_scores_record ON three_v2_bottle_scores(bottle_id, best_score DESC);

CREATE TABLE three_v2_bottle_records (
  bottle_id TEXT PRIMARY KEY CHECK (bottle_id IN ('classic', 'lab-flask', 'classic-water', 'lab-flask-water', 'separating-funnel', 'conical-flask', 'separating-funnel-water', 'conical-flask-water')),
  player_id TEXT NOT NULL REFERENCES three_v2_players(id),
  score INTEGER NOT NULL
);
CREATE TRIGGER three_v2_first_bottle_scores_record AFTER INSERT ON three_v2_bottle_scores WHEN NEW.best_score > 0 AND NEW.bottle_id <> 'lab-flask'
BEGIN
  INSERT INTO three_v2_bottle_records (bottle_id, player_id, score) VALUES (NEW.bottle_id, NEW.player_id, NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > three_v2_bottle_records.score;
END;
CREATE TRIGGER three_v2_higher_bottle_scores_record AFTER UPDATE OF best_score ON three_v2_bottle_scores WHEN NEW.best_score > 0 AND NEW.bottle_id <> 'lab-flask'
BEGIN
  INSERT INTO three_v2_bottle_records (bottle_id, player_id, score) VALUES (NEW.bottle_id, NEW.player_id, NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > three_v2_bottle_records.score;
END;

-- Three Combine message limits are separate from Two Combine limits.
CREATE TABLE IF NOT EXISTS three_v2_bottle_messages (
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

CREATE TABLE IF NOT EXISTS three_v2_flask_current_scores (
  player_id TEXT PRIMARY KEY REFERENCES three_v2_players(id),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  highest_tile INTEGER NOT NULL DEFAULT 1,
  best_at INTEGER NOT NULL
);

CREATE TRIGGER IF NOT EXISTS three_v2_first_current_flask_record AFTER INSERT ON three_v2_flask_current_scores WHEN NEW.best_score>0
BEGIN
  INSERT INTO three_v2_bottle_records (bottle_id,player_id,score) VALUES ('lab-flask',NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score
  WHERE excluded.score>three_v2_bottle_records.score;
END;
CREATE TRIGGER IF NOT EXISTS three_v2_higher_current_flask_record AFTER UPDATE OF best_score ON three_v2_flask_current_scores WHEN NEW.best_score>0
BEGIN
  INSERT INTO three_v2_bottle_records (bottle_id,player_id,score) VALUES ('lab-flask',NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score
  WHERE excluded.score>three_v2_bottle_records.score;
END;

-- Preserve player identities and names, restarting only achievement progress.
INSERT INTO three_v2_players (id,token_hash,name,best_score,highest_tile,best_at,created_at)
SELECT id,token_hash,name,0,1,best_at,created_at FROM three_players;

-- Each deployment begins its own two-day notice when this migration is applied.
CREATE TABLE three_v2_release_notice (
  id INTEGER PRIMARY KEY CHECK(id=1),
  published_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
INSERT INTO three_v2_release_notice (id,published_at,expires_at)
SELECT 1,CAST(strftime('%s','now') AS INTEGER)*1000,
  CAST(strftime('%s','now') AS INTEGER)*1000+172800000;
