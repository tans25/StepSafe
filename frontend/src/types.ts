export type CategoryId =
  | 'blocked_sidewalk'
  | 'pothole'
  | 'uneven_surface'
  | 'standing_water'
  | 'construction_closure'
  | 'missing_curb_ramp'
  | 'other';

export type ReportStatus = 'unverified' | 'confirmed' | 'resolved' | 'hidden';

export interface Report {
  id: string;
  category: CategoryId;
  lat: number;
  lng: number;
  note: string | null;
  created_at: string;
  status: ReportStatus;
  source: 'seed' | 'user';
  flag_count: number;
  confirm_count: number;
  is_stale: boolean;
  age_hours: number;
}

export type CueType = 'left' | 'right' | 'caution' | 'arrived';

export interface Point {
  lat: number;
  lng: number;
}

export interface RouteSummary {
  id: string;
  name: string;
  distance_m: number;
  est_minutes: number;
  kind: 'prepared' | 'live';
  disclaimer: string;
}

export interface RouteStep {
  index: number;
  cue: CueType;
  location: Point;
  trigger_radius_m: number;
  distance_along_m: number;
  instruction: string;
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat]
}

export interface Route extends RouteSummary {
  geometry: RouteGeometry;
  steps: RouteStep[];
}

export interface RouteWarning {
  report: Report;
  distance_along_m: number;
  offset_m: number;
  cue: CueType;
}

export interface HapticPattern {
  vibrate_ms: number[];
  text: string;
}

export interface AppMeta {
  categories: { id: CategoryId; label: string; icon: string; description: string }[];
  demo_area: {
    name: string;
    center: [number, number];
    bounds: {
      min_lat: number;
      max_lat: number;
      min_lng: number;
      max_lng: number;
    };
  };
  haptic_patterns: Record<CueType, HapticPattern>;
  limits: {
    note_max_length: number;
    stale_after_days: number;
  };
}

export interface NewReportPayload {
  category: CategoryId;
  lat: number;
  lng: number;
  note?: string;
}
