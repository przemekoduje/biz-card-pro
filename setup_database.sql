-- Create tracking table if it doesn't exist
create table if not exists usage_tracking (
  user_id uuid references auth.users not null primary key,
  total_scans int default 0,
  total_emails int default 0,
  total_images int default 0,
  daily_actions_count int default 0,
  last_action_date date default current_date
);

-- Enable RLS
alter table usage_tracking enable row level security;

-- Drop existing policies to avoid errors on re-run
drop policy if exists "Users can view their own usage" on usage_tracking;
drop policy if exists "Users can insert their own usage" on usage_tracking;
drop policy if exists "Users can update their own usage" on usage_tracking;

-- Allow users to view their own usage
create policy "Users can view their own usage"
on usage_tracking for select
using ( auth.uid() = user_id );

-- Allow users to insert their own usage
create policy "Users can insert their own usage"
on usage_tracking for insert
with check ( auth.uid() = user_id );

-- Allow users to update their own usage
create policy "Users can update their own usage"
on usage_tracking for update
using ( auth.uid() = user_id );

-- Optional: Create a function and trigger to automatically create usage tracking on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.usage_tracking (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid error
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
