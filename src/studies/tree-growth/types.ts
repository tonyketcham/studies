/**
 * Shared types, defaults, and hard caps for the real-time growth tree simulation.
 *
 * The caps below bound both memory (preallocated typed arrays + instance buffers)
 * and per-frame work, which is what keeps the simulation reliably performant even
 * once the tree has fully matured.
 */

export type Allocation = 'balanced' | 'shoots' | 'roots';
export type LightDir = 'left' | 'top' | 'right';
export type Soil = 'poor' | 'normal' | 'rich';

export interface DisplayLayers {
  leaves: boolean;
  roots: boolean;
  attractors: boolean;
}

/** All live-tunable simulation parameters, owned by the React UI. */
export interface SimParams {
  /** Drives photosynthesis (carbon production) and thus canopy growth. */
  sunlight: number;
  /** Drives water/nutrient uptake and thus root growth. */
  nutrients: number;
  /** Global growth-rate multiplier. */
  growthSpeed: number;
  /** Attractor density — controls bushiness (structural: triggers a regrow). */
  branchDensity: number;
  /** Procedural wind sway amplitude (purely visual, GPU-side). */
  wind: number;
  /** Leaf scale; also lightly affects effective leaf area for photosynthesis. */
  leafSize: number;
  /** Growth-allocation override (or 'balanced' for functional equilibrium). */
  allocation: Allocation;
  /** Sun direction + canopy tropism bias. */
  lightDir: LightDir;
  /** Soil nutrient profile (structural: triggers a regrow). */
  soil: Soil;
  /** Per-layer visibility toggles. */
  show: DisplayLayers;
  /** When true, growth is frozen (rendering + wind continue). */
  paused: boolean;
}

export const DEFAULT_PARAMS: SimParams = {
  sunlight: 1,
  nutrients: 1,
  growthSpeed: 1,
  branchDensity: 1,
  wind: 0.35,
  leafSize: 1,
  allocation: 'balanced',
  lightDir: 'top',
  soil: 'normal',
  show: { leaves: true, roots: true, attractors: false },
  paused: false,
};

export type LimitingFactor = 'carbon' | 'water' | 'balanced';

/** Live readouts surfaced to the feedback panel (throttled, not per-frame). */
export interface Metrics {
  /** Carbon produced per second by photosynthesis. */
  production: number;
  /** Water/nutrients taken up per second by the roots. */
  uptake: number;
  /** Current stored carbon reserve. */
  carbon: number;
  /** Current stored water reserve. */
  water: number;
  /** Reserve capacities (for bar normalization). */
  carbonCap: number;
  waterCap: number;
  /** Which resource is currently constraining growth. */
  limiting: LimitingFactor;
  /** Structural counts. */
  branches: number;
  leaves: number;
  roots: number;
  /** Rendering frame rate. */
  fps: number;
}

export const EMPTY_METRICS: Metrics = {
  production: 0,
  uptake: 0,
  carbon: 0,
  water: 0,
  carbonCap: 1,
  waterCap: 1,
  limiting: 'balanced',
  branches: 0,
  leaves: 0,
  roots: 0,
  fps: 0,
};

/**
 * Hard caps. Nodes are stored in a single pool shared by shoots and roots.
 * Each non-seed node contributes exactly one rendered segment.
 */
export const MAX_NODES = 14000;
export const MAX_SHOOT_SEG = 8000;
export const MAX_ROOT_SEG = 6000;
export const MAX_LEAVES = 4000;
export const MAX_ATTRACTORS = 2200; // per cloud (canopy + roots)
