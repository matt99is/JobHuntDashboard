-- Enable pg_cron extension (run once in Supabase SQL Editor)
-- Go to: Supabase Dashboard → SQL Editor → New Query

-- 1. Enable the extension (if not already enabled)
-- Note: This requires database admin privileges
-- You may need to enable this in the Supabase dashboard under Database → Extensions

-- 2. Create the auto-ghost function
CREATE OR REPLACE FUNCTION auto_ghost_jobs()
RETURNS void AS $$
BEGIN
  UPDATE jobs
  SET
    status = 'ghosted',
    outcome_notes = COALESCE(outcome_notes || E'\n', '') || 'Auto-ghosted after 30 days no response on ' || NOW()::date
  WHERE status = 'awaiting'
    AND applied_at < NOW() - INTERVAL '30 days';

  -- Optional: Log the count
  RAISE NOTICE 'Auto-ghosted % jobs', (SELECT count(*) FROM jobs WHERE status = 'ghosted' AND updated_at::date = NOW()::date);
END;
$$ LANGUAGE plpgsql;

-- 3. Schedule it to run daily at 2 AM UTC
-- Note: pg_cron might not be available on all Supabase plans
-- Check: https://supabase.com/docs/guides/database/extensions/pgcron

SELECT cron.schedule(
  'auto-ghost-jobs-daily',  -- Job name
  '0 2 * * *',              -- Cron expression: 2 AM daily
  $$SELECT auto_ghost_jobs()$$
);

-- To check scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('auto-ghost-jobs-daily');
