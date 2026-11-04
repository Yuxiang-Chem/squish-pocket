-- Historical overall scores have no bottle attribution; keep them on the
-- existing overall board rather than guessing which vessel earned them.
CREATE TABLE bottle_scores (
  player_id TEXT NOT NULL REFERENCES players(id),
  bottle_id TEXT NOT NULL CHECK (bottle_id IN ('classic', 'lab-flask')),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  highest_tile INTEGER NOT NULL DEFAULT 2,
  best_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, bottle_id)
);
CREATE INDEX bottle_scores_record ON bottle_scores(bottle_id, best_score DESC);

CREATE TABLE bottle_records (
  bottle_id TEXT PRIMARY KEY CHECK (bottle_id IN ('classic', 'lab-flask')),
  player_id TEXT NOT NULL REFERENCES players(id),
  score INTEGER NOT NULL
);
CREATE TRIGGER first_bottle_scores_record AFTER INSERT ON bottle_scores WHEN NEW.best_score > 0
BEGIN
  INSERT INTO bottle_records (bottle_id, player_id, score) VALUES (NEW.bottle_id, NEW.player_id, NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > bottle_records.score;
END;
CREATE TRIGGER higher_bottle_scores_record AFTER UPDATE OF best_score ON bottle_scores WHEN NEW.best_score > 0
BEGIN
  INSERT INTO bottle_records (bottle_id, player_id, score) VALUES (NEW.bottle_id, NEW.player_id, NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id = excluded.player_id, score = excluded.score
  WHERE excluded.score > bottle_records.score;
END;
