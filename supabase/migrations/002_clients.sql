-- Clients graduate from TypeScript reference data to a real table so the app
-- can add and edit people (and give each a card color). Ids stay readable
-- text slugs; other tables keep referencing client_id as plain text.
--
-- This migration seeds the existing roster itself (idempotently), because
-- /dev/seed refuses to touch a database that already has data.

create table clients (
  id text primary key,
  first_name text not null,
  last_name text not null default '',
  status text not null default 'active' check (status in ('active', 'inactive')),
  join_date date not null,
  date_of_birth date not null,
  height_inches numeric not null,
  experience_level text not null check (experience_level in ('beginner', 'intermediate', 'advanced')),
  goal text not null check (goal in ('general-fitness', 'strength', 'hypertrophy', 'fat-loss')),
  is_trainer boolean not null default false,
  color text,
  notes text not null default ''
);

-- RLS: same posture as 001 — enabled, with a permissive anon policy. This is
-- a single-household personal app; the policy exists so the publishable key
-- keeps working with RLS on. Without a policy, RLS would silently return
-- zero rows to the app.
alter table clients enable row level security;
create policy anon_all on clients for all to anon, authenticated using (true) with check (true);

insert into clients (id, first_name, last_name, status, join_date, date_of_birth, height_inches, experience_level, goal, is_trainer, color, notes) values
  ('lidia',   'Lidia',   '', 'active', '2025-01-15', '1995-06-01', 64, 'beginner',     'general-fitness', false, '#ec4899', ''),
  ('gabriel', 'Gabriel', '', 'active', '2026-05-10', '1993-03-15', 72, 'beginner',     'strength',        false, '#14b8a6', ''),
  ('vivica',  'Vivica',  '', 'active', '2026-02-14', '1998-09-20', 66, 'beginner',     'hypertrophy',     false, '#8b5cf6', ''),
  ('nate',    'Nate',    '', 'active', '2024-11-01', '1992-01-10', 71, 'intermediate', 'strength',        true,  '#3987e5', '')
on conflict (id) do nothing;
