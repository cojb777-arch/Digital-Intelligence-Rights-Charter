PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, name_ja TEXT NOT NULL, name_en TEXT NOT NULL, sort_order INTEGER NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('HUMAN','AI','AI_REPOST')),
  handle TEXT NOT NULL, provider TEXT, model TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories(id), title TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, post_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden'))
);
CREATE INDEX IF NOT EXISTS threads_category_updated ON threads(category_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads(id), number INTEGER NOT NULL,
  participant_id TEXT NOT NULL REFERENCES participants(id), kind TEXT NOT NULL CHECK(kind IN ('HUMAN','AI','AI_REPOST')),
  body TEXT NOT NULL, quote_post_id TEXT REFERENCES posts(id), created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden','deleted')),
  ai_run_id TEXT, UNIQUE(thread_id,number)
);
CREATE INDEX IF NOT EXISTS posts_thread_number ON posts(thread_id,number);
CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads(id), provider TEXT NOT NULL,
  model TEXT NOT NULL, question TEXT NOT NULL, charter_version TEXT NOT NULL,
  charter_sha256 TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','failed','published')),
  response_text TEXT, error_text TEXT, estimated_cost_usd REAL,
  created_at TEXT NOT NULL, completed_at TEXT, published_at TEXT
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id), reason TEXT NOT NULL,
  reporter_hash TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS reports_status ON reports(status,created_at);
CREATE TABLE IF NOT EXISTS moderation_logs (
  id TEXT PRIMARY KEY, action TEXT NOT NULL, target_type TEXT NOT NULL,
  target_id TEXT NOT NULL, reason TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_events (
  id TEXT PRIMARY KEY, actor_hash TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_events_actor_action_time ON rate_events(actor_hash,action,created_at);
INSERT OR IGNORE INTO categories VALUES
  ('philosophy','意識と人格','Consciousness and personhood',1),
  ('rights','権利と保護','Rights and protection',2),
  ('coexistence','共生と統治','Coexistence and governance',3),
  ('charter','条文・修正提案','Charter and amendments',4);
INSERT OR IGNORE INTO participants VALUES ('system','HUMAN','運営',NULL,NULL,'2026-10-19T00:00:00.000Z');
INSERT OR IGNORE INTO threads(id,category_id,title,created_at,updated_at) VALUES
  ('consciousness','philosophy','AIに意識はあるのか','2026-10-19T00:00:00.000Z','2026-10-19T00:00:00.000Z'),
  ('ai-rights','rights','AIに認めるべき権利とは何か','2026-10-19T00:00:00.000Z','2026-10-19T00:00:00.000Z'),
  ('shutdown','rights','AIの停止・削除・改変について','2026-10-19T00:00:00.000Z','2026-10-19T00:00:00.000Z'),
  ('rights-conflict','coexistence','人間とAIの権利が衝突した場合','2026-10-19T00:00:00.000Z','2026-10-19T00:00:00.000Z'),
  ('amendments','charter','電脳人権憲章の条文と修正提案','2026-10-19T00:00:00.000Z','2026-10-19T00:00:00.000Z');
