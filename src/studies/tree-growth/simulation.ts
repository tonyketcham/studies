/**
 * TreeSimulation — framework-free growth model.
 *
 * Two coupled space-colonization systems grow simultaneously:
 *   - the canopy grows toward "light" attractors above ground,
 *   - the root system grows toward "nutrient" attractors below ground.
 *
 * Growth is gated by a small resource economy: leaves fix CARBON via
 * photosynthesis, roots take up WATER/nutrients, and each new segment costs
 * both. Whichever resource is scarce throttles growth and (under the default
 * "balanced" allocation) biases investment toward the organ that captures it —
 * the classic functional-equilibrium feedback loop.
 *
 * All state lives in preallocated typed arrays and the per-frame work is
 * hard-capped, so the cost stays bounded no matter how large the tree gets.
 */

import {
  MAX_ATTRACTORS,
  MAX_LEAVES,
  MAX_NODES,
  Metrics,
  SimParams,
} from './types';

const KIND_SHOOT = 0;
const KIND_ROOT = 1;

// --- Growth geometry -------------------------------------------------------
const SEG_LEN = 1.3; // length of one internode
const INFLUENCE = 7; // attractor influence radius (di)
const KILL = 2.6; // attractor kill distance (dk)
const CELL = INFLUENCE; // spatial-hash cell size
const GRID_OFFSET = 512; // keeps cell indices non-negative

// --- Resource economy ------------------------------------------------------
const PHOTO_K = 16; // max carbon/sec at full leaf area
const PHOTO_A = 0.0016; // photosynthesis saturation (self-shading)
const UPT_K = 16; // max water/sec at full root mass
const UPT_A = 0.0022; // uptake saturation
const RESERVE_CAP = 60;
const START_RESERVE = 22; // bootstrap so the seedling can grow before it has leaves

// carbon / water cost per new node (shoots are carbon-hungry, roots water-hungry)
const COST_C_SHOOT = 1.0;
const COST_W_SHOOT = 0.4;
const COST_C_ROOT = 0.4;
const COST_W_ROOT = 1.0;

const BASE_RATE = 58; // baseline nodes/sec at growthSpeed = 1
const MAX_NODES_PER_FRAME = 34; // hard cap per organ per frame (anti-spike)
const MAX_ITERS_PER_FRAME = 8;

const LEAF_MIN_DEPTH = 3;
const LEAF_PROB = 0.72;

interface DirAcc {
  x: number;
  y: number;
  z: number;
}

export class TreeSimulation {
  // node pool (shoots + roots share one pool, distinguished by `kind`)
  readonly px = new Float32Array(MAX_NODES);
  readonly py = new Float32Array(MAX_NODES);
  readonly pz = new Float32Array(MAX_NODES);
  readonly parent = new Int32Array(MAX_NODES);
  readonly radius = new Float32Array(MAX_NODES);
  readonly kind = new Uint8Array(MAX_NODES);
  readonly isTip = new Uint8Array(MAX_NODES);
  private readonly depth = new Int16Array(MAX_NODES);
  private readonly subtreeTips = new Float32Array(MAX_NODES);
  nodeCount = 0;

  // leaves (reference into the node pool)
  readonly leafNode = new Int32Array(MAX_LEAVES);
  readonly leafSeed = new Float32Array(MAX_LEAVES);
  leafCount = 0;

  // attractor clouds
  readonly canopyX = new Float32Array(MAX_ATTRACTORS);
  readonly canopyY = new Float32Array(MAX_ATTRACTORS);
  readonly canopyZ = new Float32Array(MAX_ATTRACTORS);
  readonly canopyAlive = new Uint8Array(MAX_ATTRACTORS);
  canopyCount = 0;
  readonly rootX = new Float32Array(MAX_ATTRACTORS);
  readonly rootY = new Float32Array(MAX_ATTRACTORS);
  readonly rootZ = new Float32Array(MAX_ATTRACTORS);
  readonly rootAlive = new Uint8Array(MAX_ATTRACTORS);
  rootAttrCount = 0;

  // growth fronts (small, active node indices)
  private shootActive: number[] = [];
  private rootActive: number[] = [];

  // running counts
  private shootSeg = 0;
  private rootSeg = 0;

  // resources
  private carbon = START_RESERVE;
  private water = START_RESERVE;
  private production = 0;
  private uptake = 0;

  // dirty signalling for the renderer
  structureVersion = 0;

  private params: SimParams;
  private grid = new Map<number, number[]>();

  constructor(params: SimParams) {
    this.params = params;
    this.reset(params);
  }

  setParams(params: SimParams): void {
    this.params = params;
  }

  /** Clear everything and re-seed the tree + attractor clouds. */
  reset(params: SimParams): void {
    this.params = params;
    this.nodeCount = 0;
    this.leafCount = 0;
    this.shootSeg = 0;
    this.rootSeg = 0;
    this.shootActive = [];
    this.rootActive = [];
    this.carbon = START_RESERVE;
    this.water = START_RESERVE;
    this.production = 0;
    this.uptake = 0;

    // seed nodes: trunk base (shoot) + taproot base (root)
    const base = this.addNode(0, 0, 0, -1, KIND_SHOOT, 0);
    const rootBase = this.addNode(0, -0.3, 0, base, KIND_ROOT, 1);
    this.rootSeg++;
    this.shootActive.push(base);
    this.rootActive.push(rootBase);

    this.seedAttractors(params);
    this.structureVersion++;
  }

  // ---------------------------------------------------------------- attractors
  private seedAttractors(params: SimParams): void {
    const density = params.branchDensity;
    const canopyN = Math.min(MAX_ATTRACTORS, Math.round(900 * density));
    const soilMul =
      params.soil === 'poor' ? 0.55 : params.soil === 'rich' ? 1.4 : 1;
    const rootN = Math.min(MAX_ATTRACTORS, Math.round(620 * density * soilMul));
    const soilDepth =
      params.soil === 'poor' ? 9 : params.soil === 'rich' ? 16 : 13;

    // canopy: an ellipsoid sitting above the ground
    this.canopyCount = canopyN;
    const cR = 10 + 2 * density;
    const cYmin = 5;
    const cYmax = 25;
    for (let i = 0; i < canopyN; i++) {
      const [x, z] = diskSample(cR);
      // bias points toward the upper-middle for a rounded crown
      const t = Math.cbrt(Math.random());
      this.canopyX[i] = x * t + (1 - t) * x * 0.4;
      this.canopyZ[i] = z * t + (1 - t) * z * 0.4;
      const yt = Math.random();
      this.canopyY[i] = cYmin + (cYmax - cYmin) * (0.25 + 0.75 * yt);
      this.canopyAlive[i] = 1;
    }

    // roots: a downward, outward-spreading cone of nutrient sites
    this.rootAttrCount = rootN;
    for (let i = 0; i < rootN; i++) {
      const depth = Math.random();
      const y = -0.8 - soilDepth * depth;
      const spread = 3 + 8 * depth; // wider as it goes deeper
      const [x, z] = diskSample(spread);
      this.rootX[i] = x;
      this.rootY[i] = y;
      this.rootZ[i] = z;
      this.rootAlive[i] = 1;
    }
  }

  // ------------------------------------------------------------------ stepping
  step(dt: number): void {
    if (this.params.paused) return;
    const p = this.params;

    // 1. resource production / uptake (saturating curves)
    const leafArea = this.leafCount * p.leafSize * p.leafSize;
    this.production = p.sunlight * PHOTO_K * (1 - Math.exp(-PHOTO_A * leafArea));
    const soilFactor =
      p.soil === 'poor' ? 0.6 : p.soil === 'rich' ? 1.5 : 1;
    this.uptake =
      p.nutrients * soilFactor * UPT_K * (1 - Math.exp(-UPT_A * this.rootSeg));

    this.carbon = Math.min(RESERVE_CAP, this.carbon + this.production * dt);
    this.water = Math.min(RESERVE_CAP, this.water + this.uptake * dt);

    // 2. growth pace (nodes attempted this frame) and shoot/root split
    const pace = BASE_RATE * p.growthSpeed * dt;
    const split = this.allocationSplit(p); // fraction to shoots
    let shootTry = Math.round(pace * split);
    let rootTry = Math.round(pace * (1 - split));

    // 3. clamp by what the reserves can afford, then grow + deduct
    shootTry = Math.min(
      shootTry,
      MAX_NODES_PER_FRAME,
      Math.floor(this.carbon / COST_C_SHOOT),
      Math.floor(this.water / COST_W_SHOOT)
    );
    rootTry = Math.min(
      rootTry,
      MAX_NODES_PER_FRAME,
      Math.floor(this.carbon / COST_C_ROOT),
      Math.floor(this.water / COST_W_ROOT)
    );

    const grownShoot = this.growKind(KIND_SHOOT, Math.max(0, shootTry));
    const grownRoot = this.growKind(KIND_ROOT, Math.max(0, rootTry));

    this.carbon -= grownShoot * COST_C_SHOOT + grownRoot * COST_C_ROOT;
    this.water -= grownShoot * COST_W_SHOOT + grownRoot * COST_W_ROOT;
    this.carbon = Math.max(0, this.carbon);
    this.water = Math.max(0, this.water);

    if (grownShoot + grownRoot > 0) this.structureVersion++;
  }

  /** Fraction of growth budget that should go to shoots. */
  private allocationSplit(p: SimParams): number {
    if (p.allocation === 'shoots') return 0.82;
    if (p.allocation === 'roots') return 0.18;
    // balanced → functional equilibrium: invest in the organ that gathers the
    // scarce resource. Carbon-limited → grow shoots (more leaves); water-limited
    // → grow roots.
    const cRatio = this.carbon / RESERVE_CAP;
    const wRatio = this.water / RESERVE_CAP;
    const total = cRatio + wRatio || 1;
    // when carbon is scarce relative to water, push shoots, and vice-versa
    const shootBias = wRatio / total; // low carbon → wRatio dominates → more shoots
    return 0.3 + 0.4 * shootBias; // keep within [0.3, 0.7] for stability
  }

  private growKind(kind: number, budget: number): number {
    if (budget <= 0) return 0;
    const active = kind === KIND_ROOT ? this.rootActive : this.shootActive;
    if (active.length === 0) return 0;

    let added = 0;
    let iter = 0;
    let current = active;

    while (added < budget && iter < MAX_ITERS_PER_FRAME) {
      this.buildGrid(current);

      // accumulate attractor pull per active node
      const infl = new Map<number, DirAcc>();
      const n = kind === KIND_ROOT ? this.rootAttrCount : this.canopyCount;
      const ax = kind === KIND_ROOT ? this.rootX : this.canopyX;
      const ay = kind === KIND_ROOT ? this.rootY : this.canopyY;
      const az = kind === KIND_ROOT ? this.rootZ : this.canopyZ;
      const alive = kind === KIND_ROOT ? this.rootAlive : this.canopyAlive;

      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const near = this.nearest(ax[i], ay[i], az[i], INFLUENCE);
        if (near < 0) continue;
        let dx = ax[i] - this.px[near];
        let dy = ay[i] - this.py[near];
        let dz = az[i] - this.pz[near];
        const len = Math.hypot(dx, dy, dz) || 1;
        dx /= len;
        dy /= len;
        dz /= len;
        const acc = infl.get(near);
        if (acc) {
          acc.x += dx;
          acc.y += dy;
          acc.z += dz;
        } else {
          infl.set(near, { x: dx, y: dy, z: dz });
        }
      }

      if (infl.size === 0) break;

      const next: number[] = [];
      const seen = new Set<number>();
      for (const [idx, acc] of infl) {
        if (added >= budget) {
          if (!seen.has(idx)) {
            seen.add(idx);
            next.push(idx); // defer to next frame
          }
          continue;
        }
        // blend attractor direction with a tropism bias
        let dx = acc.x;
        let dy = acc.y;
        let dz = acc.z;
        this.applyTropism(kind, idx, (bx, by, bz) => {
          dx += bx;
          dy += by;
          dz += bz;
        });
        const len = Math.hypot(dx, dy, dz) || 1;
        const nx = this.px[idx] + (dx / len) * SEG_LEN;
        const ny = this.py[idx] + (dy / len) * SEG_LEN;
        const nz = this.pz[idx] + (dz / len) * SEG_LEN;

        const child = this.addNode(nx, ny, nz, idx, kind, this.depth[idx] + 1);
        if (child < 0) break; // node pool full
        if (kind === KIND_ROOT) this.rootSeg++;
        else this.shootSeg++;

        // leaves only on the canopy, above a minimum depth
        if (
          kind === KIND_SHOOT &&
          this.depth[child] >= LEAF_MIN_DEPTH &&
          Math.random() < LEAF_PROB
        ) {
          this.addLeaf(child);
        }

        added++;
        if (!seen.has(idx)) {
          seen.add(idx);
          next.push(idx); // parent may keep branching
        }
        next.push(child);
      }

      // prune attractors reached by the (updated) front
      this.buildGrid(next);
      this.pruneAttractors(kind);

      current = next;
      iter++;
    }

    if (kind === KIND_ROOT) this.rootActive = current;
    else this.shootActive = current;
    return added;
  }

  private applyTropism(
    kind: number,
    _idx: number,
    add: (x: number, y: number, z: number) => void
  ): void {
    if (kind === KIND_ROOT) {
      add(0, -0.55, 0); // gravitropism: roots head down
      return;
    }
    // canopy: phototropism (up + horizontal toward the light)
    add(0, 0.35, 0);
    const dir = this.params.lightDir;
    if (dir === 'left') add(-0.4, 0.1, 0);
    else if (dir === 'right') add(0.4, 0.1, 0);
  }

  // --------------------------------------------------------------------- nodes
  private addNode(
    x: number,
    y: number,
    z: number,
    parent: number,
    kind: number,
    depth: number
  ): number {
    if (this.nodeCount >= MAX_NODES) return -1;
    const i = this.nodeCount++;
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.parent[i] = parent;
    this.kind[i] = kind;
    this.depth[i] = depth;
    this.isTip[i] = 1;
    this.radius[i] = 0.08;
    if (parent >= 0) this.isTip[parent] = 0;
    return i;
  }

  private addLeaf(node: number): void {
    if (this.leafCount >= MAX_LEAVES) return;
    const i = this.leafCount++;
    this.leafNode[i] = node;
    this.leafSeed[i] = Math.random();
  }

  /**
   * Pipe model: a node's radius scales with the number of tip descendants it
   * supports. Recomputed on a throttle by the render loop (only when the
   * structure changed), so it never runs every frame.
   */
  refreshTaper(): void {
    const n = this.nodeCount;
    for (let i = 0; i < n; i++) this.subtreeTips[i] = this.isTip[i] ? 1 : 0;
    // children are always created after their parent → reverse pass accumulates
    for (let i = n - 1; i >= 1; i--) {
      const par = this.parent[i];
      if (par >= 0) this.subtreeTips[par] += this.subtreeTips[i];
    }
    for (let i = 0; i < n; i++) {
      const tips = this.subtreeTips[i];
      const r = 0.07 * Math.pow(tips, 1 / 2.3);
      this.radius[i] = Math.min(1.6, Math.max(0.05, r));
    }
  }

  // ------------------------------------------------------------- spatial hash
  private buildGrid(nodes: number[]): void {
    this.grid.clear();
    for (let k = 0; k < nodes.length; k++) {
      const idx = nodes[k];
      const key = this.cellKey(this.px[idx], this.py[idx], this.pz[idx]);
      const bucket = this.grid.get(key);
      if (bucket) bucket.push(idx);
      else this.grid.set(key, [idx]);
    }
  }

  private cellKey(x: number, y: number, z: number): number {
    const ix = Math.floor(x / CELL) + GRID_OFFSET;
    const iy = Math.floor(y / CELL) + GRID_OFFSET;
    const iz = Math.floor(z / CELL) + GRID_OFFSET;
    return ix | (iy << 10) | (iz << 20);
  }

  private nearest(x: number, y: number, z: number, maxR: number): number {
    const ix = Math.floor(x / CELL) + GRID_OFFSET;
    const iy = Math.floor(y / CELL) + GRID_OFFSET;
    const iz = Math.floor(z / CELL) + GRID_OFFSET;
    let best = -1;
    let bestD2 = maxR * maxR;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key =
            (ix + dx) | ((iy + dy) << 10) | ((iz + dz) << 20);
          const bucket = this.grid.get(key);
          if (!bucket) continue;
          for (let b = 0; b < bucket.length; b++) {
            const idx = bucket[b];
            const ex = x - this.px[idx];
            const ey = y - this.py[idx];
            const ez = z - this.pz[idx];
            const d2 = ex * ex + ey * ey + ez * ez;
            if (d2 < bestD2) {
              bestD2 = d2;
              best = idx;
            }
          }
        }
      }
    }
    return best;
  }

  private pruneAttractors(kind: number): void {
    const n = kind === KIND_ROOT ? this.rootAttrCount : this.canopyCount;
    const ax = kind === KIND_ROOT ? this.rootX : this.canopyX;
    const ay = kind === KIND_ROOT ? this.rootY : this.canopyY;
    const az = kind === KIND_ROOT ? this.rootZ : this.canopyZ;
    const alive = kind === KIND_ROOT ? this.rootAlive : this.canopyAlive;
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      const near = this.nearest(ax[i], ay[i], az[i], KILL);
      if (near >= 0) alive[i] = 0;
    }
  }

  // ------------------------------------------------------------------ metrics
  getMetrics(fps: number): Metrics {
    const cRatio = this.carbon / RESERVE_CAP;
    const wRatio = this.water / RESERVE_CAP;
    let limiting: Metrics['limiting'] = 'balanced';
    if (cRatio < 0.6 || wRatio < 0.6) {
      limiting = cRatio <= wRatio ? 'carbon' : 'water';
    }
    return {
      production: this.production,
      uptake: this.uptake,
      carbon: this.carbon,
      water: this.water,
      carbonCap: RESERVE_CAP,
      waterCap: RESERVE_CAP,
      limiting,
      branches: this.shootSeg,
      leaves: this.leafCount,
      roots: this.rootSeg,
      fps,
    };
  }
}

/** Uniform sample inside a disk of the given radius. Returns [x, z]. */
function diskSample(radius: number): [number, number] {
  const r = radius * Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  return [r * Math.cos(a), r * Math.sin(a)];
}
