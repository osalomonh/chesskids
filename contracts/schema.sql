-- Contract: database shape. Owned by the backend agent and the project lead.
-- Design rule that overrides convenience everywhere below:
-- the child is not a data subject. We store the minimum needed to run the
-- product and nothing that identifies a real human under 13.
--
-- Explicitly NOT stored about a child: email, last name, date of birth,
-- photo, voice, location, device id, free-typed text of any kind.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Parents. This is the only account with real credentials.
-- Supabase auth.users holds the email and password. We keep the rest here.
-- ---------------------------------------------------------------------------
create table public.parents (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text,
  locale         text not null default 'en',
  coppa_consent_at        timestamptz,
  coppa_consent_method    text,          -- 'card_verification' | 'signed_form' | 'gov_id'
  marketing_opt_in        boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Children. Owned by a parent. No independent credentials in v1: the child
-- plays inside the parent's authenticated session via a profile switcher,
-- and a parental gate guards anything outside the play area.
-- age_band, not birthdate. A band is enough to gate content and is far less
-- identifying than a date.
-- ---------------------------------------------------------------------------
create table public.children (
  id             uuid primary key default gen_random_uuid(),
  parent_id      uuid not null references public.parents(id) on delete cascade,
  first_name     text not null check (char_length(first_name) between 1 and 24),
  avatar_key     text not null,          -- index into a fixed set of app-supplied avatars
  age_band       text not null check (age_band in ('6-7', '8-9', '10+')),
  created_at     timestamptz not null default now(),
  archived_at    timestamptz
);
create index on public.children (parent_id);

-- ---------------------------------------------------------------------------
-- Curriculum progress. unit_id references curriculum.json and is stable forever.
-- ---------------------------------------------------------------------------
create table public.unit_progress (
  child_id       uuid not null references public.children(id) on delete cascade,
  unit_id        text not null,
  status         text not null default 'locked'
                   check (status in ('locked', 'available', 'in_progress', 'mastered')),
  attempts       integer not null default 0,
  correct        integer not null default 0,
  hints_used     integer not null default 0,
  first_seen_at  timestamptz,
  mastered_at    timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (child_id, unit_id)
);

-- ---------------------------------------------------------------------------
-- Puzzle attempts. Puzzles themselves live in a public read-only table
-- seeded from the Lichess CC0 export, so we store only the reference.
-- ---------------------------------------------------------------------------
create table public.puzzles (
  puzzle_id      text primary key,       -- Lichess PuzzleId
  fen            text not null,
  moves          text not null,          -- space-separated UCI
  rating         integer not null,
  themes         text[] not null default '{}',
  ply            smallint not null,
  approved       boolean not null default false  -- curation gate; see note below
);
create index on public.puzzles using gin (themes);
create index on public.puzzles (rating) where approved;

create table public.puzzle_attempts (
  id             bigserial primary key,
  child_id       uuid not null references public.children(id) on delete cascade,
  puzzle_id      text not null references public.puzzles(puzzle_id),
  unit_id        text,
  solved         boolean not null,
  ms_taken       integer,
  hints_used     smallint not null default 0,
  rating_before  integer,
  rating_after   integer,
  created_at     timestamptz not null default now()
);
create index on public.puzzle_attempts (child_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Ratings. Glicko-style so a small number of games still moves the number.
-- Shown to the child as a level or belt, never as a raw number that can drop.
-- Children this age quit when a visible number goes down.
-- ---------------------------------------------------------------------------
create table public.child_ratings (
  child_id       uuid primary key references public.children(id) on delete cascade,
  puzzle_rating  integer not null default 400,
  puzzle_rd      integer not null default 250,
  game_rating    integer not null default 400,
  game_rd        integer not null default 250,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Games against bots. PGN only. No opponent is ever another child in v1:
-- child-to-child play is a moderation and COPPA surface we are not opening yet.
-- ---------------------------------------------------------------------------
create table public.games (
  id             uuid primary key default gen_random_uuid(),
  child_id       uuid not null references public.children(id) on delete cascade,
  bot_id         text not null,
  child_color    char(1) not null check (child_color in ('w', 'b')),
  pgn            text not null,
  result         text check (result in ('win', 'loss', 'draw', 'abandoned')),
  started_at     timestamptz not null default now(),
  ended_at       timestamptz
);
create index on public.games (child_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Coach output. Generated server-side, stored, and reviewed before display.
-- Never stream raw model output straight to a 7-year-old's screen.
-- ---------------------------------------------------------------------------
create table public.coach_notes (
  id             uuid primary key default gen_random_uuid(),
  child_id       uuid not null references public.children(id) on delete cascade,
  game_id        uuid references public.games(id) on delete cascade,
  audience       text not null check (audience in ('child', 'parent')),
  body           text not null,
  safety_status  text not null default 'pending'
                   check (safety_status in ('pending', 'approved', 'blocked')),
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security. On for everything. A parent reaches only their own rows.
-- ---------------------------------------------------------------------------
alter table public.parents         enable row level security;
alter table public.children        enable row level security;
alter table public.unit_progress   enable row level security;
alter table public.puzzle_attempts enable row level security;
alter table public.child_ratings   enable row level security;
alter table public.games           enable row level security;
alter table public.coach_notes     enable row level security;
alter table public.puzzles         enable row level security;

create policy parents_self on public.parents
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy children_own on public.children
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());

-- One helper, reused by every child-scoped table.
create or replace function public.owns_child(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.children
                 where id = c and parent_id = auth.uid());
$$;

create policy progress_own   on public.unit_progress
  for all using (owns_child(child_id)) with check (owns_child(child_id));
create policy attempts_own   on public.puzzle_attempts
  for all using (owns_child(child_id)) with check (owns_child(child_id));
create policy ratings_own    on public.child_ratings
  for all using (owns_child(child_id)) with check (owns_child(child_id));
create policy games_own      on public.games
  for all using (owns_child(child_id)) with check (owns_child(child_id));

-- Coach notes are written only by the service role, read by the owning parent.
create policy coach_read_own on public.coach_notes
  for select using (owns_child(child_id) and safety_status = 'approved');

-- Puzzles are public reference data, but only the approved subset is readable.
create policy puzzles_read on public.puzzles
  for select using (approved);

-- ---------------------------------------------------------------------------
-- Note on `puzzles.approved`:
-- The Lichess corpus is 6M+ puzzles drawn from real adult games. Positions are
-- fine, but the GameUrl and OpeningTags fields link back to public adult
-- profiles. Import FEN, moves, rating, themes, and ply only. Drop the rest at
-- the ETL step, then approve the filtered subset (rating <= 1200, ply <= 3,
-- popularity >= 80) for use in the app.
-- ---------------------------------------------------------------------------