-- story photos are now uploaded files (uploads/stories/), referenced by URL;
-- image_data stays only so stories posted before this change keep their picture
ALTER TABLE stories ADD COLUMN IF NOT EXISTS image_url TEXT;
