import { describe, it, expect } from "vitest";
import { formatTimeUntil, formatNumber, formatCompact, bucketHour, modelLabel } from "./format";

describe("formatTimeUntil", () => {
  it("returns 'now' for a past or elapsed target", () => {
    expect(formatTimeUntil(new Date(Date.now() - 1000))).toBe("now");
  });

  it("formats days and hours", () => {
    const target = new Date(Date.now() + (5 * 24 + 14) * 3600_000);
    expect(formatTimeUntil(target)).toBe("5d 14h");
  });

  it("speaks Thai when asked", () => {
    const target = new Date(Date.now() + (5 * 24 + 14) * 3600_000 + 30_000);
    expect(formatTimeUntil(target, "th")).toBe("5 วัน 14 ชม.");
    expect(formatTimeUntil(new Date(Date.now() - 1000), "th")).toBe("ตอนนี้");
  });

  it("formats sub-minute as < 1m", () => {
    const target = new Date(Date.now() + 30_000);
    expect(formatTimeUntil(target)).toBe("< 1m");
  });
});

describe("formatNumber", () => {
  it("adds thousands separators", () => {
    expect(formatNumber(6800)).toBe("6,800");
  });
});

describe("bucketHour", () => {
  it("anchors the newest bucket to the snapshot's hour", () => {
    expect(bucketHour(23, 0)).toBe(0); // just past midnight: newest bucket is 12 AM
    expect(bucketHour(23, 14)).toBe(14);
  });

  it("walks backwards across midnight", () => {
    expect(bucketHour(22, 0)).toBe(23); // hour before 12 AM is 11 PM, yesterday
    expect(bucketHour(0, 0)).toBe(1); // oldest bucket is 23 hours back
    expect(bucketHour(0, 14)).toBe(15);
  });
});

describe("modelLabel", () => {
  it("drops the vendor prefix and the release date", () => {
    expect(modelLabel("claude-sonnet-5-20260219")).toBe("Sonnet-5");
  });

  it("leaves an unrecognised id alone apart from its case", () => {
    expect(modelLabel("gpt-5-codex")).toBe("Gpt-5-codex");
  });
});

describe("formatCompact", () => {
  it("shortens counts that are only being compared", () => {
    expect(formatCompact(277_099_237)).toBe("277.1M");
    expect(formatCompact(1_240_000_000)).toBe("1.2B");
  });

  it("keeps small counts exact", () => {
    expect(formatCompact(6_800)).toBe("6,800");
  });
});
