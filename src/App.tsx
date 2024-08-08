import { Portal } from '@/components/portal/portal';
import { Study } from '@/components/Study';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { studyLSystem } from '@/studies/l-systems/index';

function App() {
  return (
    <ThemeProvider>
      <div className="w-full h-svh">
        {/* TODO: make this dynamic based on the set of studies */}
        <Study
          path={[{ title: studyLSystem.title, href: window.location.href }]}
          sidebarChildren={<div id={Portal.Sidebar} />}
        >
          {studyLSystem.component}
        </Study>
      </div>
    </ThemeProvider>
  );
}

export default App;
