-- Enable RLS for business_cards and usage_tracking
ALTER TABLE public.business_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- 1. Create pgvector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add missing columns to business_cards
ALTER TABLE public.business_cards 
ADD COLUMN IF NOT EXISTS social_links JSONB,
ADD COLUMN IF NOT EXISTS ice_breakers JSONB,
ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS follow_up_needed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS follow_up_suggestion TEXT,
ADD COLUMN IF NOT EXISTS search_context TEXT,
ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);

-- 3. Create RLS Policies for business_cards

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own cards" ON public.business_cards;
DROP POLICY IF EXISTS "Users can insert their own cards" ON public.business_cards;
DROP POLICY IF EXISTS "Users can update their own cards" ON public.business_cards;
DROP POLICY IF EXISTS "Users can delete their own cards" ON public.business_cards;

-- Re-create policies
CREATE POLICY "Users can view their own cards" ON public.business_cards FOR SELECT USING ( auth.uid() = user_id );
CREATE POLICY "Users can insert their own cards" ON public.business_cards FOR INSERT WITH CHECK ( auth.uid() = user_id );
CREATE POLICY "Users can update their own cards" ON public.business_cards FOR UPDATE USING ( auth.uid() = user_id );
CREATE POLICY "Users can delete their own cards" ON public.business_cards FOR DELETE USING ( auth.uid() = user_id );

-- 4. Create RLS Policies for usage_tracking

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can update their own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.usage_tracking;

-- Re-create policies
CREATE POLICY "Users can view their own usage" ON public.usage_tracking FOR SELECT USING ( auth.uid() = user_id );
CREATE POLICY "Users can insert their own usage" ON public.usage_tracking FOR INSERT WITH CHECK ( auth.uid() = user_id );
CREATE POLICY "Users can update their own usage" ON public.usage_tracking FOR UPDATE USING ( auth.uid() = user_id );

-- 5. Create index for vector search (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS business_cards_embedding_idx ON public.business_cards USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
