import { useMemo, useState } from "react";
import { MockProvider, type MockScene } from "../providers/mock";
import { useUsage } from "../hooks/useUsage";
import { HoverPanel } from "../components/HoverPanel";
import { ClickPanel } from "../components/ClickPanel";

const EMPTY = { usedPercent: 0, remainingPercent: 100 };

/** Both panels on mock data. `?percent=75&scene=stale`. Lazy-loaded in dev only. */
export default function DevHarness() {
  const params = new URLSearchParams(window.location.search);
  const scene = (params.get("scene") ?? "normal") as MockScene;
  const [percent, setPercent] = useState(Number(params.get("percent") ?? 75));
  const provider = useMemo(() => new MockProvider(percent, scene), [percent, scene]);
  const { snapshot, state } = useUsage(provider);

  return (
    <div className="flex flex-col gap-4 p-4" style={{ background: "#6b6f7a" }}>
      <input type="range" min="0" max="100" value={percent} onChange={(e) => setPercent(Number(e.target.value))} aria-label="Mock usage" />
      <div className="flex gap-4 items-end">
        <HoverPanel snapshot={snapshot ?? EMPTY} state={state} />
        <ClickPanel provider={provider} snapshot={snapshot ?? EMPTY} state={state} onClose={() => {}} />
      </div>
    </div>
  );
}
