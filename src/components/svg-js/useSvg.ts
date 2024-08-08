import { Svg, Element } from '@svgdotjs/svg.js';
import { useState, useRef, useEffect, useLayoutEffect } from 'react';

export const useSvgContainer = () => {
  const [handles, setHandles] = useState<SvgContainerHandles>();
  return { setHandles, svgContainer: handles };
};

export type SvgContainerHandles = {
  svg: Svg;
  container: HTMLDivElement;
};

export const useSvgEffect = <T>(
  container: SvgContainerHandles | undefined,
  effect: (svg: Svg) => Element[] | ((svg: Svg) => void),
  deps: T[],
  cleanup = true
) => {
  const callbackRef = useRef(effect);

  useLayoutEffect(() => {
    callbackRef.current = effect;
  }, [effect]);

  useEffect(() => {
    let cleanupFn: (svg: Svg) => void;
    if (container) {
      const result = callbackRef.current(container.svg);
      if (typeof result === 'function') {
        cleanupFn = result;
      } else if (cleanup) {
        return () => result.forEach((obj) => obj.remove());
      }
    }
    return () => {
      if (cleanupFn && container) cleanupFn(container.svg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, container]);
};
