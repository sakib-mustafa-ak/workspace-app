"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** Progressive enhancement: content stays visible without JS or motion support. */
export function MotionReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    if (element.getBoundingClientRect().top < window.innerHeight) {
      element.dataset.motion = "entered";
      return;
    }

    element.dataset.motion = "pending";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          element.dataset.motion = "entered";
          observer.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      delete element.dataset.motion;
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`motion-reveal ${className}`}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
