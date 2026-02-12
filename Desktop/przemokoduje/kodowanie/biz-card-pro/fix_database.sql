-- Force creation of the tracking table
-- We use IF NOT EXISTS, but if the table is "missing" according to API, it might not be there at all.

create table if not exists public.usage_tracking (
  user_id uuid references auth.users not null primary key,
  total_scans int default 0,
  total_emails int default 0,
  total_images int default 0,
  daily_actions_count int default 0,
  last_action_date date default current_date
);

-- Enable RLS
alter table public.usage_tracking enable row level security;

-- Drop existing policies to avoid errors on re-run
drop policy if exists "Users can view their own usage" on public.usage_tracking;
drop policy if exists "Users can insert their own usage" on public.usage_tracking;
drop policy if exists "Users can update their own usage" on public.usage_tracking;

-- Allow users to view their own usage
create policy "Users can view their own usage"
on public.usage_tracking for select
using ( auth.uid() = user_id );

-- Allow users to insert their own usage
create policy "Users can insert their own usage"
on public.usage_tracking for insert
with check ( auth.uid() = user_id );

-- Allow users to update their own usage
create policy "Users can update their own usage"
on public.usage_tracking for update
using ( auth.uid() = user_id );
