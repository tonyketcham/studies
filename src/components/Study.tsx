import { RichPathData } from '@/components/breadcrumb/breadcrumb';
import { Crumbs } from '@/components/breadcrumb/Crumbs';
import { Header } from '@/components/header/Header';
import { PropsWithChildren, ReactNode } from 'react';

export function Study({
  path,
  children,
  sidebarChildren,
}: PropsWithChildren<{ path: RichPathData[]; sidebarChildren: ReactNode }>) {
  return (
    <>
      {/* Study Sheet */}
      <div className="h-full">{children}</div>

      {/* UI layer */}
      <div className="absolute inset-0 flex flex-row pointer-events-none">
        <div className="flex-1">
          <Header className="pointer-events-auto">
            <Crumbs path={path} />
          </Header>
        </div>
        <section className="m-4 border shadow-lg pointer-events-auto rounded-xl w-80 bg-white/60 border-neutral-400 dark:bg-neutral-900/30 dark:border-neutral-700 backdrop-blur-md">
          {sidebarChildren}
        </section>
      </div>
    </>
  );
}
