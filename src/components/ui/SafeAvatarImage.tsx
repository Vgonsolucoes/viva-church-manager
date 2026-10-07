"use client";

import { useState, type ReactNode } from "react";

export function SafeAvatarImage(props: {
  src: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) return <>{props.fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={props.src}
      alt={props.alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={props.className}
      onError={() => setBroken(true)}
    />
  );
}
