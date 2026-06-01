import { Portal } from '@/components/portal/portal';
import { Study } from '@/components/Study';
import { StudySwitcher } from '@/components/StudySwitcher';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { DEFAULT_STUDY_ID, getStudy } from '@/studies/registry';
import { useState } from 'react';

function App() {
  const [activeId, setActiveId] = useState(DEFAULT_STUDY_ID);
  const study = getStudy(activeId);

  return (
    <ThemeProvider>
      <div className="w-full h-svh">
        <Study
          path={[{ title: study.title, href: window.location.href }]}
          sidebarChildren={
            <>
              <StudySwitcher activeId={activeId} onChange={setActiveId} />
              <div id={Portal.Sidebar} />
            </>
          }
        >
          {/* keying by id remounts the study so its engine fully resets */}
          <div key={study.id} className="h-full">
            {study.component}
          </div>
        </Study>
      </div>
    </ThemeProvider>
  );
}

export default App;
