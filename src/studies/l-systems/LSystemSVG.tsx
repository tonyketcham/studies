import { useRef, useState, useDeferredValue, useCallback } from 'react';
import { Line, Rect } from '@svgdotjs/svg.js';
import '../../lib/svg.draggable.ts';
import { useSvgContainer, useSvgEffect } from '@/components/svg-js/useSvg';
import { SvgContainer } from '@/components/svg-js/SvgContainer';
import { InPortal } from '@/components/portal/InPortal';
import { SliderWithDiscreteInput } from '@/components/ui/SliderWithDiscreteInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input.tsx';
import { Label } from '@/components/ui/label.tsx';
import { MoveRight } from 'lucide-react';

const removeOnExportClass = 'remove-on-export';

type Node = {
  x: number;
  y: number;
  angle: number;
};

export function LSystemSVG() {
  const { setHandles, svgContainer } = useSvgContainer();

  // const rules = {
  //   F: 'FB',
  //   B: 'F[+B][-B]',
  // };
  const [axiom, setAxiom] = useState('F');
  const [rules, setRules] = useState({
    F: 'FB',
    B: 'F[[+B--B]F]',
  });
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

      const group = svg.group();
      const dragBackground = new Rect()
        .attr('width', '100%')
        .attr('height', '100%')
        .stroke('none')
        .attr('class', removeOnExportClass);

      group.add(dragBackground);
      group.stroke('white');

      // @ts-expect-error this type import is a bit broken but this is a personal hackathon and it works so ¯\_(ツ)_/¯
      group.draggable(true, {
        onEnd() {
          // Reset the position of the group so that it's always grabbable from the same spot on the screen after a translation which would otherwise move this element offscreen
          dragBackground.move(0, 0);
        },
      });

      svg.add(group);

      sentence.current.split('').forEach((char, index) => {
        const iterationLevel = Math.floor(
          (index / sentence.current.length) * deferredIterations
        );
        const length =
          deferredInitialLength * Math.pow(lengthFactor, iterationLevel);

        if (char === 'F') {
          const nextX =
            current.x + length * Math.cos((current.angle * Math.PI) / 180);
          const nextY =
            current.y + length * Math.sin((current.angle * Math.PI) / 180);

          const line = new Line()
            .plot(current.x, current.y, nextX, nextY)
            .stroke({ width: 1 });

          group.add(line);

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
        group.remove();
        dragBackground.remove();
        lines.forEach((line) => line.remove());
      };
    },
    [
      axiom,
      rules,
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
      const nodeCopy = svgContainer.svg.node.cloneNode(true);

      if (nodeCopy instanceof Element) {
        // remove interaction-only elements
        nodeCopy.querySelectorAll(`.${removeOnExportClass}`).forEach((el) => {
          el.remove();
        });
      }

      const svgString = serializer.serializeToString(nodeCopy);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // encode properties as the filename
      const encodedProps = formatObjectForFilename({
        axiom,
        rules,
        initialLength,
        angle,
        phototropism,
        iterations,
      });

      link.download = `lsystem-${encodedProps}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [
    angle,
    axiom,
    initialLength,
    iterations,
    phototropism,
    rules,
    svgContainer?.svg.node,
  ]);

  return (
    <>
      <InPortal>
        <div className="flex flex-col p-4 space-y-5">
          <div className="space-y-3">
            <Label className="font-mono text-sm">Axiom</Label>
            <Input
              type="text"
              value={axiom}
              onChange={(v) => setAxiom(v.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-medium leading-none">Rules</h2>
            {Object.entries(rules).map(([key, value]) => (
              <div key={key} className="flex flex-row space-x-2">
                <Label
                  htmlFor={key}
                  className="flex flex-row items-center space-x-2 font-mono text-sm"
                >
                  <span>{key}</span> <MoveRight className="w-4 h-4" />
                </Label>
                <Input
                  id={key}
                  type="text"
                  value={value}
                  onChange={(v) =>
                    setRules((prev) => ({
                      ...prev,
                      [key]: v.target.value,
                    }))
                  }
                  className="font-mono"
                />
              </div>
            ))}
          </div>
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
          <Button
            onClick={downloadSvg}
            className="!mt-8 place-self-center w-full"
          >
            Download
          </Button>
        </div>
      </InPortal>

      <SvgContainer setHandles={setHandles} height="100%" width="100%" />
    </>
  );
}

function formatObjectForFilename<T extends Record<string, unknown>>(obj: T) {
  const jsonString = JSON.stringify(obj, null, 0);

  const formattedString = jsonString
    .replace(/,/g, '_') // Replace commas with underscores
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_'); // Condense multiple underscores into one

  return formattedString;
}
