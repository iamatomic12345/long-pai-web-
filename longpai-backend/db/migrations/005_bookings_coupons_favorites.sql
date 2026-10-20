-- tour catalog, seeded from db/seed/tours-data.js; the server prices bookings from here
CREATE TABLE IF NOT EXISTS tours (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  province VARCHAR(100) NOT NULL,
  region VARCHAR(20) NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0)
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tour_id VARCHAR(20) NOT NULL REFERENCES tours(id),
  pax SMALLINT NOT NULL CHECK (pax BETWEEN 1 AND 20),
  date DATE NOT NULL,
  contact_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  total INTEGER NOT NULL,
  points_earned INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(32) UNIQUE NOT NULL,
  tier_id VARCHAR(10) NOT NULL,
  kind VARCHAR(10) NOT NULL,
  value INTEGER NOT NULL,
  cost INTEGER NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tour_id VARCHAR(20) NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tour_id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_user ON coupons(user_id);
