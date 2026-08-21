'use client';

import { useMemo } from 'react';

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
};

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 1.5,
    opacity: 0.15 + Math.random() * 0.25,
    duration: 25 + Math.random() * 20,
    delay: Math.random() * -40,
    driftX: (Math.random() - 0.5) * 80,
    driftY: (Math.random() - 0.5) * 60,
  }));
}

export function ParticleField({ count = 40 }: { count?: number }) {
  const particles = useMemo(() => generateParticles(count), [count]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle absolute rounded-full bg-primary-400"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animation: `particleDrift ${p.duration}s ease-in-out ${p.delay}s infinite`,
            ['--drift-x' as string]: `${p.driftX}px`,
            ['--drift-y' as string]: `${p.driftY}px`,
          }}
        />
      ))}
    </div>
  );
}
