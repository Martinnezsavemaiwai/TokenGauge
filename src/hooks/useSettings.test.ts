import { describe, it, expect, vi } from "vitest";

describe("settingsStore", () => {
  it("reaches every subscriber in the window that made the change", async () => {
    vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal("localStorage", { getItem: () => null, setItem() {} });
    const { settingsStore } = await import("./useSettings");

    let notified = 0;
    const offA = settingsStore.subscribe(() => notified++);
    const offB = settingsStore.subscribe(() => notified++);
    settingsStore.update({ providerId: "codex" });
    offA();
    offB();

    expect(settingsStore.get().providerId).toBe("codex");
    expect(notified).toBe(2);
    vi.unstubAllGlobals();
  });
});
