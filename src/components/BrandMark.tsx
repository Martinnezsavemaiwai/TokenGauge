interface BrandMarkProps {
  size?: number;
  /** Fraction of the arc that reads as filled, 0–1. The static mark sits at 0.6. */
  fill?: number;
  className?: string;
}

const CENTER = 12;
const RADIUS = 9;
const NEEDLE = 6;
/** Open-bottom gauge: 135° → 405°, i.e. 270° of sweep. */
const START = 135;
const SWEEP = 270;

function point(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)] as const;
}

function arc(fromDeg: number, toDeg: number) {
  const [x1, y1] = point(fromDeg, RADIUS);
  const [x2, y2] = point(toDeg, RADIUS);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${RADIUS} ${RADIUS} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * The TokenGauge mark — an open gauge arc with a needle.
 *
 * This is the product's own geometry, not a provider's: it stays the same
 * whether the instrument is pointed at Claude Code, Codex, or anything after.
 */
export function BrandMark({ size = 20, fill = 0.6, className }: BrandMarkProps) {
  const end = START + SWEEP * Math.min(1, Math.max(0, fill));
  const [nx, ny] = point(end, NEEDLE);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role="img"
      aria-label="TokenGauge"
    >
      <path
        d={arc(START, START + SWEEP)}
        stroke="var(--color-ring-track)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d={arc(START, end)}
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d={`M${CENTER} ${CENTER} L${nx.toFixed(2)} ${ny.toFixed(2)}`}
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx={CENTER} cy={CENTER} r="1.5" fill="var(--color-accent)" />
    </svg>
  );
}
