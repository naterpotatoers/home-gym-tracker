-- Effort check-in columns. Only needed if 001 was run before these columns
-- were folded into it — safe to run either way.
alter table sessions add column if not exists rpe int check (rpe between 1 and 10);
alter table sessions add column if not exists condition text
  check (condition in ('rough', 'tired', 'normal', 'good', 'great'));
