import { api } from "@/services/api/client";
import {
  QrMemberCardSchema,
  QrScanResultSchema,
  type QrMemberCard,
  type QrScanResult,
} from "@/types";

export async function getMemberCard(): Promise<QrMemberCard> {
  const res = await api.get<unknown>("/api/v1/qr/member-card");
  return QrMemberCardSchema.parse(res);
}

export async function refreshMemberCard(): Promise<QrMemberCard> {
  const res = await api.post<unknown>("/api/v1/qr/member-card", {});
  return QrMemberCardSchema.parse(res);
}

export async function postScan(payload: {
  token: string;
}): Promise<QrScanResult> {
  const res = await api.post<unknown>("/api/v1/qr/scan", payload);
  return QrScanResultSchema.parse(res);
}

export async function scanQrCode(token: string): Promise<QrScanResult> {
  return postScan({ token });
}
