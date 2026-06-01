import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

interface BaseProps<T extends string> {
  label?: string;
  options: ToggleOption<T>[];
  className?: string;
}

interface SingleProps<T extends string> extends BaseProps<T> {
  type?: 'single';
  value: T;
  onChange: (value: T) => void;
}

interface MultipleProps<T extends string> extends BaseProps<T> {
  type: 'multiple';
  values: T[];
  onToggle: (value: T) => void;
}

type ToggleGroupProps<T extends string> = SingleProps<T> | MultipleProps<T>;

/**
 * A lightweight segmented button group built on the existing Button styling.
 * Supports a single-select mode (radio-like) and a multiple-select mode
 * (independent toggles), matching the neutral / glassy theme of the app.
 */
export function ToggleGroup<T extends string>(props: ToggleGroupProps<T>) {
  const { label, options, className } = props;

  const isActive = (value: T) =>
    props.type === 'multiple'
      ? props.values.includes(value)
      : props.value === value;

  const handle = (value: T) => {
    if (props.type === 'multiple') props.onToggle(value);
    else props.onChange(value);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label className="text-sm">{label}</Label>}
      <div className="inline-flex w-full p-0.5 rounded-lg bg-neutral-200/60 dark:bg-neutral-800/60">
        {options.map((opt) => {
          const active = isActive(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => handle(opt.value)}
              className={cn(
                'flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-950 dark:focus-visible:ring-neutral-300',
                active
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-50 dark:text-neutral-900'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
