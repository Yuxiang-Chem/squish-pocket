-- An earlier live release stored attributed records in player_scores and
-- bottle_record. Keep those tables intact and carry their records forward.
-- Empty compatibility tables allow the same migration on fresh databases.
CREATE TABLE IF NOT EXISTS player_scores (
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
CREATE TABLE IF NOT EXISTS bottle_record (
  bottle TEXT PRIMARY KEY CHECK (bottle IN ('classic', 'lab-flask')),
  player_id TEXT NOT NULL,
  score INTEGER NOT NULL
);

INSERT INTO players (id, token_hash, name, best_score, highest_tile, best_at, created_at)
  SELECT id, token_hash, name, best_score, highest_tile, best_at, created_at FROM player_scores WHERE 1
  ON CONFLICT(id) DO UPDATE SET
    best_at = CASE WHEN excluded.best_score > players.best_score THEN excluded.best_at ELSE players.best_at END,
    best_score = MAX(players.best_score, excluded.best_score),
    highest_tile = MAX(players.highest_tile, excluded.highest_tile)
  WHERE players.token_hash = excluded.token_hash;

INSERT INTO bottle_scores (player_id, bottle_id, best_score, highest_tile, best_at)
  SELECT s.id, s.bottle, s.best_score, s.highest_tile, s.best_at FROM player_scores s
  JOIN players p ON p.id = s.id AND p.token_hash = s.token_hash
  WHERE 1 ORDER BY s.best_at, s.id
  ON CONFLICT(player_id, bottle_id) DO UPDATE SET
    best_at = CASE WHEN excluded.best_score > bottle_scores.best_score THEN excluded.best_at ELSE bottle_scores.best_at END,
    best_score = MAX(bottle_scores.best_score, excluded.best_score),
    highest_tile = MAX(bottle_scores.highest_tile, excluded.highest_tile);

-- Preserve the actual earlier holder when multiple players share a score.
INSERT INTO bottle_records (bottle_id, player_id, score)
  SELECT r.bottle, r.player_id, r.score FROM bottle_record r
  JOIN bottle_scores s ON s.player_id = r.player_id AND s.bottle_id = r.bottle AND s.best_score = r.score
  WHERE 1
  ON CONFLICT(bottle_id) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score >= bottle_records.score;
