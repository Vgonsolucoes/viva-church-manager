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
  | "kids:read"
  | "kids:write"
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
  | "pastoral:notes:write";

const rolePermissions: Record<RoleKey, PermissionKey[]> = {
  SUPER_ADMIN: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "members:write",
    "volunteers:read",
    "volunteers:write",
    "schedules:read",
    "schedules:write",
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
    "kids:read",
    "kids:write",
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
  ],
  PASTOR_PRESIDENTE: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "volunteers:read",
    "schedules:read",
    "ministries:read",
    "calendar:read",
    "events:read",
    "courses:read",
    "followup:read",
    "cells:read",
    "cells:read",
    "discipleships:read",
    "finance:read",
    "budget:read",
    "notifications:read",
    "reports:view",
    "pastoral:notes:read",
    "pastoral:notes:write",
  ],
  PASTOR: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "schedules:read",
    "ministries:read",
    "calendar:read",
    "events:read",
    "courses:read",
    "followup:read",
    "cells:read",
    "discipleships:read",
    "reports:view",
    "pastoral:notes:read",
    "pastoral:notes:write",
  ],
  MINISTRY_LEADER: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "volunteers:read",
    "volunteers:write",
    "schedules:read",
    "schedules:write",
    "ministries:read",
    "ministries:write",
    "calendar:read",
    "events:read",
    "courses:read",
    "courses:write",
    "cells:read",
    "discipleships:read",
    "notifications:read",
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
    "reports:view",
  ],
  VOLUNTEER: ["dashboard:view", "schedules:read", "calendar:read", "events:read", "courses:read"],
  MEMBER: ["dashboard:view", "calendar:read", "events:read", "courses:read"],
  FINANCE: [
    "admin:access",
    "dashboard:view",
    "finance:read",
    "finance:write",
    "budget:read",
    "budget:write",
    "reports:view",
    "courses:read",
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
  ],
  RECEPTION: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "events:read",
    "courses:read",
    "followup:read",
    "followup:write",
  ],
  KIDS_MINISTRY: [
    "admin:access",
    "dashboard:view",
    "members:read",
    "schedules:read",
    "schedules:write",
    "events:read",
    "courses:read",
    "kids:read",
    "kids:write",
  ],
  PARKING: [
    "admin:access",
    "dashboard:view",
    "schedules:read",
    "schedules:write",
    "events:read",
    "courses:read",
  ],
};

export function hasPermission(roles: RoleKey[], permission: PermissionKey) {
  return roles.some((r) => rolePermissions[r]?.includes(permission));
}
