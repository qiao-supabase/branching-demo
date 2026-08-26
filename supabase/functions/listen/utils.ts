import postgres from "https://deno.land/x/postgresjs/mod.js";

const connString = Deno.env.get("SUPABASE_DB_URL") || "";

const sql = postgres(connString, {});
await sql.listen("jobs", (payload) => {
  console.log(payload);
});
