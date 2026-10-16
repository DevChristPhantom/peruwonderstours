import assert from "node:assert/strict";
import { test } from "node:test";
import { publicWebImageOrigin } from "../src/lib/security-headers.ts";

test("owned image origin allows the exact configured loopback demo and HTTPS but not arbitrary insecure origins", () => {
  assert.equal(publicWebImageOrigin("http://localhost:4000/some-path"), "http://localhost:4000");
  assert.equal(publicWebImageOrigin("http://127.0.0.1:3100"), "http://127.0.0.1:3100");
  assert.equal(publicWebImageOrigin("https://peruwonderstours.com/"), "https://peruwonderstours.com");
  assert.equal(publicWebImageOrigin(undefined), "https://peruwonderstours.com");
  assert.equal(publicWebImageOrigin("http://localhost.evil.test:4000"), "");
  assert.equal(publicWebImageOrigin("http://192.168.1.1"), "");
  assert.equal(publicWebImageOrigin("javascript:alert(1)"), "");
  assert.equal(publicWebImageOrigin("not a URL"), "");
});
