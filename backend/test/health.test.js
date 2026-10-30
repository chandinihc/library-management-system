process.env.JWT_SECRET = "test-secret-value-that-is-at-least-thirty-two-characters";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:5432/library_management";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../src/app");

test("health endpoint returns service status without database fixture data", async () => {
  const response = await request(app).get("/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok", service: "library-management-api" });
});

test("catalog endpoints require authentication", async () => {
  const response = await request(app).get("/api/books");
  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authentication is required.");
});
