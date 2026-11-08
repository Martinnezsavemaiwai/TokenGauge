import { useRef } from "react";
import type { LimitKind } from "../types/provider";
import type { Mood } from "../lib/usage-state";

interface MascotProps {
  kind: LimitKind;
  mood: Mood;
  /** Rem, so the character scales with Windows text size. */
  size: number;
}

const sticker = { stroke: "var(--sticker)", strokeWidth: 5, strokeLinejoin: "round", paintOrder: "stroke" } as const;
const BELLY = { cx: 50, cy: 74, rx: 20, ry: 11, fill: "var(--ribbon-2)" };

/** Everything but the face: one silhouette, one second tone, one feature each. */
function Body({ kind }: { kind: LimitKind }) {
  if (kind === "session") {
    // A round bun with a leaf: the short window that keeps coming back.
    return (
      <>
        <path d="M52 17c5-11 16-13 23-9-2 10-12 16-23 9Z" fill="var(--opus)" {...sticker} />
        <path d="M50 19c22 0 40 16 40 36 0 21-18 33-40 33S10 76 10 55c0-20 18-36 40-36Z" fill="var(--ribbon)" {...sticker} />
        <ellipse {...BELLY} />
      </>
    );
  }
  if (kind === "weekly") {
    // A soft mochi with ears: the steady week.
    return (
      <>
        <circle cx="27" cy="22" r="12" fill="var(--ribbon-2)" {...sticker} />
        <circle cx="73" cy="22" r="12" fill="var(--ribbon-2)" {...sticker} />
        <path d="M36 18h28c15 0 24 9 24 24v22c0 15-9 24-24 24H36c-15 0-24-9-24-24V42c0-15 9-24 24-24Z" fill="var(--ribbon)" {...sticker} />
        <ellipse {...BELLY} />
      </>
    );
  }
  // A little ghost with a crown: the rare, heavy one.
  return (
    <>
      <path d="M50 16c20 0 34 15 34 35v35c0 5-6 6-9 2-3-4-8-4-11 0-4 5-10 5-14 0-3-4-8-4-11 0-4 5-10 5-14 0-3-4-9-3-9-2V51c0-20 14-35 34-35Z" fill="var(--ribbon)" {...sticker} />
      <path d="M37 21l-3-15 9 6 7-9 7 9 9-6-3 15Z" fill="var(--butter)" {...sticker} strokeWidth={3.5} />
    </>
  );
}

function Face({ mood }: { mood: Mood }) {
  const ink = { stroke: "var(--on-ribbon)", strokeWidth: 3.5, strokeLinecap: "round", fill: "none" } as const;
  const dot = { fill: "var(--on-ribbon)" };

  return (
    <>
      <ellipse cx="29" cy="60" rx="6" ry="4" fill="var(--cheek)" />
      <ellipse cx="71" cy="60" rx="6" ry="4" fill="var(--cheek)" />

      {mood === "happy" && (
        <>
          <circle cx="37" cy="50" r="4" {...dot} />
          <circle cx="63" cy="50" r="4" {...dot} />
          <path d="M43 60c3 5 11 5 14 0" {...ink} />
        </>
      )}

      {mood === "worried" && (
        <>
          <circle cx="37" cy="51" r="4" {...dot} />
          <circle cx="63" cy="51" r="4" {...dot} />
          <path d="M30 40l10-4M70 40l-10-4" {...ink} />
          <path d="M43 64c4-3 10-3 14 0" {...ink} />
          <path d="M82 28c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12Z" fill="var(--tear)" stroke="var(--sticker)" strokeWidth="2" paintOrder="stroke" />
        </>
      )}

      {mood === "alarmed" && (
        <>
          <circle cx="37" cy="50" r="6" fill="#fff" stroke="var(--on-ribbon)" strokeWidth="2.5" />
          <circle cx="63" cy="50" r="6" fill="#fff" stroke="var(--on-ribbon)" strokeWidth="2.5" />
          <circle cx="37" cy="50" r="2.2" {...dot} />
          <circle cx="63" cy="50" r="2.2" {...dot} />
          <ellipse cx="50" cy="65" rx="5" ry="6" {...dot} />
        </>
      )}

      {mood === "spent" && (
        <>
          <path d="M32 45l10 10M42 45L32 55M58 45l10 10M68 45L58 55" {...ink} />
          <path d="M42 65h16" {...ink} />
        </>
      )}

      {mood === "asleep" && (
        <>
          <path d="M31 51c3 3 9 3 12 0M57 51c3 3 9 3 12 0" {...ink} />
          <path d="M45 63c3 2 7 2 10 0" {...ink} />
          <path d="M84 4h10L84 16h10" {...ink} stroke="var(--ink)" strokeWidth={3} />
        </>
      )}
    </>
  );
}

/**
 * One character per metered window. Its face is decided by the same thresholds
 * as everything else, and always sits beside the number and words, so the mood
 * is never the only way to read the state. It gives one bounce when its mood
 * actually changes, never just for appearing.
 */
export function Mascot({ kind, mood, size }: MascotProps) {
  const seen = useRef(mood);
  const changed = useRef(false);
  if (seen.current !== mood) {
    seen.current = mood;
    changed.current = true;
  }

  return (
    <svg
      key={mood}
      className={changed.current ? "mascot mascot-bounce" : "mascot"}
      data-mood={mood}
      viewBox="0 0 100 100"
      style={{ width: `${size}rem`, height: `${size}rem` }}
      aria-hidden="true"
    >
      <Body kind={kind} />
      <Face mood={mood} />
    </svg>
  );
}
