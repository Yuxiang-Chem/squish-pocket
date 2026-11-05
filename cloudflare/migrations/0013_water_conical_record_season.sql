-- Add an isolated season store; no scores are cleared by this migration.
-- Reset activation is a separate official-only operation with explicit approval.
CREATE TABLE water_conical_current_scores (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK(best_score>=0),
  highest_tile INTEGER NOT NULL DEFAULT 2,
  best_at INTEGER NOT NULL
);
CREATE VIEW current_water_conical_bottle_scores AS
  SELECT player_id,bottle_id,best_score,highest_tile,best_at FROM bottle_scores WHERE bottle_id<>'conical-flask-water'
  UNION ALL SELECT player_id,'conical-flask-water',best_score,highest_tile,best_at FROM water_conical_current_scores;
CREATE TRIGGER first_water_conical_record AFTER INSERT ON water_conical_current_scores WHEN NEW.best_score>0
BEGIN
  INSERT INTO bottle_records(bottle_id,player_id,score) VALUES('conical-flask-water',NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score WHERE excluded.score>bottle_records.score;
END;
CREATE TRIGGER higher_water_conical_record AFTER UPDATE OF best_score ON water_conical_current_scores WHEN NEW.best_score>0
BEGIN
  INSERT INTO bottle_records(bottle_id,player_id,score) VALUES('conical-flask-water',NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score WHERE excluded.score>bottle_records.score;
END;
