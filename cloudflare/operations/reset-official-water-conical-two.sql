-- ONE-TIME OPERATION. Official database only. Explicitly authorized 2026-11-05.
-- Requires migration 0013 and the matching tested official release.
-- Do not run this file on test or repeat it after fresh scores have been earned.
DROP TRIGGER first_bottle_scores_record;
DROP TRIGGER higher_bottle_scores_record;
CREATE TRIGGER first_bottle_scores_record AFTER INSERT ON bottle_scores WHEN NEW.best_score>0 AND NEW.bottle_id NOT IN ('lab-flask','conical-flask-water')
BEGIN
  INSERT INTO bottle_records(bottle_id,player_id,score) VALUES(NEW.bottle_id,NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score WHERE excluded.score>bottle_records.score;
END;
CREATE TRIGGER higher_bottle_scores_record AFTER UPDATE OF best_score ON bottle_scores WHEN NEW.best_score>0 AND NEW.bottle_id NOT IN ('lab-flask','conical-flask-water')
BEGIN
  INSERT INTO bottle_records(bottle_id,player_id,score) VALUES(NEW.bottle_id,NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score WHERE excluded.score>bottle_records.score;
END;
DELETE FROM bottle_scores WHERE bottle_id='conical-flask-water';
DELETE FROM water_conical_current_scores;
DELETE FROM bottle_records WHERE bottle_id='conical-flask-water';
