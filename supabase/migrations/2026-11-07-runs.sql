-- Runs (2026-11-07). Idempotent: safe to run more than once in the Supabase
-- SQL editor. schema.sql already includes this for fresh installs; run this
-- file only on a database created before it. Until it runs, the app hides
-- running and shows a note on Home.

-- Runs: their own table, not set_logs — a run is distance × time with a
-- pace, never sets/reps/load, and must stay out of lifting volume and the
-- heat map. Imported from Strava (external_id = "strava:<activity id>",
-- unique so a re-sync never duplicates) or logged by hand.
create table if not exists runs (
  id text primary key,
  client_id text not null,
  date date not null,
  distance_miles double precision not null check (distance_miles > 0),
  duration_seconds int not null check (duration_seconds > 0),
  kind text not null default 'easy' check (kind in ('easy', 'long', 'workout', 'race')),
  avg_heart_rate int,
  elevation_gain_ft int,
  name text not null default '',
  source text not null default 'manual' check (source in ('manual', 'strava')),
  external_id text unique,
  notes text not null default ''
);
create index if not exists runs_client_idx on runs (client_id, date);

alter table runs enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'runs' and policyname = 'anon_all') then
    create policy anon_all on runs for all to anon, authenticated using (true) with check (true);
  end if;
end $$;
