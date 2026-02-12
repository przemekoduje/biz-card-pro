-- Enable RLS for business_cards
alter table public.business_cards enable row level security;

-- Drop existing policies if any
drop policy if exists "Users can view their own cards" on public.business_cards;
drop policy if exists "Users can insert their own cards" on public.business_cards;
drop policy if exists "Users can update their own cards" on public.business_cards;
drop policy if exists "Users can delete their own cards" on public.business_cards;

-- Create policies

-- SELECT: Users can only see cards where user_id matches their auth.uid()
create policy "Users can view their own cards"
on public.business_cards for select
using ( auth.uid() = user_id );

-- INSERT: Users can only insert cards if they assign them to themselves
create policy "Users can insert their own cards"
on public.business_cards for insert
with check ( auth.uid() = user_id );

-- UPDATE: Users can only update their own cards
create policy "Users can update their own cards"
on public.business_cards for update
using ( auth.uid() = user_id );

-- DELETE: Users can only delete their own cards
create policy "Users can delete their own cards"
on public.business_cards for delete
using ( auth.uid() = user_id );
