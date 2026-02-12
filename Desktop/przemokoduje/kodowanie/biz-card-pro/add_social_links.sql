ALTER TABLE business_cards 
ADD COLUMN IF NOT EXISTS social_links JSONB;

COMMENT ON COLUMN business_cards.social_links IS 'Stores AI-inferred social media links (LinkedIn, IG, FB, YT)';
