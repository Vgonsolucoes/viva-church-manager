import { api } from "@/services/api/client";

export type PushDeviceRegisterInput = {
  expoPushToken: string;
  platform?: string | null;
  deviceName?: string | null;
  appVersion?: string | null;
};

export async function registerPushDevice(input: PushDeviceRegisterInput) {
  return api.post<{ ok: boolean; id?: string; error?: string }>(
    "/api/v1/push/devices",
    {
      expoPushToken: input.expoPushToken,
      platform: input.platform ?? null,
      deviceName: input.deviceName ?? null,
      appVersion: input.appVersion ?? null,
    },
  );
}

export async function unregisterPushDevice(expoPushToken: string) {
  return api.request<{ ok: boolean; error?: string }>(
    "/api/v1/push/devices",
    { method: "DELETE", body: { expoPushToken } },
  );
}
