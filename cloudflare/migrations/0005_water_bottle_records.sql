-- Expand the allowed bottle IDs while preserving all scores, tied holders,
-- and message history. D1 applies this migration as one transaction.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE bottle_scores_water (
  player_id TEXT NOT NULL REFERENCES players(id),
  bottle_id TEXT NOT NULL CHECK (bottle_id IN ('classic','lab-flask','classic-water','lab-flask-water')),
  best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  highest_tile INTEGER NOT NULL DEFAULT 2,
  best_at INTEGER NOT NULL,
  PRIMARY KEY (player_id,bottle_id)
);
INSERT INTO bottle_scores_water SELECT player_id,bottle_id,best_score,highest_tile,best_at FROM bottle_scores;
CREATE TABLE bottle_records_water (
  bottle_id TEXT PRIMARY KEY CHECK (bottle_id IN ('classic','lab-flask','classic-water','lab-flask-water')),
  player_id TEXT NOT NULL REFERENCES players(id),
  score INTEGER NOT NULL
);
INSERT INTO bottle_records_water SELECT bottle_id,player_id,score FROM bottle_records;
CREATE TABLE bottle_messages_water (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  bottle TEXT NOT NULL CHECK (bottle IN ('classic','lab-flask','classic-water','lab-flask-water')),
  day INTEGER NOT NULL,
  score INTEGER NOT NULL,
  message TEXT NOT NULL,
  reply_to TEXT,
  status TEXT NOT NULL DEFAULT 'sending',
  created_at INTEGER NOT NULL,
  UNIQUE(player_id,bottle,day)
);
INSERT INTO bottle_messages_water SELECT id,player_id,bottle,day,score,message,reply_to,status,created_at FROM bottle_messages;
DROP TABLE bottle_scores;
DROP TABLE bottle_records;
DROP TABLE bottle_messages;
ALTER TABLE bottle_scores_water RENAME TO bottle_scores;
ALTER TABLE bottle_records_water RENAME TO bottle_records;
ALTER TABLE bottle_messages_water RENAME TO bottle_messages;
CREATE INDEX bottle_scores_record ON bottle_scores(bottle_id,best_score DESC);
CREATE TRIGGER first_bottle_scores_record AFTER INSERT ON bottle_scores WHEN NEW.best_score > 0
BEGIN
  INSERT INTO bottle_records (bottle_id,player_id,score) VALUES (NEW.bottle_id,NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score
  WHERE excluded.score>bottle_records.score;
END;
CREATE TRIGGER higher_bottle_scores_record AFTER UPDATE OF best_score ON bottle_scores WHEN NEW.best_score > 0
BEGIN
  INSERT INTO bottle_records (bottle_id,player_id,score) VALUES (NEW.bottle_id,NEW.player_id,NEW.best_score)
  ON CONFLICT(bottle_id) DO UPDATE SET player_id=excluded.player_id,score=excluded.score
  WHERE excluded.score>bottle_records.score;
END;
