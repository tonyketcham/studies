import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';
import { PropsWithChildren } from 'react';

export function Header({
  className,
  children,
}: PropsWithChildren<{
  className?: string;
}>) {
  return (
    <header
      className={cn(
        'flex flex-row items-center px-4 py-2 space-x-4',
        className
      )}
    >
      {children}
      <ThemeToggle />
    </header>
  );
}
