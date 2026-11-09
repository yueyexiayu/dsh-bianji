import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPathInside, isBinaryPath, looksBinary, mediaContentType } from "../lib/parse.js";

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

  it("detects nul bytes anywhere in an editable file", () => {
    assert.equal(looksBinary(Buffer.from([65, 0, 66])), true);
    assert.equal(looksBinary(Buffer.concat([Buffer.alloc(9000, 65), Buffer.from([0])])), true);
    assert.equal(looksBinary(Buffer.from("hello\n")), false);
  });

  it("detects unsupported control bytes beyond the sample window", () => {
    assert.equal(looksBinary(Buffer.concat([Buffer.alloc(9000, 65), Buffer.from([1])])), true);
  });
});

describe("media types", () => {
  it("uses the container MIME type instead of treating every AAC or MOV as MP4", () => {
    assert.equal(mediaContentType("audio", "aac"), "audio/aac");
    assert.equal(mediaContentType("audio", "m4a"), "audio/mp4");
    assert.equal(mediaContentType("video", "mov"), "video/quicktime");
    assert.equal(mediaContentType("video", "m4v"), "video/mp4");
  });
});
