CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provinces (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  region VARCHAR(20) NOT NULL,
  spot VARCHAR(150),
  grid_col SMALLINT,
  grid_row SMALLINT
);

CREATE TABLE IF NOT EXISTS user_visited_provinces (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  province_id INTEGER NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, province_id)
);

CREATE TABLE IF NOT EXISTS stories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  province_id INTEGER REFERENCES provinces(id) ON DELETE SET NULL,
  caption TEXT,
  emoji VARCHAR(10),
  image_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visited_user ON user_visited_provinces(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at DESC);
