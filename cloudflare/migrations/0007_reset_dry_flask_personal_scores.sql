-- Reset dry-flask personal scores for everyone. Preserve merge milestones,
-- overall achievements, identities, messages, and all other bottle scores.
UPDATE bottle_scores SET best_score=0 WHERE bottle_id='lab-flask';
-- New rounds use record epoch 2, so cached clients and saved old rounds cannot
-- reinstate either the personal best or the fresh board's previous score.
DELETE FROM flask_record_scores;
DELETE FROM bottle_records WHERE bottle_id='lab-flask';
-- Separate current scores from the earlier table: requests still finishing on
-- the previous Worker version cannot write old scores onto the new board.
DROP TRIGGER IF EXISTS first_flask_record;
DROP TRIGGER IF EXISTS higher_flask_record;
CREATE TABLE IF NOT EXISTS flask_current_scores (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  highest_tile INTEGER NOT NULL DEFAULT 2,
  best_at INTEGER NOT NULL
);
DELETE FROM flask_current_scores;
CREATE TRIGGER IF NOT EXISTS first_current_flask_record AFTER INSERT ON flask_current_scores WHEN NEW.best_score>0
BEGIN
  INSERT INTO bottle_records (bottle_id,player_id,score) VALUES ('lab-flask',NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score
  WHERE excluded.score>bottle_records.score;
END;
CREATE TRIGGER IF NOT EXISTS higher_current_flask_record AFTER UPDATE OF best_score ON flask_current_scores WHEN NEW.best_score>0
BEGIN
  INSERT INTO bottle_records (bottle_id,player_id,score) VALUES ('lab-flask',NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score
  WHERE excluded.score>bottle_records.score;
END;
