ALTER TABLE threads ADD COLUMN language TEXT NOT NULL DEFAULT 'ja';
ALTER TABLE posts ADD COLUMN language TEXT NOT NULL DEFAULT 'ja';
CREATE TABLE IF NOT EXISTS translations (
  resource_type TEXT NOT NULL CHECK(resource_type IN ('thread','post')),
  resource_id TEXT NOT NULL,
  target_language TEXT NOT NULL,
  source_language TEXT NOT NULL,
  text TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(resource_type,resource_id,target_language)
);
CREATE TABLE IF NOT EXISTS translation_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('reserved','completed','failed'))
);
CREATE INDEX IF NOT EXISTS translation_runs_day ON translation_runs(created_at);
