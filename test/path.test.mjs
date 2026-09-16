import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPathInside, isBinaryPath, looksBinary } from "../lib/parse.js";

describe("isPathInside", () => {
  it("accepts the root itself", () => {
    assert.equal(isPathInside("/work", "/work"), true);
  });

  it("accepts files under the root", () => {
    assert.equal(isPathInside("/work", "/work/src/a.ts"), true);
  });

  it("rejects sibling escapes", () => {
    assert.equal(isPathInside("/work", "/work-other/a.ts"), false);
  });

  it("rejects parent escapes", () => {
    assert.equal(isPathInside("/work", "/etc/passwd"), false);
  });
});

describe("binary policy", () => {
  it("treats png as binary by extension", () => {
    assert.equal(isBinaryPath("/work/a.png"), true);
    assert.equal(isBinaryPath("/work/a.ts"), false);
  });

  it("detects nul bytes", () => {
    assert.equal(looksBinary(Buffer.from([65, 0, 66])), true);
    assert.equal(looksBinary(Buffer.from("hello\n")), false);
  });
});
