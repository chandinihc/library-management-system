const { Pool } = require("pg");
const fs = require("node:fs");
const path = require("node:path");
const env = require("./env");

const sslCa = env.DATABASE_SSL_CA_PATH
  ? fs.readFileSync(path.resolve(__dirname, "../../", env.DATABASE_SSL_CA_PATH), "utf8")
  : undefined;

const client = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL === "true"
    ? { rejectUnauthorized: false, ...(sslCa ? { ca: sslCa } : {}) }
    : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 30_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000
});

client.on("error", (error) => {
  console.error("Unexpected error from an idle PostgreSQL connection:", error.message, error.code);
});

function toPostgresPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function adaptResult(result) {
  if (result.command === "SELECT" || result.command === "WITH") return [result.rows];
  return [{
    affectedRows: result.rowCount,
    insertId: result.rows[0]?.id
  }];
}

async function execute(sql, values = []) {
  const result = await client.query(toPostgresPlaceholders(sql), values);
  return adaptResult(result);
}

async function getConnection() {
  const connection = await client.connect();
  return {
    execute: async (sql, values = []) => adaptResult(await connection.query(toPostgresPlaceholders(sql), values)),
    query: (sql, values) => connection.query(sql, values),
    beginTransaction: () => connection.query("BEGIN"),
    commit: () => connection.query("COMMIT"),
    rollback: () => connection.query("ROLLBACK"),
    release: () => connection.release()
  };
}

module.exports = {
  query: (sql, values) => client.query(sql, values),
  execute,
  getConnection,
  end: () => client.end()
};
