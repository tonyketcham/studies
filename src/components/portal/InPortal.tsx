import { Portal } from '@/components/portal/portal';
import { PropsWithChildren, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

export function InPortal({
  id = Portal.Sidebar,
  children,
}: PropsWithChildren<{ id?: string }>) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Prevents the edge case where attempting to teleport immediately upon app load fails because the target isn't available yet.
  if (!hasMounted) {
    return null;
  }

  const container = document.querySelector(`#${id}`);

  if (!container) {
    console.error('Portal container missing', { id });
    return null;
  }

  return ReactDOM.createPortal(children, container);
}
