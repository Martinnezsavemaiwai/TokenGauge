import type { LimitKind, UsageLimit, UsageSnapshot } from "../types/provider";
import type { Language } from "../hooks/useSettings";
import { Mascot } from "./Mascot";
import { formatTimeUntil, timeAgo } from "../lib/format";
import { burnRate } from "../lib/burn";
import { deriveUsageState, displayPercent, moodFor, type Mood } from "../lib/usage-state";
import { t, type StringKey } from "../lib/i18n";

export const LIMIT_LABELS: Record<LimitKind, StringKey> = {
  session: "limitSession",
  weekly: "limitWeekly",
  weekly_opus: "limitWeeklyOpus",
};

const MOOD_WORDS: Record<Mood, StringKey> = {
  happy: "moodHappy",
  worried: "moodWorried",
  alarmed: "moodAlarmed",
  spent: "moodSpent",
  asleep: "moodAsleep",
};

function Percent({ value, size }: { value: number; size: string }) {
  return (
    <span className="pct" data-state={deriveUsageState(value)} style={{ fontSize: size }}>
      {displayPercent(value)}
      <small>%</small>
    </span>
  );
}

function resetLine(limit: UsageLimit, language: Language): string | null {
  if (!limit.resetAt) return null;
  const word = limit.percent >= 100 ? "backIn" : "resetsIn";
  return `${t(language, word)} ${formatTimeUntil(limit.resetAt, language)}`;
}

/** The one line under a character: its pace if that bites, otherwise how it feels. */
function noteFor(limit: UsageLimit, snapshot: UsageSnapshot, language: Language): string {
  if (limit.kind === "session" && limit.percent < 100) {
    const burn = burnRate(snapshot);
    if (burn?.kind === "eta") {
      const at = new Date(Date.now() + burn.minutesToLimit * 60_000);
      return t(language, "burnEta").replace("{time}", formatTimeUntil(at, language));
    }
  }
  return t(language, MOOD_WORDS[moodFor(limit.percent)]);
}

/** The largest reading on the hover popup: whichever limit bites first. */
export function LeadLimit({ limit, language }: { limit: UsageLimit; language: Language }) {
  const reset = resetLine(limit, language);
  return (
    <div className="lead" data-kind={limit.kind}>
      <div className="flex flex-col items-center gap-1 shrink-0" style={{ maxWidth: "10rem" }}>
        <Mascot kind={limit.kind} mood={moodFor(limit.percent)} size={5.5} />
        <span className="plate-name">{t(language, LIMIT_LABELS[limit.kind])}</span>
      </div>
      <div className="flex flex-col items-start gap-1 min-w-0">
        <Percent value={limit.percent} size="3rem" />
        {reset && <span className="meta num">{reset}</span>}
      </div>
    </div>
  );
}

export function LimitChip({ limit, language }: { limit: UsageLimit; language: Language }) {
  const label = t(language, LIMIT_LABELS[limit.kind]);
  return (
    <div className="chip" data-kind={limit.kind} title={label}>
      <Mascot kind={limit.kind} mood={moodFor(limit.percent)} size={1.75} />
      <span className="meta truncate-line flex-1">{label}</span>
      <Percent value={limit.percent} size="0.9375rem" />
    </div>
  );
}

export function LimitCard({
  limit,
  rank,
  snapshot,
  language,
}: {
  limit: UsageLimit;
  rank: number;
  snapshot: UsageSnapshot;
  language: Language;
}) {
  const reset = resetLine(limit, language);
  return (
    <li className="card" data-kind={limit.kind}>
      <span className="rank num" aria-label={t(language, "rank").replace("{rank}", String(rank))}>
        {rank}
      </span>
      <Mascot kind={limit.kind} mood={moodFor(limit.percent)} size={rank === 1 ? 5.5 : 4.25} />
      <span className="plate-name">{t(language, LIMIT_LABELS[limit.kind])}</span>
      <Percent value={limit.percent} size={rank === 1 ? "2.5rem" : "1.875rem"} />
      {reset && <span className="plate-date">{reset}</span>}
      <span className="meta">{noteFor(limit, snapshot, language)}</span>
    </li>
  );
}

/** A sleeping character for when there is nothing measured to show. */
export function NoReading({
  title,
  note,
  language,
  tokens,
  large = false,
}: {
  title: string;
  note?: string;
  language: Language;
  tokens?: number;
  large?: boolean;
}) {
  return (
    <div className={large ? "sleeper" : "lead"} data-kind="session">
      <Mascot kind="session" mood="asleep" size={large ? 8 : 4.25} />
      <div className={`flex flex-col gap-1 min-w-0 ${large ? "items-center" : "items-start"}`}>
        <span className="font-medium text-[0.9375rem] leading-snug">{title}</span>
        {tokens !== undefined && (
          <span className="meta num">
            {tokens.toLocaleString("en-US")} {t(language, "tokensLast5h")}
          </span>
        )}
        {note && <span className="meta">{note}</span>}
      </div>
    </div>
  );
}

/** "Sync paused · 4 min ago", or null while the numbers are fresh. */
export function staleLine(snapshot: UsageSnapshot, language: Language): string | null {
  if (!snapshot.stale) return null;
  if (snapshot.syncAgeSec == null) return t(language, "syncStale");
  const at = timeAgo(new Date(Date.now() - snapshot.syncAgeSec * 1000));
  const age =
    at.kind === "now"
      ? t(language, "justNow")
      : `${at.value} ${t(language, at.kind === "seconds" ? "secAgo" : at.kind === "minutes" ? "minAgo" : "hrAgo")}`;
  return `${t(language, "syncStale")} · ${age}`;
}

/** One sentence for screen readers, so a changed reading is announced once. */
export function LiveSummary({ limit, language }: { limit?: UsageLimit; language: Language }) {
  return (
    <p className="sr-only" role="status" aria-atomic="true">
      {limit
        ? `${t(language, LIMIT_LABELS[limit.kind])}: ${displayPercent(limit.percent)}% ${t(language, "used")}. ${t(language, MOOD_WORDS[moodFor(limit.percent)])}.`
        : t(language, "moodAsleep")}
    </p>
  );
}
