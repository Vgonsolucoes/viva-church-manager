type FeedEvent = { id: string; type: string | null; startsAt: Date | string };

/** One source of truth for the home feed and the separate church lists. */
export function splitUpcomingEvents<T extends FeedEvent>(items: readonly T[], now = Date.now()) {
  const sorted = items.filter(item => new Date(item.startsAt).getTime() + 3_600_000 >= now)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  return {
    services: sorted.filter(item => item.type === "SERVICE"),
    events: sorted.filter(item => item.type !== "SERVICE"),
  };
}
