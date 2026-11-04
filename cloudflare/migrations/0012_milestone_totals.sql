-- Count milestone creations from this update onward, independently of the
-- existing unique-player counter. Historical repeated merges are unknown.
-- These shared tables are explicitly scoped by mode and achievement epoch.
CREATE TABLE milestone_runs (
  merge_mode TEXT NOT NULL CHECK (merge_mode IN ('two','three')),
  achievement_epoch INTEGER NOT NULL CHECK (achievement_epoch > 0),
  player_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  merge_count INTEGER NOT NULL CHECK (merge_count BETWEEN 1 AND 1000000),
  PRIMARY KEY (merge_mode,achievement_epoch,player_id,run_id)
);
CREATE TABLE milestone_tracking (
  id INTEGER PRIMARY KEY CHECK (id=1),
  started_at INTEGER NOT NULL
);
INSERT INTO milestone_tracking VALUES (1,CAST(strftime('%s','now') AS INTEGER)*1000);
