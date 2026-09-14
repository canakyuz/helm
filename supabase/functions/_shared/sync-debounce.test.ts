import { describe, expect, it } from "bun:test";
import { isRecentSync } from "./sync-debounce";

const WINDOW = 30 * 60 * 1000; // 30 dk

describe("isRecentSync", () => {
  it("lastSyncedAt yoksa (null/undefined) false doner", () => {
    expect(isRecentSync(null, new Date(), WINDOW)).toBe(false);
    expect(isRecentSync(undefined, new Date(), WINDOW)).toBe(false);
  });

  it("10 dk once senkron olduysa true doner", () => {
    const now = new Date("2026-09-14T12:00:00.000Z");
    const tenMinAgo = new Date("2026-09-14T11:50:00.000Z").toISOString();
    expect(isRecentSync(tenMinAgo, now, WINDOW)).toBe(true);
  });

  it("31 dk once senkron olduysa false doner", () => {
    const now = new Date("2026-09-14T12:00:00.000Z");
    const thirtyOneMinAgo = new Date("2026-09-14T11:29:00.000Z").toISOString();
    expect(isRecentSync(thirtyOneMinAgo, now, WINDOW)).toBe(false);
  });

  it("gecersiz tarih string'i false doner", () => {
    expect(isRecentSync("not-a-date", new Date(), WINDOW)).toBe(false);
  });
});
