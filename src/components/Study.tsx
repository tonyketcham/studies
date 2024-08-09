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
        <div className="m-4 w-80">
          <section className="w-full border shadow-lg pointer-events-auto rounded-xl bg-white/60 dark:border-neutral-900 outline outline-1 outline-offset-2 outline-neutral-400 dark:bg-neutral-900/40 dark:outline-neutral-600 backdrop-blur-lg">
            {sidebarChildren}
          </section>
        </div>
      </div>
    </>
  );
}
