"use client";

import React, { Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";

import { cn } from "@/lib/utils";
import {
  AvatarModel,
  type AvatarModelStatus,
  type AvatarMode,
} from "@/components/3d/AvatarModel";

export function AvatarScene(props: {
  modelUrl: string;
  mode: AvatarMode;
  speakingLevelRef: React.MutableRefObject<number>;
  listeningLevelRef: React.MutableRefObject<number>;
  cursorRef?: React.MutableRefObject<{ x: number; y: number }>;
  offset?: [number, number, number];
  className?: string;
  onStatus?: (s: AvatarModelStatus) => void;
}) {
  const {
    modelUrl,
    mode,
    speakingLevelRef,
    listeningLevelRef,
    cursorRef,
    offset,
    className,
    onStatus,
  } = props;

  const cameraTarget: [number, number, number] = [
    offset?.[0] ?? 0,
    1.35 + (offset?.[1] ?? 0),
    0,
  ];

  return (
    <div className={cn("absolute inset-0 z-0", className)}>
      <Canvas
        className="h-full w-full"
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        camera={{
          fov: 28,
          near: 0.1,
          far: 100,
          position: [0.0, 1.4, 2.2],
        }}
        onCreated={({ gl }) => {
          try {
            gl.setClearColor(0x000000, 0);
          } catch {
            // ignore
          }
        }}
      >
        <CameraAim target={cameraTarget} />

        {/* Soft ambient lighting + simple key/fill/rim */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[1.25, 1.55, 2.25]} intensity={1.15} />
        <directionalLight position={[-1.3, 1.1, -1.6]} intensity={0.35} />
        <directionalLight position={[-1.6, 1.6, 0.2]} intensity={0.45} />

        <Suspense fallback={null}>
          <AvatarModel
            modelUrl={modelUrl}
            mode={mode}
            speakingLevelRef={speakingLevelRef}
            listeningLevelRef={listeningLevelRef}
            cursorRef={cursorRef}
            offset={offset}
            onStatus={onStatus}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

function CameraAim(props: { target: [number, number, number] }) {
  useFrame((state) => {
    state.camera.lookAt(props.target[0], props.target[1], props.target[2]);
  });

  return null;
}
