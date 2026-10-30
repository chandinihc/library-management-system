const test = require("node:test");
const assert = require("node:assert/strict");
const { makeId } = require("../src/utils/identifiers");

test("makeId uses its requested prefix and a unique uppercase suffix", () => {
  const first = makeId("BK");
  const second = makeId("BK");
  assert.match(first, /^BK-[0-9A-F]{8}$/);
  assert.notEqual(first, second);
});
