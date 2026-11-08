import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  note: string;
}

/** What a surface says when it has read its source and found nothing to draw. */
export function EmptyState({ icon, title, note }: EmptyStateProps) {
  return (
    <div className="well flex-1">
      <span style={{ color: "var(--ink-2)" }}>{icon}</span>
      <span className="text-[0.8125rem] font-medium">{title}</span>
      <span className="meta max-w-[18rem]">{note}</span>
    </div>
  );
}

export function ChartGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 4-6" />
    </svg>
  );
}

export function StackGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="4.5" rx="1.5" />
      <rect x="3" y="12" width="13" height="4.5" rx="1.5" />
      <rect x="3" y="19" width="7" height="1.5" rx="0.75" />
    </svg>
  );
}
