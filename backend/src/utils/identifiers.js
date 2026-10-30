const crypto = require("node:crypto");

function makeId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

module.exports = { makeId };
