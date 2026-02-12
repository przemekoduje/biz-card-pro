ALTER TABLE business_cards 
ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS follow_up_needed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS follow_up_suggestion TEXT;

COMMENT ON COLUMN business_cards.follow_up_suggestion IS 'AI suggested follow-up time/action';
