CREATE UNIQUE INDEX IF NOT EXISTS posts_ai_run_unique ON posts(ai_run_id) WHERE ai_run_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reports_post_actor_unique ON reports(post_id,reporter_hash);
