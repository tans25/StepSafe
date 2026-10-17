import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  dbPath: process.env.DB_PATH ?? "data/stepsafe.db",
  adminToken: process.env.ADMIN_TOKEN ?? "",
};

export const CATEGORIES = [
  { id: "blocked_sidewalk", label: "Blocked sidewalk" },
  { id: "pothole", label: "Pothole" },
  { id: "uneven_surface", label: "Uneven surface" },
  { id: "standing_water", label: "Standing water" },
  { id: "construction_closure", label: "Construction / closure" },
  { id: "missing_curb_ramp", label: "Missing curb ramp" },
  { id: "other", label: "Other" },
] as const;

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [string, ...string[]];

export const DEMO_AREA = {
  name: "University of Maryland, College Park",
  center: { lat: 38.9869, lng: -76.9426 },
  bounds: { min_lat: 38.975, min_lng: -76.96, max_lat: 39.0, max_lng: -76.925 },
};

export const HAPTIC_PATTERNS = {
  left: { vibrate_ms: [200, 100, 200], text: "Turn left" },
  right: { vibrate_ms: [500], text: "Turn right" },
  caution: { vibrate_ms: [100, 50, 100, 50, 100, 50, 100], text: "Caution ahead" },
  arrived: { vibrate_ms: [100, 100, 500], text: "You have arrived" },
};

export const LIMITS = { note_max_length: 280, stale_after_days: 30 };

export const DISCLAIMER =
  "Community-submitted and possibly outdated. Not a guarantee of accessibility or safety.";
