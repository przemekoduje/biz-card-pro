-- Enable RLS
alter table usage_tracking enable row level security;

-- Allow users to view their own data
create policy "Users can view their own usage"
on usage_tracking for select
using ( auth.uid() = user_id );

-- Allow users to insert their own data (if triggering via client)
create policy "Users can insert their own usage"
on usage_tracking for insert
with check ( auth.uid() = user_id );

-- Allow users to update their own data
create policy "Users can update their own usage"
on usage_tracking for update
using ( auth.uid() = user_id );
