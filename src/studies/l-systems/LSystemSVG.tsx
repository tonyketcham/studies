import { useRef, useState, useDeferredValue, useCallback } from 'react';
import { Line } from '@svgdotjs/svg.js';
import { useSvgContainer, useSvgEffect } from '@/components/svg-js/useSvg';
import { SvgContainer } from '@/components/svg-js/SvgContainer';
import { InPortal } from '@/components/portal/InPortal';
import { SliderWithDiscreteInput } from '@/components/ui/SliderWithDiscreteInput';
import { Button } from '@/components/ui/button';

type Node = {
  x: number;
  y: number;
  angle: number;
};

export function LSystemSVG() {
  const { setHandles, svgContainer } = useSvgContainer();

  // axiom: A
  // rules: A -> AB, B -> A
  // angle: 30
  // iterations: 5
  const axiom = 'A';
  const rules = {
    A: 'AB',
    B: 'A[+B][-B]',
  };
  const [initialLength, setInitialLength] = useState(20);
  const [angle, setAngle] = useState(30);
  const [phototropism, setPhototropism] = useState(1.01);
  const [iterations, setIterations] = useState(5);

  // Defer the values
  const deferredInitialLength = useDeferredValue(initialLength);
  const deferredAngle = useDeferredValue(angle);
  const deferredPhototropism = useDeferredValue(phototropism);
  const deferredIterations = useDeferredValue(iterations);

  const sentence = useRef(axiom);

  useSvgEffect(
    svgContainer,
    (svg) => {
      const lengthFactor = 0.7; // Factor by which the length is reduced each iteration
      const start = { x: 100, y: 100, angle: 45 };
      const stack: Node[] = [];
      let current = { ...start };

      const lines: Line[] = [];

      for (let i = 0; i < deferredIterations; i++) {
        const nextString = sentence.current
          .split('')
          .map((char) =>
            rules[char as keyof typeof rules]
              ? rules[char as keyof typeof rules]
              : char
          )
          .join('');
        sentence.current = nextString;
      }

      sentence.current.split('').forEach((char, index) => {
        const iterationLevel = Math.floor(
          (index / sentence.current.length) * deferredIterations
        );
        const length =
          deferredInitialLength * Math.pow(lengthFactor, iterationLevel);

        if (char === 'A') {
          const nextX =
            current.x + length * Math.cos((current.angle * Math.PI) / 180);
          const nextY =
            current.y + length * Math.sin((current.angle * Math.PI) / 180);

          const line = new Line()
            .plot(current.x, current.y, nextX, nextY)
            .stroke({ width: 1, color: 'white' });

          svg.add(line);

          lines.push(line);

          current = { x: nextX, y: nextY, angle: current.angle };
        } else if (char === '-') {
          // rotate left
          current.angle -= deferredAngle;
        } else if (char === '+') {
          // rotate right
          current.angle += deferredAngle;
        } else if (char === '[') {
          // push
          stack.push({
            ...current,
            angle: current.angle * deferredPhototropism,
          });
        } else if (char === ']') {
          // pop
          const state = stack.pop();

          if (state) {
            current = state;
          }
        }
      });

      return () => {
        sentence.current = axiom;
        lines.forEach((line) => line.remove());
      };
    },
    [
      deferredInitialLength,
      deferredIterations,
      deferredPhototropism,
      deferredAngle,
    ]
  );

  // Function to download the SVG
  const downloadSvg = useCallback(() => {
    if (svgContainer?.svg.node) {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgContainer?.svg.node);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'lsystem.svg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [svgContainer?.svg.node]);

  return (
    <>
      <InPortal>
        <div className="p-4 space-y-4">
          <SliderWithDiscreteInput
            label="Scale"
            min={1}
            max={100}
            step={0.1}
            value={initialLength}
            onChange={(v) => setInitialLength(v)}
          />
          <SliderWithDiscreteInput
            label="Angle"
            min={-180}
            max={180}
            step={1}
            value={angle}
            onChange={(v) => setAngle(v)}
          />
          <SliderWithDiscreteInput
            label="Phototropism"
            min={-1.05}
            max={2}
            step={0.005}
            value={phototropism}
            onChange={(v) => setPhototropism(v)}
          />
          <SliderWithDiscreteInput
            label="Iterations"
            min={0}
            max={9}
            step={1}
            value={iterations}
            onChange={(v) => setIterations(v)}
          />
          <Button onClick={downloadSvg} className="!mt-8">
            Download
          </Button>
        </div>
      </InPortal>

      <SvgContainer setHandles={setHandles} height="100%" width="100%" />
    </>
  );
}
