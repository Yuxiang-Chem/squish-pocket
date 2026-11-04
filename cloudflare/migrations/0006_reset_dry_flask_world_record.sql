-- Fresh world board for rounds using the repaired dry flask. Historical
-- personal/overall achievements and every other bottle record are retained.
CREATE TABLE flask_record_scores (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  highest_tile INTEGER NOT NULL DEFAULT 2,
  best_at INTEGER NOT NULL
);
CREATE INDEX flask_record_scores_best ON flask_record_scores(best_score DESC);

DROP TRIGGER first_bottle_scores_record;
DROP TRIGGER higher_bottle_scores_record;
CREATE TRIGGER first_bottle_scores_record AFTER INSERT ON bottle_scores
WHEN NEW.best_score > 0 AND NEW.bottle_id <> 'lab-flask'
BEGIN
  INSERT INTO bottle_records (bottle_id,player_id,score) VALUES (NEW.bottle_id,NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score
  WHERE excluded.score>bottle_records.score;
END;
CREATE TRIGGER higher_bottle_scores_record AFTER UPDATE OF best_score ON bottle_scores
WHEN NEW.best_score > 0 AND NEW.bottle_id <> 'lab-flask'
BEGIN
  INSERT INTO bottle_records (bottle_id,player_id,score) VALUES (NEW.bottle_id,NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score
  WHERE excluded.score>bottle_records.score;
END;

DELETE FROM bottle_records WHERE bottle_id = 'lab-flask';
CREATE TRIGGER first_flask_record AFTER INSERT ON flask_record_scores WHEN NEW.best_score > 0
BEGIN
  INSERT INTO bottle_records (bottle_id,player_id,score) VALUES ('lab-flask',NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score
  WHERE excluded.score>bottle_records.score;
END;
CREATE TRIGGER higher_flask_record AFTER UPDATE OF best_score ON flask_record_scores WHEN NEW.best_score > 0
BEGIN
  INSERT INTO bottle_records (bottle_id,player_id,score) VALUES ('lab-flask',NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score
  WHERE excluded.score>bottle_records.score;
END;
