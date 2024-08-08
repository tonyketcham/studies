import { SvgContainerHandles } from '@/components/svg-js/useSvg';
import { Svg, SVG } from '@svgdotjs/svg.js';
import { useRef, useEffect } from 'react';

export interface SvgContainerProps {
  height?: string;
  width?: string;
  margin?: string;
  onload?: (svg: Svg, container: HTMLDivElement) => void;
  setHandles: (handles: SvgContainerHandles) => void;
}

export function SvgContainer(props: SvgContainerProps) {
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wrapper.current && wrapper.current.children.length === 0) {
      const svg = SVG().addTo(wrapper.current).size('100%', '100%');
      props.setHandles({ svg, container: wrapper.current });
      props.onload?.(svg, wrapper.current);
    }
  }, [props]);

  return (
    <div
      ref={wrapper}
      className="mix-blend-difference"
      style={{
        margin: props.margin,
        height: props.height,
        width: props.width,
      }}
    />
  );
}
