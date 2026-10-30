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
  console.error("Unable to start the API. Check the MySQL connection and environment settings.", error);
  process.exit(1);
});
