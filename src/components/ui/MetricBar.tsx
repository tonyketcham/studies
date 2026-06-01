import { cn } from '@/lib/utils';

interface MetricBarProps {
  label: string;
  /** Current value (already scaled into the same unit as `max`). */
  value: number;
  max: number;
  /** Tailwind background color class for the fill, e.g. "bg-amber-400". */
  color: string;
  /** Optional formatted value shown on the right (defaults to value.toFixed(1)). */
  display?: string;
  unit?: string;
}

/** Compact labelled progress bar used in the live feedback panel. */
export function MetricBar({
  label,
  value,
  max,
  color,
  display,
  unit,
}: MetricBarProps) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0)) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          {label}
        </span>
        <span className="font-mono text-xs tabular-nums text-neutral-800 dark:text-neutral-200">
          {display ?? value.toFixed(1)}
          {unit && <span className="ml-0.5 text-neutral-500">{unit}</span>}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-300/50 dark:bg-neutral-700/50">
        <div
          className={cn('h-full rounded-full transition-[width] duration-150', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
