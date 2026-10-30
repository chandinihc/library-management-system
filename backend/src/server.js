const app = require("./app");
const env = require("./config/env");
const pool = require("./config/database");
const { runMaintenance } = require("./jobs/maintenance");

async function start() {
  await pool.query("SELECT 1");
  app.listen(env.PORT, () => {
    console.log(`Library API listening on http://localhost:${env.PORT}`);
    runMaintenance();
    setInterval(runMaintenance, 60 * 60 * 1000).unref();
  });
}

start().catch((error) => {
  console.error("Unable to connect to Supabase PostgreSQL. Verify the backend/.env DATABASE_URL, pooler region/credentials, network access, and TLS settings.", {
    message: error.message,
    code: error.code,
    address: error.address,
    port: error.port
  });
  process.exit(1);
});