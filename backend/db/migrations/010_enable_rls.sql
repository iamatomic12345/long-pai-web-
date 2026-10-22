-- Row Level Security on every table in public, so Supabase's auto-generated REST API
-- (PostgREST, reachable with the project's anon key) can't read or write them.
-- No policies on purpose: with RLS on and no policy, the anon/authenticated roles see
-- nothing. The backend connects as postgres, the tables' owner, which RLS doesn't apply to.
-- Re-runnable: enabling RLS twice is a no-op, and tables added later get it on the next run.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
