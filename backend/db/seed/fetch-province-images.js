/*
 * Regenerates the `image` field in provinces-data.js by searching Wikipedia
 * for each province's `spot` and taking the top search result's page image.
 *
 * This is NOT run automatically by `npm run seed` — it's a one-off tool for
 * refreshing the dataset later. Wikipedia's search occasionally drifts to an
 * unrelated or wrong-province article (e.g. a search for a spot name plus its
 * province matched a completely different province's page), and some correct
 * articles have no registered page image at all. ALWAYS diff the output
 * against the current provinces-data.js and spot-check new URLs before
 * committing — don't blindly overwrite.
 *
 * Usage: node db/seed/fetch-province-images.js > /tmp/province-images.json
 */
const provinces = require("./provinces-data");

const UA = "longpai-educational-project/1.0 (https://github.com/example/longpai; no-reply@example.com)";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchPageImage(query, lang = "th", size = 600, retries = 4) {
  const url = `https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: 1,
    prop: "pageimages",
    pithumbsize: String(size),
    format: "json",
  });

  let delay = 2000;
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429 && attempt < retries - 1) {
      await sleep(delay);
      delay *= 2;
      continue;
    }
    if (!res.ok) return { title: null, imageUrl: null };
    const data = await res.json();
    const pages = data.query?.pages || {};
    const first = Object.values(pages)[0];
    return { title: first?.title || null, imageUrl: first?.thumbnail?.source || null };
  }
  return { title: null, imageUrl: null };
}

async function main() {
  const results = {};
  for (const p of provinces) {
    const query = `${p.spot} ${p.name}`;
    const { title, imageUrl } = await searchPageImage(query);
    results[p.name] = { spot: p.spot, query, matchedTitle: title, image: imageUrl };
    process.stderr.write(`${p.name} -> ${imageUrl ? "OK" : "MISS"} (${title || "no match"})\n`);
    await sleep(1000); // be polite to the API
  }
  console.log(JSON.stringify(results, null, 2));
}

main();
