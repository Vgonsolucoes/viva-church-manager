import React from "react";
import { Badge } from "./Badge";

export type ScheduleStatus =
  | "PENDING"
  | "CONFIRMED"
  | "REFUSED"
  | "SUBSTITUTION_REQUESTED"
  | "SUBSTITUTION_APPROVED";

interface StatusBadgeProps {
  status: ScheduleStatus | string;
  customLabel?: string;
}

export function StatusBadge({ status, customLabel }: StatusBadgeProps) {
  switch (status) {
    case "CONFIRMED":
    case "APPROVED":
      return <Badge label={customLabel ?? "Confirmado"} variant="success" />;
    case "REFUSED":
    case "REJECTED":
      return <Badge label={customLabel ?? "Recusado"} variant="danger" />;
    case "SUBSTITUTION_REQUESTED":
    case "VOLUNTEER_B_ACCEPTED":
      return <Badge label={customLabel ?? "Substituição"} variant="purple" />;
    case "SUBSTITUTION_APPROVED":
      return <Badge label={customLabel ?? "Aprovado"} variant="cyan" />;
    case "PENDING":
    default:
      return <Badge label={customLabel ?? "Aguardando"} variant="muted" />;
  }
}
