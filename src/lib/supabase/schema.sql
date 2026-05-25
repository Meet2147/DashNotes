-- Enable RLS
-- Collections
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null default '#7C3AED',
  created_at timestamptz default now()
);
alter table collections enable row level security;
create policy "Users own collections" on collections for all using (auth.uid() = user_id);

-- Notes
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'Untitled',
  content jsonb not null default '[]',
  collection_id uuid references collections(id) on delete set null,
  tags text[] default '{}',
  color text default '#F3E8FF',
  pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table notes enable row level security;
create policy "Users own notes" on notes for all using (auth.uid() = user_id);

-- AI usage tracking
create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  feature text not null,
  created_at timestamptz default now()
);
alter table ai_usage enable row level security;
create policy "Users own usage" on ai_usage for all using (auth.uid() = user_id);

-- User plans
create table if not exists user_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text default 'free',
  monthly_limit integer default 20,
  razorpay_subscription_id text,
  updated_at timestamptz default now()
);
alter table user_plans enable row level security;
create policy "Users own plan" on user_plans for all using (auth.uid() = user_id);

-- Auto-create plan on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into user_plans (user_id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
