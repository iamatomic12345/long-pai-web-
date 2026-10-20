-- province centroid, used to verify GPS check-ins with the Haversine formula
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- the coordinates the user actually submitted at check-in time
ALTER TABLE user_visited_provinces ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE user_visited_provinces ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
