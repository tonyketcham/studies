/**
 * TreeRenderer — Three.js view for the growth simulation.
 *
 * Branches, roots and leaves are each drawn with a single InstancedMesh backed
 * by a preallocated instance buffer. Only newly grown segments are written each
 * frame; the (more expensive) full re-write that picks up pipe-model radius
 * changes is throttled by the render loop. Wind is a GPU-side vertex
 * displacement driven by one `uTime` uniform, so it costs effectively nothing.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TreeSimulation } from './simulation';
import {
  MAX_ATTRACTORS,
  MAX_LEAVES,
  MAX_ROOT_SEG,
  MAX_SHOOT_SEG,
  SimParams,
} from './types';

const UP = new THREE.Vector3(0, 1, 0);

interface WindUniforms {
  uTime: { value: number };
  uWind: { value: number };
  uWindDir: { value: THREE.Vector2 };
}

export class TreeRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private readonly branches: THREE.InstancedMesh;
  private readonly roots: THREE.InstancedMesh;
  private readonly leaves: THREE.InstancedMesh;
  private readonly canopyPoints: THREE.Points;
  private readonly rootPoints: THREE.Points;
  private readonly sun: THREE.DirectionalLight;

  // instance bookkeeping
  private shootInst = 0;
  private rootInst = 0;
  private leafInst = 0;
  private syncedNodes = 0;
  private readonly shootNodeOf = new Int32Array(MAX_SHOOT_SEG);
  private readonly rootNodeOf = new Int32Array(MAX_ROOT_SEG);
  private lastStructureVersion = -1;
  private lastTaperVersion = -1;
  private lastLeafSize = -1;

  private readonly wind: WindUniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.35 },
    uWindDir: { value: new THREE.Vector2(1, 0.35).normalize() },
  };

  private readonly dummy = new THREE.Object3D();
  private readonly dir = new THREE.Vector3();
  private readonly mid = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly disposables: { dispose(): void }[] = [];

  constructor(private container: HTMLElement) {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1016);
    this.scene.fog = new THREE.Fog(0x0c1016, 42, 95);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 400);
    this.camera.position.set(20, 15, 26);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 8, 0);
    this.controls.maxPolarAngle = Math.PI * 0.92;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 120;

    // --- lighting ---------------------------------------------------------
    const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x3a2c1f, 0.85);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d0, 1.4);
    this.sun.position.set(6, 20, 8);
    this.scene.add(this.sun);
    this.scene.add(new THREE.AmbientLight(0x404a5a, 0.6));

    // --- ground + soil hint ----------------------------------------------
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: 0x4a361f,
        roughness: 1,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      })
    );
    this.scene.add(ground);
    this.disposables.push(ground.geometry, ground.material as THREE.Material);

    const grid = new THREE.GridHelper(60, 30, 0x2a3340, 0x1c232d);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    this.scene.add(grid);
    this.disposables.push(grid.geometry, grid.material as THREE.Material);

    // --- branch / root / leaf meshes -------------------------------------
    const branchGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
    const branchMat = this.makeWindMaterial(0x6b4a2f, 0.012, 0.85);
    this.branches = new THREE.InstancedMesh(branchGeo, branchMat, MAX_SHOOT_SEG);
    this.branches.count = 0;
    this.branches.frustumCulled = false;
    this.scene.add(this.branches);
    this.disposables.push(branchGeo, branchMat);

    const rootGeo = new THREE.CylinderGeometry(1, 1, 1, 5, 1);
    const rootMat = this.makeWindMaterial(0x7a5a3a, 0, 1);
    rootMat.transparent = true;
    rootMat.opacity = 0.92;
    this.roots = new THREE.InstancedMesh(rootGeo, rootMat, MAX_ROOT_SEG);
    this.roots.count = 0;
    this.roots.frustumCulled = false;
    this.scene.add(this.roots);
    this.disposables.push(rootGeo, rootMat);

    const leafGeo = new THREE.CircleGeometry(0.5, 5);
    const leafMat = this.makeWindMaterial(0x4e9a3d, 0.05, 1);
    leafMat.side = THREE.DoubleSide;
    leafMat.roughness = 0.7;
    this.leaves = new THREE.InstancedMesh(leafGeo, leafMat, MAX_LEAVES);
    this.leaves.count = 0;
    this.leaves.frustumCulled = false;
    this.leaves.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_LEAVES * 3),
      3
    );
    this.scene.add(this.leaves);
    this.disposables.push(leafGeo, leafMat);

    // --- attractor point clouds ------------------------------------------
    this.canopyPoints = this.makePoints(0xffe08a, 0.5);
    this.rootPoints = this.makePoints(0x5fd0e0, 0.45);
    this.scene.add(this.canopyPoints);
    this.scene.add(this.rootPoints);
  }

  private makeWindMaterial(
    color: number,
    swayMul: number,
    rough: number
  ): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: 0,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.wind.uTime;
      shader.uniforms.uWind = this.wind.uWind;
      shader.uniforms.uWindDir = this.wind.uWindDir;
      shader.vertexShader =
        'uniform float uTime;\nuniform float uWind;\nuniform vec2 uWindDir;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          {
            float wy = instanceMatrix[3][1];
            float wx = instanceMatrix[3][0];
            float h = max(0.0, wy);
            float phase = uTime * 1.5 + wy * 0.18 + wx * 0.12;
            float s = sin(phase) + 0.4 * sin(phase * 2.3 + 1.0);
            float amp = uWind * h * ${swayMul.toFixed(4)};
            transformed.x += s * amp * uWindDir.x;
            transformed.z += s * amp * uWindDir.y;
          }`
        );
    };
    return mat;
  }

  private makePoints(color: number, size: number): THREE.Points {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(MAX_ATTRACTORS * 3), 3)
    );
    geo.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    this.disposables.push(geo, mat);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  // ----------------------------------------------------------------- syncing
  /** On a reset the simulation rewinds; drop all instances and start over. */
  resetView(): void {
    this.shootInst = 0;
    this.rootInst = 0;
    this.leafInst = 0;
    this.syncedNodes = 0;
    this.branches.count = 0;
    this.roots.count = 0;
    this.leaves.count = 0;
    this.lastStructureVersion = -1;
    this.lastTaperVersion = -1;
    this.lastLeafSize = -1;
  }

  syncStructure(sim: TreeSimulation): void {
    if (sim.structureVersion === this.lastStructureVersion) return;
    this.lastStructureVersion = sim.structureVersion;

    // append instances for newly created nodes
    for (let i = this.syncedNodes; i < sim.nodeCount; i++) {
      const parent = sim.parent[i];
      if (parent < 0) continue;
      if (sim.kind[i] === 1) {
        if (this.rootInst >= MAX_ROOT_SEG) continue;
        this.rootNodeOf[this.rootInst] = i;
        this.writeSegment(this.roots, this.rootInst, sim, i);
        this.rootInst++;
      } else {
        if (this.shootInst >= MAX_SHOOT_SEG) continue;
        this.shootNodeOf[this.shootInst] = i;
        this.writeSegment(this.branches, this.shootInst, sim, i);
        this.shootInst++;
      }
    }
    this.syncedNodes = sim.nodeCount;
    this.branches.count = this.shootInst;
    this.roots.count = this.rootInst;
    this.branches.instanceMatrix.needsUpdate = true;
    this.roots.instanceMatrix.needsUpdate = true;
  }

  /** Re-write every segment matrix to pick up updated pipe-model radii. */
  refreshTaper(sim: TreeSimulation): void {
    if (sim.structureVersion === this.lastTaperVersion) return;
    this.lastTaperVersion = sim.structureVersion;
    sim.refreshTaper();
    for (let k = 0; k < this.shootInst; k++) {
      this.writeSegment(this.branches, k, sim, this.shootNodeOf[k]);
    }
    for (let k = 0; k < this.rootInst; k++) {
      this.writeSegment(this.roots, k, sim, this.rootNodeOf[k]);
    }
    this.branches.instanceMatrix.needsUpdate = true;
    this.roots.instanceMatrix.needsUpdate = true;
  }

  private writeSegment(
    mesh: THREE.InstancedMesh,
    inst: number,
    sim: TreeSimulation,
    node: number
  ): void {
    const p = sim.parent[node];
    const ax = sim.px[p];
    const ay = sim.py[p];
    const az = sim.pz[p];
    const bx = sim.px[node];
    const by = sim.py[node];
    const bz = sim.pz[node];
    this.dir.set(bx - ax, by - ay, bz - az);
    const len = this.dir.length() || 0.0001;
    this.dir.divideScalar(len);
    this.quat.setFromUnitVectors(UP, this.dir);
    this.mid.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    const r = Math.max(0.04, (sim.radius[p] + sim.radius[node]) * 0.5);
    this.dummy.position.copy(this.mid);
    this.dummy.quaternion.copy(this.quat);
    this.dummy.scale.set(r, len, r);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(inst, this.dummy.matrix);
  }

  syncLeaves(sim: TreeSimulation, leafSize: number): void {
    const sizeChanged = leafSize !== this.lastLeafSize;
    const start = sizeChanged ? 0 : this.leafInst;
    if (!sizeChanged && sim.leafCount === this.leafInst) return;
    this.lastLeafSize = leafSize;
    const color = new THREE.Color();
    for (let i = start; i < sim.leafCount; i++) {
      const node = sim.leafNode[i];
      const seed = sim.leafSeed[i];
      const ang = seed * Math.PI * 2;
      const tilt = 0.5 + seed * 1.6;
      const s = leafSize * (0.7 + 0.5 * seed);
      // small offset so leaves don't all sit exactly on the branch tip
      const off = 0.35;
      this.dummy.position.set(
        sim.px[node] + Math.cos(ang) * off,
        sim.py[node] + (seed - 0.5) * 0.4,
        sim.pz[node] + Math.sin(ang) * off
      );
      this.dummy.rotation.set(tilt, ang, seed * 0.8);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.leaves.setMatrixAt(i, this.dummy.matrix);
      color.setHSL(0.27 + seed * 0.07, 0.55, 0.34 + seed * 0.16);
      this.leaves.setColorAt(i, color);
    }
    this.leafInst = sim.leafCount;
    this.leaves.count = sim.leafCount;
    this.leaves.instanceMatrix.needsUpdate = true;
    if (this.leaves.instanceColor) this.leaves.instanceColor.needsUpdate = true;
  }

  syncAttractors(sim: TreeSimulation, show: boolean): void {
    this.canopyPoints.visible = show;
    this.rootPoints.visible = show;
    if (!show) return;
    this.fillPoints(
      this.canopyPoints,
      sim.canopyX,
      sim.canopyY,
      sim.canopyZ,
      sim.canopyAlive,
      sim.canopyCount
    );
    this.fillPoints(
      this.rootPoints,
      sim.rootX,
      sim.rootY,
      sim.rootZ,
      sim.rootAlive,
      sim.rootAttrCount
    );
  }

  private fillPoints(
    pts: THREE.Points,
    xs: Float32Array,
    ys: Float32Array,
    zs: Float32Array,
    alive: Uint8Array,
    count: number
  ): void {
    const attr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    let n = 0;
    for (let i = 0; i < count; i++) {
      if (!alive[i]) continue;
      arr[n * 3] = xs[i];
      arr[n * 3 + 1] = ys[i];
      arr[n * 3 + 2] = zs[i];
      n++;
    }
    pts.geometry.setDrawRange(0, n);
    attr.needsUpdate = true;
  }

  applyParams(params: SimParams): void {
    // sun direction follows the light toggle
    if (params.lightDir === 'left') this.sun.position.set(-18, 16, 6);
    else if (params.lightDir === 'right') this.sun.position.set(18, 16, 6);
    else this.sun.position.set(4, 22, 8);

    this.wind.uWind.value = params.wind;
    this.leaves.visible = params.show.leaves;
    this.roots.visible = params.show.roots;
  }

  setTime(t: number): void {
    this.wind.uTime.value = t;
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose(): void {
    this.controls.dispose();
    this.branches.dispose();
    this.roots.dispose();
    this.leaves.dispose();
    this.canopyPoints.geometry.dispose();
    (this.canopyPoints.material as THREE.Material).dispose();
    this.rootPoints.geometry.dispose();
    (this.rootPoints.material as THREE.Material).dispose();
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
