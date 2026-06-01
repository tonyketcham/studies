import { InPortal } from '@/components/portal/InPortal';
import { Button } from '@/components/ui/button';
import { MetricBar } from '@/components/ui/MetricBar';
import { SliderWithDiscreteInput } from '@/components/ui/SliderWithDiscreteInput';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TreeRenderer } from './renderer';
import { TreeSimulation } from './simulation';
import {
  Allocation,
  DEFAULT_PARAMS,
  EMPTY_METRICS,
  LightDir,
  Metrics,
  SimParams,
  Soil,
} from './types';

const PRODUCTION_MAX = 16;
const UPTAKE_MAX = 24;

export function TreeGrowth() {
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<TreeSimulation | null>(null);
  const rendererRef = useRef<TreeRenderer | null>(null);
  const paramsRef = useRef<SimParams>({
    ...DEFAULT_PARAMS,
    show: { ...DEFAULT_PARAMS.show },
  });
  const regrowTimer = useRef<number | null>(null);

  const [ui, setUi] = useState<SimParams>(paramsRef.current);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);

  // ----------------------------------------------------- engine lifecycle
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const sim = new TreeSimulation(paramsRef.current);
    const renderer = new TreeRenderer(container);
    simRef.current = sim;
    rendererRef.current = renderer;

    let raf = 0;
    let last = performance.now();
    let taperTimer = 0;
    let metricTimer = 0;
    let fpsFrames = 0;
    let fpsTime = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05; // clamp after tab-switch / GC pauses

      sim.setParams(paramsRef.current);
      sim.step(dt);
      renderer.syncStructure(sim);

      taperTimer += dt;
      if (taperTimer >= 0.25) {
        taperTimer = 0;
        renderer.refreshTaper(sim);
      }

      renderer.syncLeaves(sim, paramsRef.current.leafSize);
      renderer.syncAttractors(sim, paramsRef.current.show.attractors);
      renderer.applyParams(paramsRef.current);
      renderer.setTime(now / 1000);
      renderer.render();

      fpsFrames++;
      fpsTime += dt;
      metricTimer += dt;
      if (metricTimer >= 0.15) {
        const fps = fpsTime > 0 ? fpsFrames / fpsTime : 0;
        setMetrics(sim.getMetrics(fps));
        metricTimer = 0;
        fpsFrames = 0;
        fpsTime = 0;
      }
    };
    raf = requestAnimationFrame(loop);

    const resize = () => renderer.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.dispose();
      simRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  // --------------------------------------------------------- param updates
  const update = useCallback((patch: Partial<SimParams>) => {
    setUi((prev) => {
      const next: SimParams = { ...prev, ...patch };
      paramsRef.current = next;
      return next;
    });
  }, []);

  const regrow = useCallback(() => {
    const sim = simRef.current;
    const renderer = rendererRef.current;
    if (!sim || !renderer) return;
    renderer.resetView();
    sim.reset(paramsRef.current);
  }, []);

  // structural params (attractor layout) need a debounced regrow
  const updateStructural = useCallback(
    (patch: Partial<SimParams>) => {
      update(patch);
      if (regrowTimer.current) window.clearTimeout(regrowTimer.current);
      regrowTimer.current = window.setTimeout(() => regrow(), 280);
    },
    [update, regrow]
  );

  useEffect(
    () => () => {
      if (regrowTimer.current) window.clearTimeout(regrowTimer.current);
    },
    []
  );

  const toggleLayer = (key: 'leaves' | 'roots' | 'attractors') =>
    update({ show: { ...ui.show, [key]: !ui.show[key] } });

  const limitingLabel =
    metrics.limiting === 'carbon'
      ? 'Carbon-limited'
      : metrics.limiting === 'water'
        ? 'Water-limited'
        : 'Balanced';
  const limitingColor =
    metrics.limiting === 'carbon'
      ? 'text-amber-500'
      : metrics.limiting === 'water'
        ? 'text-sky-500'
        : 'text-emerald-500';

  return (
    <>
      <InPortal>
        <div className="flex flex-col p-4 space-y-5 overflow-y-auto max-h-[calc(100svh-2rem)]">
          {/* live feedback panel */}
          <section className="p-3 space-y-2.5 border rounded-lg border-neutral-300/60 dark:border-neutral-700/60 bg-neutral-100/40 dark:bg-neutral-800/30">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Resource flux</h2>
              <span className={`text-xs font-medium ${limitingColor}`}>
                {limitingLabel}
              </span>
            </div>
            <MetricBar
              label="Photosynthesis"
              value={metrics.production}
              max={PRODUCTION_MAX}
              color="bg-amber-400"
              display={metrics.production.toFixed(1)}
              unit="C/s"
            />
            <MetricBar
              label="Nutrient uptake"
              value={metrics.uptake}
              max={UPTAKE_MAX}
              color="bg-sky-400"
              display={metrics.uptake.toFixed(1)}
              unit="W/s"
            />
            <MetricBar
              label="Carbon reserve"
              value={metrics.carbon}
              max={metrics.carbonCap}
              color="bg-amber-500/70"
            />
            <MetricBar
              label="Water reserve"
              value={metrics.water}
              max={metrics.waterCap}
              color="bg-sky-500/70"
            />
            <div className="grid grid-cols-4 gap-1 pt-1 text-center">
              <Stat label="branch" value={metrics.branches} />
              <Stat label="leaf" value={metrics.leaves} />
              <Stat label="root" value={metrics.roots} />
              <Stat label="fps" value={Math.round(metrics.fps)} />
            </div>
          </section>

          {/* environment sliders */}
          <SliderWithDiscreteInput
            label="Sunlight"
            min={0}
            max={1.5}
            step={0.01}
            value={ui.sunlight}
            onChange={(v) => update({ sunlight: v })}
          />
          <SliderWithDiscreteInput
            label="Soil Nutrients"
            min={0}
            max={1.5}
            step={0.01}
            value={ui.nutrients}
            onChange={(v) => update({ nutrients: v })}
          />
          <SliderWithDiscreteInput
            label="Growth Speed"
            min={0.1}
            max={3}
            step={0.05}
            value={ui.growthSpeed}
            onChange={(v) => update({ growthSpeed: v })}
          />
          <SliderWithDiscreteInput
            label="Branch Density"
            min={0.3}
            max={2}
            step={0.05}
            value={ui.branchDensity}
            onChange={(v) => updateStructural({ branchDensity: v })}
          />
          <SliderWithDiscreteInput
            label="Wind"
            min={0}
            max={1}
            step={0.01}
            value={ui.wind}
            onChange={(v) => update({ wind: v })}
          />
          <SliderWithDiscreteInput
            label="Leaf Size"
            min={0.3}
            max={2}
            step={0.05}
            value={ui.leafSize}
            onChange={(v) => update({ leafSize: v })}
          />

          {/* toggle groups */}
          <ToggleGroup<Allocation>
            label="Allocation"
            value={ui.allocation}
            onChange={(v) => update({ allocation: v })}
            options={[
              { value: 'balanced', label: 'Balanced' },
              { value: 'shoots', label: 'Shoots' },
              { value: 'roots', label: 'Roots' },
            ]}
          />
          <ToggleGroup<LightDir>
            label="Light Direction"
            value={ui.lightDir}
            onChange={(v) => update({ lightDir: v })}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'top', label: 'Top' },
              { value: 'right', label: 'Right' },
            ]}
          />
          <ToggleGroup<Soil>
            label="Soil"
            value={ui.soil}
            onChange={(v) => updateStructural({ soil: v })}
            options={[
              { value: 'poor', label: 'Poor' },
              { value: 'normal', label: 'Normal' },
              { value: 'rich', label: 'Rich' },
            ]}
          />
          <ToggleGroup
            type="multiple"
            label="Show"
            values={(['leaves', 'roots', 'attractors'] as const).filter(
              (k) => ui.show[k]
            )}
            onToggle={(v) => toggleLayer(v)}
            options={[
              { value: 'leaves', label: 'Leaves' },
              { value: 'roots', label: 'Roots' },
              { value: 'attractors', label: 'Sites' },
            ]}
          />

          {/* actions */}
          <div className="flex gap-2 !mt-7">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => update({ paused: !ui.paused })}
            >
              {ui.paused ? 'Resume' : 'Pause'}
            </Button>
            <Button className="flex-1" onClick={regrow}>
              Replant
            </Button>
          </div>
        </div>
      </InPortal>

      <div ref={containerRef} className="w-full h-full" />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-sm tabular-nums text-neutral-800 dark:text-neutral-100">
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </span>
    </div>
  );
}
