"use client";

import { useState, type ReactNode } from "react";

export function SafeAvatarImage(props: {
  src: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const [prevSrc, setPrevSrc] = useState(props.src);

  // Se o src mudar (ex: usuário escolheu uma nova foto), a imagem deve ser
  // tentada novamente — sem este reset o fallback escuro ficaria preso.
  if (prevSrc !== props.src) {
    setPrevSrc(props.src);
    setBroken(false);
  }

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
