const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Story photos go to Supabase Storage when it's configured (production), and to
// uploads/stories/ on local disk otherwise (local dev). Either way the caller gets
// back the URL to store in stories.image_url.
const UPLOAD_ROOT = path.join(__dirname, "../../uploads");
const STORY_DIR = path.join(UPLOAD_ROOT, "stories");
const LOCAL_PREFIX = "/uploads/stories/";

const bucket = () => process.env.SUPABASE_BUCKET || "stories";
const usingSupabase = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let supabase = null;
function storage() {
  // service-role key: server-side only, never sent to the browser
  if (!supabase) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase.storage.from(bucket());
}

const randomName = (ext) => `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;

async function saveStoryImage(buffer, { ext, contentType }) {
  const name = randomName(ext);

  if (usingSupabase()) {
    const { error } = await storage().upload(name, buffer, { contentType, upsert: false });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    return storage().getPublicUrl(name).data.publicUrl;
  }

  await fs.promises.mkdir(STORY_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(STORY_DIR, name), buffer);
  return LOCAL_PREFIX + name;
}

// best effort — a photo that's already gone is fine; anything else is logged, not thrown
async function removeStoryImage(imageUrl) {
  if (!imageUrl) return;
  try {
    if (imageUrl.startsWith(LOCAL_PREFIX)) {
      await fs.promises.unlink(path.join(STORY_DIR, path.basename(imageUrl)));
      return;
    }
    const marker = `/storage/v1/object/public/${bucket()}/`;
    const at = imageUrl.indexOf(marker);
    if (at !== -1 && usingSupabase()) {
      const objectPath = decodeURIComponent(imageUrl.slice(at + marker.length));
      const { error } = await storage().remove([objectPath]);
      if (error) throw error;
    }
  } catch (err) {
    if (err.code !== "ENOENT") console.error(`Could not delete story image ${imageUrl}:`, err.message);
  }
}

module.exports = { saveStoryImage, removeStoryImage, usingSupabase, UPLOAD_ROOT };
