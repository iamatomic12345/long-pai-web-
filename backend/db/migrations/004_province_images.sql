-- real photo of each province's featured spot (Wikimedia Commons), used by the
-- frontend's "รูปสถานที่แนะนำ" card; null means fall back to the gradient placeholder
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS image_url TEXT;
