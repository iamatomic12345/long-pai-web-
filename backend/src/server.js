require("dotenv").config();
const app = require("./app");
const { usingSupabase } = require("./services/storyStorage");

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`longpai API listening on port ${port}`);
  console.log(`story photos → ${usingSupabase() ? "Supabase Storage" : "local disk (uploads/)"}`);
});
