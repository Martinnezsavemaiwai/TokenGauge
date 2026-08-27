import { describe, it, expect } from "vitest";
import { compareVersions } from "./updates";

describe("compareVersions", () => {
  it.each([
    ["0.2.1", "0.2.0", 1],
    ["0.2.0", "0.2.1", -1],
    ["0.2.0", "0.2.0", 0],
    ["0.10.0", "0.9.9", 1],
    ["1.0", "1.0.0", 0],
  ] as const)("%s vs %s", (a, b, expected) => {
    expect(Math.sign(compareVersions(a, b))).toBe(expected);
  });

  it("does not treat an older published release as an update", () => {
    // The repo's only published release is v0.1.1 while 0.2.x runs locally.
    expect(compareVersions("0.1.1", "0.2.0") > 0).toBe(false);
  });
});
