"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/Button";

export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  return <Button {...props} type="submit" disabled={pending}>{pending ? "Aguarde…" : children}</Button>;
}
