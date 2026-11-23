import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { api, ApiError } from "@/services/api/client";

const GEOFENCE_TASK = "viva-church-arrival-geofence";
const LOCATION_TASK = "viva-church-arrival-location";
const DEVICE_ENABLED = "viva.arrival.device-member";
const CONFIG_CACHE = "viva.arrival.config";
const LAST_RESULT = "viva.arrival.last-result";
export type ArrivalStatus = {
  memberId: string;
  consent: boolean;
  config: {
    enabled: boolean;
    address: string;
    latitude: number | null;
    longitude: number | null;
    radiusMeters: number;
  };
  services: {
    id: string;
    name: string;
    startsAt: string;
    from: string;
    to: string;
  }[];
};
type CachedStatus = ArrivalStatus & { fetchedAt: number };
let syncing: Promise<void> | null = null;
let monitorGeneration = 0;

export async function getArrivalStatus() {
  return api.get<ArrivalStatus>("/api/v1/arrival/config");
}
export async function isArrivalEnabledHere(memberId: string) {
  return (await AsyncStorage.getItem(DEVICE_ENABLED)) === memberId;
}
export async function lastArrivalResult() {
  const raw = await AsyncStorage.getItem(LAST_RESULT);
  return raw ? (JSON.parse(raw) as { message: string; date: string }) : null;
}
async function remember(message: string) {
  await AsyncStorage.setItem(
    LAST_RESULT,
    JSON.stringify({ message, date: new Date().toISOString() }),
  );
}
export async function stopArrivalMonitoring(clearPreference = false) {
  monitorGeneration += 1;
  if (clearPreference)
    await AsyncStorage.multiRemove([DEVICE_ENABLED, CONFIG_CACHE, LAST_RESULT]);
  if (Platform.OS !== "web") {
    await Promise.allSettled([
      (async () => {
        if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))
          await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      })(),
      (async () => {
        if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK))
          await Location.stopGeofencingAsync(GEOFENCE_TASK);
      })(),
    ]);
  }
}
async function cacheStatus(status: ArrivalStatus) {
  await AsyncStorage.setItem(
    CONFIG_CACHE,
    JSON.stringify({ ...status, fetchedAt: Date.now() }),
  );
}
async function positionNow() {
  const last = await Location.getLastKnownPositionAsync({
    maxAge: 60000,
    requiredAccuracy: 100,
  });
  return (
    last ??
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
  );
}
async function sendPosition(
  location: Location.LocationObject,
  action: "ENTER" | "EXIT" | "PING",
  force = false,
) {
  const raw = await AsyncStorage.getItem(CONFIG_CACHE);
  if (!raw) return null;
  let status = JSON.parse(raw) as CachedStatus;
  if (Date.now() - status.fetchedAt > 6 * 3600000) {
    const current = await getArrivalStatus();
    await cacheStatus(current);
    status = { ...current, fetchedAt: Date.now() };
  }
  if (
    !status.consent ||
    !status.config.enabled ||
    !(await isArrivalEnabledHere(status.memberId))
  ) {
    await stopArrivalMonitoring();
    return null;
  }
  const observed = location.timestamp;
  const inService = status.services.some(
    (service) =>
      observed >= Date.parse(service.from) &&
      observed <= Date.parse(service.to),
  );
  if (!inService && !force) return null;
  if (location.coords.accuracy === null || location.coords.accuracy > 100) {
    throw new Error("Aguarde o GPS melhorar a precisão e tente novamente.");
  }
  const result = await api.post<{
    ok: boolean;
    message: string;
    count: number;
  }>("/api/v1/arrival/observe", {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    observedAt: new Date(location.timestamp).toISOString(),
    action,
  });
  await remember(result.message);
  return result;
}
async function startInsideMonitoring() {
  const generation = monitorGeneration;
  if (!(await AsyncStorage.getItem(DEVICE_ENABLED))) return;
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 120000,
    distanceInterval: 0,
    deferredUpdatesInterval: 120000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Chegada à igreja ativada",
      notificationBody:
        "Confirmando sua presença nos horários de culto. Desative em Perfil → Chegada à igreja.",
      notificationColor: "#9C7058",
      killServiceOnDestroy: false,
    },
  });
  if (
    generation !== monitorGeneration ||
    !(await AsyncStorage.getItem(DEVICE_ENABLED))
  )
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
}
async function backgroundFailure(error: unknown) {
  await remember(
    error instanceof Error
      ? error.message
      : "Não foi possível sincronizar a chegada.",
  );
  if (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403)
  )
    await stopArrivalMonitoring(true);
  if (
    error instanceof ApiError &&
    (error.data as { code?: string } | null)?.code === "NOT_CONFIGURED"
  )
    await stopArrivalMonitoring();
}
if (Platform.OS !== "web") {
  TaskManager.defineTask<{
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  }>(GEOFENCE_TASK, async ({ data, error }) => {
    if (error) {
      await remember(error.message);
      return;
    }
    if (!data || !(await AsyncStorage.getItem(DEVICE_ENABLED))) return;
    try {
      const entering = data.eventType === Location.GeofencingEventType.Enter;
      if (entering) await startInsideMonitoring();
      else if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      const location = entering
        ? await positionNow()
        : await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
      await sendPosition(location, entering ? "ENTER" : "EXIT");
    } catch (failure) {
      await backgroundFailure(failure);
    }
  });
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    LOCATION_TASK,
    async ({ data, error }) => {
      if (error) {
        await remember(error.message);
        return;
      }
      const location = data?.locations[data.locations.length - 1];
      if (!location) return;
      try {
        await sendPosition(location, "PING");
      } catch (failure) {
        await backgroundFailure(failure);
      }
    },
  );
}

export async function syncArrivalMonitoring() {
  if (syncing || Platform.OS === "web") return syncing;
  const generation = monitorGeneration;
  syncing = (async () => {
    const status = await getArrivalStatus();
    await cacheStatus(status);
    const deviceEnabled = await isArrivalEnabledHere(status.memberId);
    const background = await Location.getBackgroundPermissionsAsync();
    if (
      !deviceEnabled ||
      !status.consent ||
      !status.config.enabled ||
      !background.granted ||
      status.config.latitude === null ||
      status.config.longitude === null
    ) {
      await stopArrivalMonitoring();
      return;
    }
    if (
      generation !== monitorGeneration ||
      !(await isArrivalEnabledHere(status.memberId))
    )
      return;
    await Location.startGeofencingAsync(GEOFENCE_TASK, [
      {
        identifier: "viva-church",
        latitude: status.config.latitude,
        longitude: status.config.longitude,
        radius: status.config.radiusMeters,
        notifyOnEnter: true,
        notifyOnExit: true,
      },
    ]);
    if (
      generation !== monitorGeneration ||
      !(await isArrivalEnabledHere(status.memberId))
    ) {
      await stopArrivalMonitoring();
      return;
    }
    const location = await positionNow();
    const north = (location.coords.latitude - status.config.latitude) * 111320;
    const east =
      (location.coords.longitude - status.config.longitude) *
      111320 *
      Math.cos((status.config.latitude * Math.PI) / 180);
    if (Math.hypot(north, east) <= status.config.radiusMeters)
      await startInsideMonitoring();
    try {
      await sendPosition(location, "PING");
    } catch (error) {
      await remember(
        error instanceof Error ? error.message : "Aguardando chegada à igreja.",
      );
    }
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}
export async function enableArrivalHere() {
  if (Platform.OS === "web")
    throw new Error(
      "Use o aplicativo instalado para ativar a chegada automática.",
    );
  const status = await getArrivalStatus();
  if (!status.config.enabled)
    throw new Error("A igreja ainda não ativou o check-in por localização.");
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted)
    throw new Error("Autorize a localização para confirmar sua chegada.");
  await api.post("/api/v1/arrival/consent", { enabled: true });
  await AsyncStorage.setItem(DEVICE_ENABLED, status.memberId);
  await cacheStatus({ ...status, consent: true });
}
export async function requestBackgroundArrival() {
  const permission = await Location.requestBackgroundPermissionsAsync();
  if (syncing) await syncing.catch(() => {});
  await syncArrivalMonitoring();
  return permission.granted;
}
export async function disableArrivalHere() {
  await stopArrivalMonitoring(true);
  await api.post("/api/v1/arrival/consent", { enabled: false });
}
export async function confirmArrivalNow() {
  const status = await getArrivalStatus();
  if (!status.consent || !(await isArrivalEnabledHere(status.memberId)))
    throw new Error("Ative a confirmação de chegada primeiro.");
  await cacheStatus(status);
  if (!(await Location.hasServicesEnabledAsync()))
    throw new Error("Ative a localização do celular e tente novamente.");
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted)
    throw new Error("Autorize a localização nas configurações do celular.");
  return sendPosition(await positionNow(), "ENTER", true);
}
