import { RichPathData } from '@/components/breadcrumb/breadcrumb';
import { Crumbs } from '@/components/breadcrumb/Crumbs';
import { Header } from '@/components/header/Header';
import { PropsWithChildren, ReactNode, useState } from 'react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Study({
  path,
  children,
  sidebarChildren,
}: PropsWithChildren<{ path: RichPathData[]; sidebarChildren: ReactNode }>) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

        {/* Desktop Sidebar */}
        <div className="hidden lg:block m-4 w-80">
          <section className="w-full border shadow-lg pointer-events-auto rounded-xl bg-white/60 dark:border-neutral-900 outline outline-1 outline-offset-2 outline-neutral-400 dark:bg-neutral-900/40 dark:outline-neutral-600 backdrop-blur-lg">
            {sidebarChildren}
          </section>
        </div>
      </div>

      {/* Mobile Hamburger Menu Button */}
      <button
        className="lg:hidden fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-auto bg-white/60 dark:bg-neutral-900/60 backdrop-blur-lg border border-neutral-200 dark:border-neutral-700 rounded-full p-3 shadow-lg hover:bg-white/80 dark:hover:bg-neutral-900/80 transition-colors"
        onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        aria-label="Toggle sidebar"
      >
        <Settings className="w-6 h-6 text-neutral-700 dark:text-neutral-300" />
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 pointer-events-auto"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-auto transform transition-transform duration-300 ease-in-out",
          isMobileSidebarOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        <section className="mx-4 mb-20 max-h-[70vh] overflow-y-auto border shadow-lg rounded-xl bg-white/95 dark:border-neutral-900 outline outline-1 outline-offset-2 outline-neutral-400 dark:bg-neutral-900/95 dark:outline-neutral-600 backdrop-blur-lg">
          {sidebarChildren}
        </section>
      </div>
    </>
  );
}
