ALTER TABLE business_cards
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN business_cards.latitude IS 'Latitude of where the card was scanned';
COMMENT ON COLUMN business_cards.longitude IS 'Longitude of where the card was scanned';
