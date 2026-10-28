"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Float,
  MeshReflectorMaterial,
  RoundedBox,
  Sparkles,
  Text,
} from "@react-three/drei";
import * as THREE from "three";

const CYCLE = 18;

function stageOf(t: number): 0 | 1 | 2 {
  const p = (t % CYCLE) / CYCLE;
  if (p < 0.34) return 0;
  if (p < 0.67) return 1;
  return 2;
}

function stageBlend(t: number) {
  const s = stageOf(t);
  const local = ((t % CYCLE) / CYCLE - s * (1 / 3)) / (1 / 3);
  return local * local * (3 - 2 * local);
}

const CAM = [
  {
    pos: new THREE.Vector3(-2.55, 1.85, 4.15),
    look: new THREE.Vector3(-2.35, 0.95, 0),
  },
  {
    pos: new THREE.Vector3(0.15, 2.35, 4.55),
    look: new THREE.Vector3(0.15, 1.05, 0),
  },
  {
    pos: new THREE.Vector3(2.95, 1.75, 4.0),
    look: new THREE.Vector3(2.7, 0.95, 0),
  },
] as const;

function CameraDirector() {
  const look = useRef(new THREE.Vector3());
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const s = stageOf(t);
    const next = ((s + 1) % 3) as 0 | 1 | 2;
    const ease = stageBlend(t);
    const blend = Math.max(0, (ease - 0.72) / 0.28);
    const from = CAM[s];
    const to = CAM[next];
    state.camera.position.lerpVectors(from.pos, to.pos, blend);
    state.camera.position.x += Math.sin(t * 0.42) * 0.07;
    state.camera.position.y += Math.cos(t * 0.31) * 0.045;
    state.camera.position.z += Math.sin(t * 0.22) * 0.04;
    look.current.lerpVectors(from.look, to.look, blend);
    look.current.y += Math.sin(t * 0.5) * 0.02;
    state.camera.lookAt(look.current);
  });
  return null;
}

function StageTracker({ onStage }: { onStage: (s: 0 | 1 | 2) => void }) {
  const last = useRef<0 | 1 | 2>(0);
  useFrame((state) => {
    const s = stageOf(state.clock.elapsedTime);
    if (s !== last.current) {
      last.current = s;
      onStage(s);
    }
  });
  return null;
}

/** Soft dust + rising motes so the void feels occupied */
function Atmosphere() {
  const dust = useMemo(() => {
    const n = 220;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 1] = Math.random() * 4.2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 7;
    }
    return arr;
  }, []);
  const rise = useMemo(() => {
    const n = 60;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 1] = Math.random() * 3;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    return { arr, n };
  }, []);
  const dustRef = useRef<THREE.Points>(null);
  const riseRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (dustRef.current) {
      dustRef.current.rotation.y = t * 0.018;
      const mat = dustRef.current.material as THREE.PointsMaterial;
      mat.opacity = 0.22 + Math.sin(t * 0.7) * 0.07;
    }
    if (riseRef.current) {
      const pos = riseRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < rise.n; i++) {
        let y = pos.getY(i) + 0.004 + (i % 5) * 0.0006;
        if (y > 3.6) y = 0.05;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <group>
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={dust.length / 3}
            array={dust}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.028}
          color="#86efac"
          transparent
          opacity={0.28}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      <points ref={riseRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={rise.n}
            array={rise.arr}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.045}
          color="#a7f3d0"
          transparent
          opacity={0.45}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

function EnergyRibbon() {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.35, 0.55, 0.55),
        new THREE.Vector3(-1.15, 0.85, 0.25),
        new THREE.Vector3(0.15, 1.05, 0.1),
        new THREE.Vector3(1.4, 0.9, 0.28),
        new THREE.Vector3(2.7, 0.7, 0.5),
      ]),
    []
  );
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 96, 0.012, 10, false), [curve]);
  const glow = useMemo(() => new THREE.TubeGeometry(curve, 64, 0.045, 10, false), [curve]);
  const couriers = useRef<THREE.Mesh[]>([]);
  const trails = useRef<THREE.Mesh[]>([]);
  const glowMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (glowMat.current) {
      glowMat.current.emissiveIntensity = 0.55 + Math.sin(t * 2.2) * 0.25;
      glowMat.current.opacity = 0.18 + Math.sin(t * 1.4) * 0.06;
    }
    couriers.current.forEach((mesh, i) => {
      if (!mesh) return;
      const u = ((t * 0.11 + i * 0.18) % 1 + 1) % 1;
      const p = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u);
      mesh.position.copy(p);
      mesh.lookAt(p.clone().add(tangent));
      mesh.scale.setScalar(0.85 + Math.sin(t * 5 + i) * 0.35);
    });
    trails.current.forEach((mesh, i) => {
      if (!mesh) return;
      const u = ((t * 0.11 + i * 0.18 - 0.03) % 1 + 1) % 1;
      mesh.position.copy(curve.getPointAt(u));
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.35 + Math.sin(t * 3 + i) * 0.15;
    });
  });

  return (
    <group>
      <mesh geometry={tube}>
        <meshStandardMaterial
          color="#064e3b"
          emissive="#10b981"
          emissiveIntensity={1.1}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={glow}>
        <meshStandardMaterial
          ref={glowMat}
          color="#10b981"
          emissive="#34d399"
          emissiveIntensity={0.6}
          transparent
          opacity={0.2}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <group key={i}>
          <mesh
            ref={(el) => {
              if (el) couriers.current[i] = el;
            }}
          >
            <sphereGeometry args={[0.06, 20, 20]} />
            <meshStandardMaterial
              color="#ecfdf5"
              emissive="#34d399"
              emissiveIntensity={2.8}
              toneMapped={false}
            />
          </mesh>
          <mesh
            ref={(el) => {
              if (el) trails.current[i] = el;
            }}
          >
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial
              color="#34d399"
              emissive="#10b981"
              emissiveIntensity={1.2}
              transparent
              opacity={0.35}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function LightPillar({
  position,
  stage,
  color,
}: {
  position: [number, number, number];
  stage: 0 | 1 | 2;
  color: string;
}) {
  const cone = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const active = stageOf(t) === stage;
    const target = active ? 1 : 0.08;
    if (cone.current) {
      const mat = cone.current.material as THREE.MeshStandardMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, active ? 0.14 : 0.02, 0.08);
      cone.current.scale.y = THREE.MathUtils.lerp(cone.current.scale.y, target, 0.08);
    }
    if (core.current) {
      const mat = core.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = active ? 1.6 + Math.sin(t * 4) * 0.5 : 0.15;
      core.current.scale.setScalar(active ? 1 + Math.sin(t * 3) * 0.08 : 0.6);
    }
  });
  return (
    <group position={position}>
      <mesh ref={cone} position={[0, 1.6, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.85, 3.4, 32, 1, true]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={core} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.95, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function FloorGrid() {
  const lines = useMemo(() => {
    const pts: number[] = [];
    const span = 7;
    const step = 0.55;
    for (let x = -span; x <= span; x += step) {
      pts.push(x, 0.002, -span, x, 0.002, span);
    }
    for (let z = -span; z <= span; z += step) {
      pts.push(-span, 0.002, z, span, 0.002, z);
    }
    return new Float32Array(pts);
  }, []);
  const mat = useRef<THREE.LineBasicMaterial>(null);
  useFrame((state) => {
    if (!mat.current) return;
    mat.current.opacity = 0.07 + Math.sin(state.clock.elapsedTime * 0.9) * 0.025;
  });
  return (
    <lineSegments position={[0, -0.7, 0]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={lines.length / 3}
          array={lines}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial ref={mat} color="#34d399" transparent opacity={0.08} />
    </lineSegments>
  );
}

function GlassCard({
  position,
  rotation,
  scale = 1,
  delay = 0,
  accent = "#34d399",
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  delay?: number;
  accent?: string;
}) {
  const ref = useRef<THREE.Group>(null);
  const edge = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 1.7 + delay) * 0.06;
    ref.current.rotation.z = (rotation?.[2] ?? 0.1) + Math.sin(t * 0.75 + delay) * 0.035;
    ref.current.rotation.x = (rotation?.[0] ?? -0.42) + Math.sin(t * 0.4 + delay) * 0.02;
    if (edge.current) {
      edge.current.emissiveIntensity = 0.35 + Math.sin(t * 2.5 + delay) * 0.2;
    }
  });

  return (
    <group ref={ref} position={position} rotation={rotation ?? [-0.42, 0.38, 0.1]}>
      <RoundedBox
        args={[1.25 * scale, 0.82 * scale, 0.08]}
        radius={0.08}
        smoothness={8}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#061410"
          metalness={0.35}
          roughness={0.08}
          transmission={0.72}
          thickness={0.7}
          ior={1.5}
          transparent
          opacity={0.96}
          envMapIntensity={2.2}
          clearcoat={1}
          clearcoatRoughness={0.06}
          emissive={accent}
          emissiveIntensity={0.18}
        />
      </RoundedBox>
      {/* Chrome rim */}
      <RoundedBox args={[1.27 * scale, 0.84 * scale, 0.03]} radius={0.08} position={[0, 0, -0.03]}>
        <meshStandardMaterial
          ref={edge}
          color="#134e4a"
          metalness={1}
          roughness={0.15}
          emissive={accent}
          emissiveIntensity={0.4}
          toneMapped={false}
        />
      </RoundedBox>
      <mesh position={[0, 0.14 * scale, 0.045]}>
        <planeGeometry args={[0.72 * scale, 0.05]} />
        <meshBasicMaterial color={accent} transparent opacity={0.7} />
      </mesh>
      <mesh position={[-0.06 * scale, 0.0, 0.045]}>
        <planeGeometry args={[0.55 * scale, 0.032]} />
        <meshBasicMaterial color="#ecfdf5" transparent opacity={0.22} />
      </mesh>
      <mesh position={[0.05 * scale, -0.1 * scale, 0.045]}>
        <planeGeometry args={[0.4 * scale, 0.028]} />
        <meshBasicMaterial color="#ecfdf5" transparent opacity={0.12} />
      </mesh>
      <mesh position={[0.3 * scale, -0.2 * scale, 0.045]}>
        <circleGeometry args={[0.05 * scale, 20]} />
        <meshBasicMaterial color={accent} />
      </mesh>
    </group>
  );
}

function QueueStation({ count }: { count: string }) {
  const halo = useRef<THREE.MeshStandardMaterial>(null);
  const pedestal = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const active = stageOf(t) === 0;
    if (halo.current) {
      halo.current.emissiveIntensity = active
        ? 1.1 + Math.sin(t * 3.2) * 0.45
        : 0.22;
      halo.current.opacity = active ? 0.65 : 0.28;
    }
    if (pedestal.current) {
      pedestal.current.rotation.y = t * 0.15;
    }
  });

  return (
    <group position={[-2.4, 0, 0]}>
      <mesh position={[0, -0.52, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.28, 1.48, 0.4, 64]} />
        <meshStandardMaterial
          color="#090909"
          metalness={0.96}
          roughness={0.12}
          envMapIntensity={1.4}
        />
      </mesh>
      <mesh ref={pedestal} position={[0, -0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.65, 1.18, 64]} />
        <meshStandardMaterial
          ref={halo}
          color="#064e3b"
          emissive="#10b981"
          emissiveIntensity={0.4}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      <Float speed={1.5} rotationIntensity={0.28} floatIntensity={0.4}>
        <GlassCard position={[0.04, 1.22, 0.22]} delay={0} />
        <GlassCard position={[0.14, 0.96, 0.1]} delay={0.4} scale={0.96} />
        <GlassCard position={[-0.12, 0.72, 0.0]} delay={0.9} scale={0.92} />
        <GlassCard position={[0.08, 0.48, -0.08]} delay={1.3} scale={0.88} />
        <GlassCard position={[-0.05, 0.26, -0.16]} delay={1.8} scale={0.84} accent="#6ee7b7" />
        <GlassCard position={[0.1, 0.06, -0.22]} delay={2.2} scale={0.78} accent="#a7f3d0" />
      </Float>

      <Sparkles
        count={42}
        scale={[2.4, 2.6, 1.6]}
        position={[0, 0.95, 0]}
        size={3}
        speed={0.65}
        color="#6ee7b7"
        opacity={0.75}
      />

      <Text
        position={[0, 2.18, 0.55]}
        fontSize={0.52}
        color="#ecfdf5"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.018}
        outlineColor="#022c22"
      >
        {count}
      </Text>
      <Text
        position={[0, 1.78, 0.55]}
        fontSize={0.11}
        color="#6ee7b7"
        anchorX="center"
        letterSpacing={0.28}
      >
        I KØ
      </Text>
    </group>
  );
}

function SmartStation() {
  const core = useRef<THREE.Mesh>(null);
  const scan = useRef<THREE.Mesh>(null);
  const orbit = useRef<THREE.Group>(null);
  const chipMats = useRef<THREE.MeshStandardMaterial[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const active = stageOf(t) === 1;
    if (core.current) {
      core.current.rotation.y = t * 1.6;
      core.current.rotation.x = Math.sin(t * 1.1) * 0.4;
      const mat = core.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = active ? 1.8 + Math.sin(t * 5) * 0.6 : 0.25;
      core.current.scale.setScalar(active ? 1 + Math.sin(t * 4.2) * 0.1 : 0.82);
    }
    if (scan.current) {
      scan.current.position.y = 0.12 + ((t * 0.7) % 1.15);
      const mat = scan.current.material as THREE.MeshStandardMaterial;
      mat.opacity = active ? 0.55 : 0.08;
    }
    if (orbit.current) {
      orbit.current.rotation.y = t * 0.55;
      orbit.current.rotation.z = Math.sin(t * 0.4) * 0.15;
    }
    for (const mat of chipMats.current) {
      mat.emissiveIntensity = active ? 0.9 + Math.sin(t * 3.5) * 0.3 : 0.12;
    }
  });

  const cols = [
    { x: -0.82, color: "#34d399", n: 5, label: "A" },
    { x: 0, color: "#fbbf24", n: 4, label: "B" },
    { x: 0.82, color: "#94a3b8", n: 3, label: "C" },
  ] as const;

  return (
    <group position={[0.2, 0, 0]}>
      <mesh position={[0, -0.52, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.05, 0.34, 1.85]} />
        <meshStandardMaterial color="#070707" metalness={0.97} roughness={0.12} />
      </mesh>
      {/* Gloss top strip */}
      <mesh position={[0, -0.34, 0.7]} rotation={[-0.15, 0, 0]}>
        <planeGeometry args={[2.8, 0.08]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.35} />
      </mesh>

      <RoundedBox args={[2.85, 1.55, 0.1]} radius={0.05} position={[0, 0.58, -0.6]} castShadow>
        <meshPhysicalMaterial
          color="#0a0c0b"
          metalness={0.85}
          roughness={0.22}
          clearcoat={0.8}
          envMapIntensity={1.2}
        />
      </RoundedBox>

      <mesh ref={core} position={[0, 1.85, 0]}>
        <icosahedronGeometry args={[0.28, 1]} />
        <meshStandardMaterial
          color="#a7f3d0"
          emissive="#34d399"
          emissiveIntensity={1}
          metalness={0.4}
          roughness={0.08}
          toneMapped={false}
        />
      </mesh>

      <group ref={orbit} position={[0, 1.85, 0]}>
        <mesh>
          <torusGeometry args={[0.48, 0.01, 12, 80]} />
          <meshStandardMaterial
            color="#6ee7b7"
            emissive="#10b981"
            emissiveIntensity={1.1}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, 0.4, 0]}>
          <torusGeometry args={[0.58, 0.008, 10, 80]} />
          <meshStandardMaterial
            color="#7dd3fc"
            emissive="#38bdf8"
            emissiveIntensity={0.9}
            toneMapped={false}
          />
        </mesh>
      </group>

      {cols.map((col) => (
        <group key={col.label} position={[col.x, 0, 0]}>
          <RoundedBox args={[0.66, 1.42, 0.85]} radius={0.07} position={[0, 0.42, 0]} castShadow>
            <meshPhysicalMaterial
              color="#0b1210"
              metalness={0.7}
              roughness={0.16}
              transmission={0.35}
              thickness={0.5}
              transparent
              opacity={0.92}
              envMapIntensity={1.5}
              clearcoat={1}
            />
          </RoundedBox>
          <Text position={[0, 1.28, 0.45]} fontSize={0.12} color={col.color} anchorX="center">
            {col.label}
          </Text>
          {Array.from({ length: col.n }).map((_, i) => (
            <Float key={i} speed={2.2 + i * 0.25} floatIntensity={0.18} rotationIntensity={0.06}>
              <mesh position={[0, 0.02 + i * 0.22, 0.45]} castShadow>
                <boxGeometry args={[0.44, 0.13, 0.055]} />
                <meshStandardMaterial
                  ref={(mat) => {
                    if (mat && !chipMats.current.includes(mat)) chipMats.current.push(mat);
                  }}
                  color={col.color}
                  emissive={col.color}
                  emissiveIntensity={0.3}
                  metalness={0.4}
                  roughness={0.22}
                  toneMapped={false}
                />
              </mesh>
            </Float>
          ))}
        </group>
      ))}

      <mesh ref={scan} position={[0, 0.2, 0.55]}>
        <planeGeometry args={[2.55, 0.04]} />
        <meshStandardMaterial
          color="#6ee7b7"
          emissive="#34d399"
          emissiveIntensity={2}
          transparent
          opacity={0.4}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      <Sparkles
        count={48}
        scale={[3.2, 2.4, 1.8]}
        position={[0, 1.05, 0]}
        size={2.4}
        speed={0.8}
        color="#86efac"
        opacity={0.65}
      />

      <Text
        position={[0, 2.35, 0]}
        fontSize={0.12}
        color="#a7f3d0"
        anchorX="center"
        letterSpacing={0.16}
      >
        AI SORTERER
      </Text>
    </group>
  );
}

function WaveBar({ index }: { index: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const active = stageOf(t) === 2;
    const h =
      0.035 +
      Math.abs(Math.sin(t * (active ? 5.5 : 2.2) + index * 0.75)) *
        (active ? 0.18 : 0.07);
    ref.current.scale.y = h / 0.08;
    ref.current.position.y = -0.16 + h / 2;
  });
  return (
    <mesh ref={ref} position={[-0.14 + index * 0.07, -0.16, 0.055]}>
      <boxGeometry args={[0.04, 0.08, 0.012]} />
      <meshBasicMaterial color="#6ee7b7" transparent opacity={0.9} />
    </mesh>
  );
}

function RingStation() {
  const phone = useRef<THREE.Group>(null);
  const orb = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  const phoneMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const pulse = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const active = stageOf(t) === 2;
    if (phone.current) {
      phone.current.rotation.y = -0.35 + Math.sin(t * 0.9) * 0.4;
      phone.current.rotation.x = 0.18 + Math.sin(t * 0.55) * 0.06;
      phone.current.position.y = 0.55 + Math.sin(t * 1.4) * 0.05;
    }
    if (orb.current) {
      orb.current.position.y = 1.3 + Math.sin(t * 2.4) * 0.12;
      const mat = orb.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = active ? 2.4 + Math.sin(t * 5.5) * 0.8 : 0.3;
      orb.current.scale.setScalar(active ? 1 + Math.sin(t * 3) * 0.08 : 0.85);
    }
    if (rings.current) {
      rings.current.rotation.z = t * 0.75;
      rings.current.rotation.x = Math.PI / 2.35 + Math.sin(t * 0.5) * 0.08;
      rings.current.scale.setScalar(active ? 1 + Math.sin(t * 2) * 0.05 : 0.9);
    }
    if (screen.current) screen.current.emissiveIntensity = active ? 1.4 : 0.18;
    if (phoneMat.current) phoneMat.current.emissiveIntensity = active ? 0.7 : 0.1;
    if (pulse.current) {
      const s = 1 + ((t * 1.2) % 1.4);
      pulse.current.scale.setScalar(s);
      const mat = pulse.current.material as THREE.MeshStandardMaterial;
      mat.opacity = active ? Math.max(0, 0.35 - (s - 1) * 0.25) : 0;
    }
  });

  return (
    <group position={[2.7, 0, 0]}>
      <mesh position={[0, -0.52, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.18, 1.32, 0.38, 64]} />
        <meshStandardMaterial color="#090909" metalness={0.95} roughness={0.12} />
      </mesh>

      <group ref={phone} position={[-0.32, 0.55, 0.22]}>
        <RoundedBox args={[0.64, 1.2, 0.1]} radius={0.1} castShadow>
          <meshPhysicalMaterial
            ref={phoneMat}
            color="#021a14"
            metalness={0.75}
            roughness={0.08}
            clearcoat={1}
            clearcoatRoughness={0.05}
            emissive="#064e3b"
            emissiveIntensity={0.15}
          />
        </RoundedBox>
        <mesh position={[0, 0.12, 0.055]}>
          <planeGeometry args={[0.46, 0.74]} />
          <meshStandardMaterial
            ref={screen}
            color="#03241a"
            emissive="#10b981"
            emissiveIntensity={0.3}
            toneMapped={false}
          />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <WaveBar key={i} index={i} />
        ))}
      </group>

      <mesh ref={orb} position={[0.62, 1.3, 0.28]}>
        <sphereGeometry args={[0.28, 64, 64]} />
        <meshPhysicalMaterial
          color="#86efac"
          emissive="#34d399"
          emissiveIntensity={1.8}
          metalness={0.2}
          roughness={0.05}
          clearcoat={1}
          transmission={0.15}
          thickness={0.4}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={pulse} position={[0.62, 1.3, 0.28]}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial
          color="#34d399"
          emissive="#10b981"
          emissiveIntensity={1}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <group ref={rings} position={[0.62, 1.3, 0.28]}>
        <mesh>
          <torusGeometry args={[0.44, 0.014, 16, 96]} />
          <meshStandardMaterial
            color="#6ee7b7"
            emissive="#34d399"
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[0, Math.PI / 3, 0]}>
          <torusGeometry args={[0.56, 0.01, 12, 96]} />
          <meshStandardMaterial
            color="#7dd3fc"
            emissive="#38bdf8"
            emissiveIntensity={0.9}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[Math.PI / 3, 0.5, 0.2]}>
          <torusGeometry args={[0.68, 0.006, 10, 96]} />
          <meshStandardMaterial
            color="#a7f3d0"
            emissive="#6ee7b7"
            emissiveIntensity={0.7}
            transparent
            opacity={0.7}
            toneMapped={false}
          />
        </mesh>
      </group>

      <Sparkles
        count={55}
        scale={[2.6, 2.6, 1.8]}
        position={[0.2, 1.05, 0.2]}
        size={3.2}
        speed={0.95}
        color="#6ee7b7"
        opacity={0.8}
      />

      <Text position={[-0.35, -0.02, 0.9]} fontSize={0.11} color="#e4e4e7" anchorX="center">
        Ring selv
      </Text>
      <Text position={[0.62, -0.02, 0.9]} fontSize={0.11} color="#6ee7b7" anchorX="center">
        AI ringer
      </Text>
    </group>
  );
}

function LivingLights() {
  const a = useRef<THREE.PointLight>(null);
  const b = useRef<THREE.PointLight>(null);
  const c = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const s = stageOf(t);
    if (a.current) {
      a.current.intensity = (s === 0 ? 2.2 : 0.9) + Math.sin(t * 1.6) * 0.35;
      a.current.position.x = -2.4 + Math.sin(t * 0.45) * 0.35;
    }
    if (b.current) {
      b.current.intensity = (s === 1 ? 2.0 : 0.75) + Math.cos(t * 1.3) * 0.3;
      b.current.position.x = 0.2 + Math.cos(t * 0.4) * 0.3;
    }
    if (c.current) {
      c.current.intensity = (s === 2 ? 2.4 : 0.85) + Math.sin(t * 1.8) * 0.4;
      c.current.position.x = 2.7 + Math.sin(t * 0.38) * 0.3;
    }
  });
  return (
    <>
      <pointLight ref={a} position={[-2.4, 3.4, 2.2]} intensity={1.4} color="#34d399" distance={10} />
      <pointLight ref={b} position={[0.2, 3.2, 2]} intensity={1.1} color="#86efac" distance={10} />
      <pointLight ref={c} position={[2.7, 3.0, 1.8]} intensity={1.2} color="#7dd3fc" distance={10} />
    </>
  );
}

export function OverviewFlowScene({
  queueCount,
  onStage,
}: {
  queueCount: number;
  onStage?: (s: 0 | 1 | 2) => void;
}) {
  const count = queueCount > 9999 ? "9999+" : String(queueCount);

  return (
    <>
      <color attach="background" args={["#030303"]} />
      <fog attach="fog" args={["#030303", 6.5, 14]} />

      <ambientLight intensity={0.22} />
      <spotLight
        position={[4.5, 10, 5.5]}
        angle={0.38}
        penumbra={0.8}
        intensity={3.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        color="#f0fdf4"
      />
      <spotLight
        position={[-5, 6, 3]}
        angle={0.5}
        penumbra={0.9}
        intensity={1.1}
        color="#34d399"
      />
      <LivingLights />
      <Environment preset="night" environmentIntensity={0.85} />

      <CameraDirector />
      {onStage ? <StageTracker onStage={onStage} /> : null}

      <Atmosphere />
      <FloorGrid />
      <EnergyRibbon />

      <LightPillar position={[-2.4, 0, 0]} stage={0} color="#34d399" />
      <LightPillar position={[0.2, 0, 0]} stage={1} color="#86efac" />
      <LightPillar position={[2.7, 0, 0]} stage={2} color="#7dd3fc" />

      <QueueStation count={count} />
      <SmartStation />
      <RingStation />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.72, 0]} receiveShadow>
        <circleGeometry args={[9, 96]} />
        <MeshReflectorMaterial
          blur={[350, 100]}
          resolution={1024}
          mixBlur={0.9}
          mixStrength={0.85}
          roughness={0.82}
          depthScale={0.7}
          minDepthThreshold={0.35}
          maxDepthThreshold={1.35}
          color="#050505"
          metalness={0.78}
          mirror={0.42}
        />
      </mesh>

      <ContactShadows
        position={[0, -0.71, 0]}
        opacity={0.72}
        scale={16}
        blur={2.6}
        far={7}
      />

    </>
  );
}
