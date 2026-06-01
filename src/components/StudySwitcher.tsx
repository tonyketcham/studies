import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { studies } from '@/studies/registry';

interface StudySwitcherProps {
  activeId: string;
  onChange: (id: string) => void;
}

/** Sidebar dropdown for switching between the registered studies. */
export function StudySwitcher({ activeId, onChange }: StudySwitcherProps) {
  return (
    <div className="p-4 border-b border-neutral-300/60 dark:border-neutral-700/60">
      <Select value={activeId} onValueChange={onChange}>
        <SelectTrigger className="bg-white/40 dark:bg-neutral-900/40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {studies.map((study) => (
            <SelectItem key={study.id} value={study.id}>
              {study.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
