"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float } from "@react-three/drei";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import * as THREE from "three";

type Face = "U" | "D" | "F" | "B" | "R" | "L";
type Move = Face | `${Face}'` | `${Face}2`;

const MOVES: Move[] = [
  "R",
  "U",
  "R'",
  "U'",
  "F",
  "R",
  "U",
  "R'",
  "U'",
  "F'",
  "U",
  "R",
  "U'",
  "R'",
  "R'",
  "F",
  "R",
  "F'",
  "U2",
  "R",
  "U",
  "R'",
];

const DURATION = 0.95;
const GAP = 0.28;
const STEP = 0.52;
const SIZE = 0.48;

type Slot = { x: number; y: number; z: number };

function parseMove(move: Move): { face: Face; turns: number } {
  const face = move[0] as Face;
  if (move.endsWith("2")) return { face, turns: 2 };
  if (move.endsWith("'")) return { face, turns: -1 };
  return { face, turns: 1 };
}

function axisFor(face: Face): THREE.Vector3 {
  if (face === "R") return new THREE.Vector3(1, 0, 0);
  if (face === "L") return new THREE.Vector3(-1, 0, 0);
  if (face === "U") return new THREE.Vector3(0, 1, 0);
  if (face === "D") return new THREE.Vector3(0, -1, 0);
  if (face === "F") return new THREE.Vector3(0, 0, 1);
  return new THREE.Vector3(0, 0, -1);
}

function layerCoord(face: Face, s: Slot): number {
  if (face === "R" || face === "L") return s.x;
  if (face === "U" || face === "D") return s.y;
  return s.z;
}

function layerValue(face: Face): number {
  if (face === "R" || face === "U" || face === "F") return 1;
  return -1;
}

function turnSlot(s: Slot, face: Face, turns: number): Slot {
  const n = ((turns % 4) + 4) % 4;
  let { x, y, z } = s;
  for (let i = 0; i < n; i++) {
    if (face === "R") {
      const ny = -z;
      z = y;
      y = ny;
    } else if (face === "L") {
      const ny = z;
      z = -y;
      y = ny;
    } else if (face === "U") {
      const nx = z;
      z = -x;
      x = nx;
    } else if (face === "D") {
      const nx = -z;
      z = x;
      x = nx;
    } else if (face === "F") {
      const nx = y;
      y = -x;
      x = nx;
    } else if (face === "B") {
      const nx = -y;
      y = x;
      x = nx;
    }
  }
  return { x, y, z };
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function MetalCubie({ size }: { size: number }) {
  /** Dark charcoal metal — Resend-like, green light reads on the surface */
  const body = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#1a1a1e",
        metalness: 1,
        roughness: 0.28,
        clearcoat: 0.55,
        clearcoatRoughness: 0.35,
        envMapIntensity: 1.1,
      }),
    [],
  );
  const plate = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#2a2a30",
        metalness: 1,
        roughness: 0.22,
        clearcoat: 0.65,
        clearcoatRoughness: 0.28,
        envMapIntensity: 1.25,
        emissive: new THREE.Color("#0d2818"),
        emissiveIntensity: 0.25,
      }),
    [],
  );

  const s = size * 0.94;
  const h = s / 2 + 0.002;
  const plateSize = s * 0.78;

  return (
    <group>
      <mesh castShadow material={body}>
        <boxGeometry args={[s, s, s]} />
      </mesh>
      {(
        [
          { pos: [h, 0, 0] as const, rot: [0, Math.PI / 2, 0] as const },
          { pos: [-h, 0, 0] as const, rot: [0, -Math.PI / 2, 0] as const },
          { pos: [0, h, 0] as const, rot: [-Math.PI / 2, 0, 0] as const },
          { pos: [0, -h, 0] as const, rot: [Math.PI / 2, 0, 0] as const },
          { pos: [0, 0, h] as const, rot: [0, 0, 0] as const },
          { pos: [0, 0, -h] as const, rot: [0, Math.PI, 0] as const },
        ]
      ).map((f, i) => (
        <mesh
          key={i}
          position={[f.pos[0], f.pos[1], f.pos[2]]}
          rotation={[f.rot[0], f.rot[1], f.rot[2]]}
          material={plate}
        >
          <planeGeometry args={[plateSize, plateSize]} />
        </mesh>
      ))}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(s, s, s)]} />
        <lineBasicMaterial color="#34d399" transparent opacity={0.22} />
      </lineSegments>
    </group>
  );
}

type CubieRuntime = {
  slot: Slot;
  orient: THREE.Quaternion;
};

function RubiksCube({ playing }: { playing: boolean }) {
  const root = useRef<THREE.Group>(null);
  const cubieGroups = useRef<(THREE.Group | null)[]>([]);
  const slots = useRef<CubieRuntime[] | null>(null);

  const moveIndex = useRef(0);
  const phase = useRef(0);
  const waiting = useRef(0.9);
  const animating = useRef(false);

  const startPos = useRef<THREE.Vector3[]>([]);
  const startQuat = useRef<THREE.Quaternion[]>([]);
  const moveAxis = useRef(new THREE.Vector3(1, 0, 0));
  const moveAngle = useRef(0);
  const movingIds = useRef<number[]>([]);
  const currentFace = useRef<Face>("R");
  const currentTurns = useRef(1);

  const ids = useMemo(() => {
    const list: Slot[] = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          list.push({ x, y, z });
        }
      }
    }
    return list;
  }, []);

  const ensureSlots = () => {
    if (slots.current) return slots.current;
    if (!cubieGroups.current.every(Boolean)) return null;
    slots.current = ids.map((slot, i) => {
      const g = cubieGroups.current[i]!;
      g.position.set(slot.x * STEP, slot.y * STEP, slot.z * STEP);
      g.quaternion.identity();
      return { slot: { ...slot }, orient: new THREE.Quaternion() };
    });
    return slots.current;
  };

  const beginMove = (move: Move) => {
    const rt = ensureSlots();
    if (!rt) return;

    const { face, turns } = parseMove(move);
    currentFace.current = face;
    currentTurns.current = turns;
    moveAxis.current.copy(axisFor(face));
    moveAngle.current = turns * (Math.PI / 2);

    const layer = layerValue(face);
    movingIds.current = [];
    startPos.current = [];
    startQuat.current = [];

    rt.forEach((r, i) => {
      if (layerCoord(face, r.slot) !== layer) return;
      const g = cubieGroups.current[i]!;
      movingIds.current.push(i);
      startPos.current.push(g.position.clone());
      startQuat.current.push(g.quaternion.clone());
    });

    animating.current = true;
    phase.current = 0;
  };

  const finishMove = () => {
    const rt = slots.current;
    if (!rt) return;

    const face = currentFace.current;
    const turns = currentTurns.current;
    const quarter = Math.abs(turns) === 2 ? 2 : turns < 0 ? 3 : 1;
    const qDelta = new THREE.Quaternion().setFromAxisAngle(
      moveAxis.current,
      moveAngle.current,
    );

    movingIds.current.forEach((i, k) => {
      const r = rt[i]!;
      const g = cubieGroups.current[i]!;
      g.quaternion.copy(qDelta).multiply(startQuat.current[k]!);
      r.orient.copy(g.quaternion);
      r.slot = turnSlot(r.slot, face, quarter);
      // Snap hard to grid — kills drift
      g.position.set(r.slot.x * STEP, r.slot.y * STEP, r.slot.z * STEP);
    });

    animating.current = false;
    moveIndex.current = (moveIndex.current + 1) % MOVES.length;
    waiting.current = moveIndex.current === 0 ? 1.8 : GAP;
  };

  useFrame((_, dt) => {
    if (!playing) return;
    const t = performance.now() * 0.001;

    if (root.current) {
      root.current.rotation.x = 0.42 + Math.sin(t * 0.2) * 0.06;
      root.current.rotation.y = 0.5 + t * 0.1;
    }

    if (!slots.current) ensureSlots();

    if (!animating.current) {
      if (waiting.current > 0) {
        waiting.current -= dt;
        return;
      }
      if (cubieGroups.current.every(Boolean)) {
        beginMove(MOVES[moveIndex.current]!);
      }
      return;
    }

    const dur = DURATION * (Math.abs(moveAngle.current) > Math.PI / 2 + 0.01 ? 1.25 : 1);
    phase.current = Math.min(1, phase.current + dt / dur);
    const e = easeInOut(phase.current);
    const qDelta = new THREE.Quaternion().setFromAxisAngle(
      moveAxis.current,
      moveAngle.current * e,
    );

    movingIds.current.forEach((i, k) => {
      const g = cubieGroups.current[i];
      if (!g) return;
      g.position.copy(startPos.current[k]!).applyQuaternion(qDelta);
      g.quaternion.copy(qDelta).multiply(startQuat.current[k]!);
    });

    if (phase.current >= 1) finishMove();
  });

  return (
    <group scale={1.18}>
      <group ref={root}>
        {ids.map((slot, i) => (
          <group
            key={`${slot.x},${slot.y},${slot.z}`}
            ref={(el) => {
              setCubieRef(cubieGroups, i, el);
            }}
            position={[slot.x * STEP, slot.y * STEP, slot.z * STEP]}
          >
            <MetalCubie size={SIZE} />
          </group>
        ))}
      </group>
    </group>
  );
}

function setCubieRef(
  refs: MutableRefObject<(THREE.Group | null)[]>,
  i: number,
  el: THREE.Group | null,
) {
  refs.current[i] = el;
}

function SoftFloorGlow() {
  const tex = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(110, 231, 183, 0.45)");
    g.addColorStop(0.35, "rgba(52, 211, 153, 0.18)");
    g.addColorStop(0.65, "rgba(16, 185, 129, 0.05)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(canvas);
    t.needsUpdate = true;
    return t;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]}>
      <planeGeometry args={[5.5, 5.5]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={0.85}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function Scene({ playing }: { playing: boolean }) {
  return (
    <>
      <ambientLight intensity={0.18} />
      <directionalLight position={[5, 7, 4]} intensity={1.15} color="#f4f4f5" castShadow />
      {/* Green brand light washing the dark metal — Resend-style color recognition */}
      <spotLight
        position={[0, -1.2, 2.5]}
        angle={0.7}
        penumbra={0.85}
        intensity={3.2}
        color="#34d399"
      />
      <spotLight
        position={[-2.5, 2, 1]}
        angle={0.55}
        penumbra={0.8}
        intensity={1.6}
        color="#6ee7b7"
      />
      <pointLight position={[2, 1.5, -2]} intensity={0.7} color="#10b981" />
      <pointLight position={[0, -1.2, 0]} intensity={0.9} color="#34d399" distance={4} decay={2} />

      <Float
        speed={0.7}
        rotationIntensity={0.03}
        floatIntensity={0.1}
        position={[0, 0.45, 0]}
      >
        <RubiksCube playing={playing} />
      </Float>

      <SoftFloorGlow />

      <Environment preset="warehouse" environmentIntensity={0.45} />
    </>
  );
}

export function HeroNetworkMark({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setPlaying(Boolean(entry?.isIntersecting) && !reduced),
      { rootMargin: "80px 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div
      ref={wrapRef}
      className={className}
      role="img"
      aria-label="Metall Rubiks-kube som snurrer lag for lag"
    >
      <Canvas
        dpr={[1, 1.75]}
        shadows
        camera={{ position: [3.1, 1.85, 4.3], fov: 34, near: 0.1, far: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        style={{ width: "100%", height: "100%", display: "block", background: "transparent" }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0.35, 0);
        }}
      >
        <Suspense fallback={null}>
          <Scene playing={playing && !reduced} />
        </Suspense>
      </Canvas>
    </div>
  );
}
