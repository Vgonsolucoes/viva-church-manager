export type RoleKey =
  | "SUPER_ADMIN"
  | "PASTOR_PRESIDENTE"
  | "PASTOR"
  | "MINISTRY_LEADER"
  | "CELL_LEADER"
  | "VOLUNTEER"
  | "MEMBER"
  | "FINANCE"
  | "SECRETARY"
  | "RECEPTION"
  | "KIDS_MINISTRY"
  | "PARKING";

export type PermissionKey =
  | "admin:access"
  | "dashboard:view"
  | "members:read"
  | "members:write"
  | "volunteers:read"
  | "volunteers:write"
  | "schedules:read"
  | "schedules:write"
  | "schedules:confirm"
  | "schedules:substitution:request"
  | "ministries:read"
  | "ministries:write"
  | "calendar:read"
  | "calendar:write"
  | "events:read"
  | "events:write"
  | "courses:read"
  | "courses:write"
  | "followup:read"
  | "followup:write"
  | "cells:read"
  | "cells:write"
  | "discipleships:read"
  | "discipleships:write"
  | "discipleship:my:read"
  | "discipleship:my:write"
  | "kids:read"
  | "kids:write"
  | "kids:checkin:self"
  | "assets:read"
  | "assets:write"
  | "lostfound:read"
  | "lostfound:write"
  | "finance:read"
  | "finance:write"
  | "budget:read"
  | "budget:write"
  | "notifications:read"
  | "notifications:write"
  | "reports:view"
  | "settings:manage"
  | "pastoral:notes:read"
  | "pastoral:notes:write"
  | "prayer:read"
  | "prayer:write"
  | "profile:self:edit"
  | "youtube:read"
  | "youtube:write";

export const rolePermissions: Record<RoleKey, PermissionKey[]> = {
  SUPER_ADMIN: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "members:write",
    "volunteers:read",
    "volunteers:write",
    "schedules:read",
    "schedules:write",
    "schedules:confirm",
    "schedules:substitution:request",
    "ministries:read",
    "ministries:write",
    "calendar:read",
    "calendar:write",
    "events:read",
    "events:write",
    "courses:read",
    "courses:write",
    "followup:read",
    "followup:write",
    "cells:read",
    "cells:write",
    "discipleships:read",
    "discipleships:write",
    "discipleship:my:read",
    "discipleship:my:write",
    "kids:read",
    "kids:write",
    "kids:checkin:self",
    "assets:read",
    "assets:write",
    "lostfound:read",
    "lostfound:write",
    "finance:read",
    "finance:write",
    "budget:read",
    "budget:write",
    "notifications:read",
    "notifications:write",
    "reports:view",
    "settings:manage",
    "pastoral:notes:read",
    "pastoral:notes:write",
    "prayer:read",
    "prayer:write",
    "profile:self:edit",
    "youtube:read",
    "youtube:write",
  ],
  PASTOR_PRESIDENTE: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "volunteers:read",
    "schedules:read",
    "schedules:confirm",
    "schedules:substitution:request",
    "ministries:read",
    "calendar:read",
    "events:read",
    "courses:read",
    "followup:read",
    "cells:read",
    "discipleships:read",
    "discipleship:my:read",
    "discipleship:my:write",
    "finance:read",
    "budget:read",
    "notifications:read",
    "reports:view",
    "pastoral:notes:read",
    "pastoral:notes:write",
    "prayer:read",
    "prayer:write",
    "profile:self:edit",
    "youtube:read",
    "youtube:write",
    "kids:checkin:self",
  ],
  PASTOR: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "schedules:read",
    "schedules:confirm",
    "schedules:substitution:request",
    "ministries:read",
    "calendar:read",
    "events:read",
    "courses:read",
    "followup:read",
    "cells:read",
    "discipleships:read",
    "discipleship:my:read",
    "discipleship:my:write",
    "reports:view",
    "pastoral:notes:read",
    "pastoral:notes:write",
    "youtube:read",
    "prayer:read",
    "prayer:write",
    "profile:self:edit",
    "kids:checkin:self",
  ],
  MINISTRY_LEADER: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "volunteers:read",
    "volunteers:write",
    "schedules:read",
    "schedules:write",
    "schedules:confirm",
    "schedules:substitution:request",
    "ministries:read",
    "ministries:write",
    "calendar:read",
    "events:read",
    "courses:read",
    "courses:write",
    "cells:read",
    "discipleships:read",
    "discipleship:my:read",
    "discipleship:my:write",
    "notifications:read",
    "prayer:read",
    "prayer:write",
    "profile:self:edit",
    "kids:checkin:self",
  ],
  CELL_LEADER: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "calendar:read",
    "events:read",
    "courses:read",
    "followup:read",
    "followup:write",
    "cells:read",
    "cells:write",
    "discipleships:read",
    "discipleship:my:read",
    "discipleship:my:write",
    "reports:view",
    "schedules:confirm",
    "schedules:substitution:request",
    "prayer:read",
    "prayer:write",
    "profile:self:edit",
    "kids:checkin:self",
  ],
  VOLUNTEER: [
    "dashboard:view",
    "schedules:read",
    "calendar:read",
    "events:read",
    "courses:read",
    "schedules:confirm",
    "schedules:substitution:request",
    "prayer:read",
    "prayer:write",
    "profile:self:edit",
    "discipleship:my:read",
    "kids:checkin:self",
  ],
  MEMBER: [
    "dashboard:view",
    "calendar:read",
    "events:read",
    "courses:read",
    "prayer:read",
    "prayer:write",
    "profile:self:edit",
    "discipleship:my:read",
    "kids:checkin:self",
  ],
  FINANCE: [
    "admin:access",
    "dashboard:view",
    "finance:read",
    "finance:write",
    "budget:read",
    "budget:write",
    "reports:view",
    "courses:read",
    "prayer:read",
    "prayer:write",
    "profile:self:edit",
    "discipleship:my:read",
    "kids:checkin:self",
  ],
  SECRETARY: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "members:write",
    "courses:read",
    "courses:write",
    "followup:read",
    "followup:write",
    "reports:view",
    "youtube:read",
    "youtube:write",
    "schedules:confirm",
    "schedules:substitution:request",
    "schedules:read",
    "prayer:read",
    "prayer:write",
    "profile:self:edit",
    "discipleship:my:read",
    "kids:checkin:self",
  ],
  RECEPTION: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "events:read",
    "courses:read",
    "followup:read",
    "followup:write",
    "youtube:read",
    "prayer:read",
    "prayer:write",
    "profile:self:edit",
    "discipleship:my:read",
    "kids:checkin:self",
  ],
  KIDS_MINISTRY: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "schedules:read",
    "schedules:write",
    "schedules:confirm",
    "schedules:substitution:request",
    "events:read",
    "courses:read",
    "kids:read",
    "kids:write",
    "prayer:read",
    "prayer:write",
    "profile:self:edit",
    "discipleship:my:read",
    "kids:checkin:self",
  ],
  PARKING: [
    "admin:access",
    "dashboard:view",
    "schedules:read",
    "schedules:write",
    "schedules:confirm",
    "schedules:substitution:request",
    "events:read",
    "courses:read",
    "prayer:read",
    "prayer:write",
    "profile:self:edit",
    "discipleship:my:read",
    "kids:checkin:self",
  ],
};

export function hasPermission(roles: RoleKey[], permission: PermissionKey) {
  return roles.some((r) => rolePermissions[r]?.includes(permission));
}

export function allPermissionKeysArray(): PermissionKey[] {
  const seen = new Set<PermissionKey>();
  for (const perms of Object.values(rolePermissions)) {
    for (const p of perms) seen.add(p);
  }
  return Array.from(seen);
}

export function allPermissionKeysSet(): Set<PermissionKey> {
  return new Set(allPermissionKeysArray());
}
