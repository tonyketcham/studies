import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

type SliderWithDiscreteInputProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

export function SliderWithDiscreteInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: SliderWithDiscreteInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-row items-center justify-between">
        <Label htmlFor={label}>{label}</Label>
        <Input
          aria-describedby={label}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-18 bg-white/50 dark:bg-neutral-900/50"
        />
      </div>
      <Slider
        id={label}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}
