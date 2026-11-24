-- Stale bike warm-ups (2026-11-23). OPTIONAL one-off data cleanup —
-- idempotent, safe to run more than once in the Supabase SQL editor.
--
-- Before the "Skip warm-up" button, a warm-up nobody rode stayed in the
-- session as an unlogged row (e.g. Lidia 2026-11-20). The app now drops an
-- unlogged bike warm-up when a session is finished; this removes the ones
-- left in already-completed sessions, then renumbers what's left exactly the
-- way the app's renumber() does. Logged warm-ups and skipped lifts are kept.

begin;

delete from set_logs s
using sessions ss
where s.session_id = ss.id
  and ss.status = 'completed'
  and s.is_warmup
  and not s.completed
  and s.exercise_id = 'echo_bike'
  and s.modality_id = 'cardio';

-- Positions back to 1..n per session (the unique key is deferred, so one
-- UPDATE can shift every row).
with r as (
  select id, row_number() over (partition by session_id order by position) as p
  from set_logs
)
update set_logs s set position = r.p
from r
where s.id = r.id and s.position <> r.p;

-- set_number restarts per block: same exercise + modality, and the bike
-- warm-up never shares a block with an Echo piece after it (sameBlock()).
with flagged as (
  select id, session_id, position, exercise_id, modality_id,
    (is_warmup and exercise_id = 'echo_bike' and modality_id = 'cardio') as bike_warmup
  from set_logs
), marked as (
  select id, session_id, position,
    case when lag(exercise_id) over w = exercise_id
          and lag(modality_id) over w = modality_id
          and lag(bike_warmup) over w = bike_warmup then 0 else 1 end as starts
  from flagged
  window w as (partition by session_id order by position)
), blocks as (
  select id, session_id, position,
    sum(starts) over (partition by session_id order by position) as block
  from marked
), numbered as (
  select id, row_number() over (partition by session_id, block order by position) as n
  from blocks
)
update set_logs s set set_number = numbered.n
from numbered
where s.id = numbered.id and s.set_number <> numbered.n;

commit;
