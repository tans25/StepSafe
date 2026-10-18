import { DEFAULT_META, DEMO_PREPARED_ROUTES, SEEDED_FALLBACK_REPORTS } from '../config';
import type { AppMeta, CueType, HapticPattern, NewReportPayload, Report, Route, RouteWarning } from '../types';
import { cumulativeDistancesM, projectOntoPath } from './geo';

const API_BASE = '/api';
const LOCAL_STORAGE_KEY = 'stepsafe_reports_cache_v1';

// In-memory or localStorage cache for offline/resilient demo mode
function getLocalReports(): Report[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('localStorage read failed', e);
  }
  return [...SEEDED_FALLBACK_REPORTS];
}

function saveLocalReports(reports: Report[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reports));
  } catch (e) {
    console.warn('localStorage write failed', e);
  }
}

// Reports created while the backend is unreachable are kept only in this browser.
const LOCAL_REPORT_ID_PREFIX = 'rpt_user_';

export function isLocalOnlyReport(report: Report): boolean {
  return report.id.startsWith(LOCAL_REPORT_ID_PREFIX);
}

let isBackendLive: boolean | null = null;

export async function checkBackendHealth(): Promise<{ ok: boolean; mode: string }> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      isBackendLive = true;
      return { ok: true, mode: data.mode || 'live' };
    }
  } catch {
    // Backend not responding
  }
  isBackendLive = false;
  return { ok: false, mode: 'demo_fallback' };
}

export function getIsBackendLive(): boolean {
  return isBackendLive === true;
}

const CUE_TYPES: CueType[] = ['left', 'right', 'caution', 'arrived'];

function isHapticPattern(p: unknown): p is HapticPattern {
  const x = p as HapticPattern | undefined;
  return (
    Array.isArray(x?.vibrate_ms) &&
    x.vibrate_ms.length > 0 &&
    x.vibrate_ms.every((n) => Number.isFinite(n) && n >= 0) &&
    typeof x.text === 'string'
  );
}

/**
 * Loads /api/meta and converts it to the frontend's AppMeta shape. The backend is the source of
 * truth for haptic patterns, demo area and limits; anything missing or malformed falls back to
 * DEFAULT_META. Categories stay local because they carry icons and colors the API does not send.
 */
export async function fetchAppMeta(): Promise<AppMeta> {
  try {
    const res = await fetch(`${API_BASE}/meta`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();

      const haptic_patterns = { ...DEFAULT_META.haptic_patterns };
      for (const cue of CUE_TYPES) {
        if (isHapticPattern(data.haptic_patterns?.[cue])) haptic_patterns[cue] = data.haptic_patterns[cue];
      }

      // Backend sends center as {lat, lng}; the frontend uses [lat, lng].
      const c = data.demo_area?.center;
      const b = data.demo_area?.bounds;
      const center: [number, number] =
        Number.isFinite(c?.lat) && Number.isFinite(c?.lng) ? [c.lat, c.lng] : DEFAULT_META.demo_area.center;
      const boundsOk = ['min_lat', 'max_lat', 'min_lng', 'max_lng'].every((k) => Number.isFinite(b?.[k]));

      const limits = {
        note_max_length: Number.isFinite(data.limits?.note_max_length)
          ? data.limits.note_max_length
          : DEFAULT_META.limits.note_max_length,
        stale_after_days: Number.isFinite(data.limits?.stale_after_days)
          ? data.limits.stale_after_days
          : DEFAULT_META.limits.stale_after_days,
      };

      return {
        ...DEFAULT_META,
        demo_area: {
          name: typeof data.demo_area?.name === 'string' ? data.demo_area.name : DEFAULT_META.demo_area.name,
          center,
          bounds: boundsOk ? b : DEFAULT_META.demo_area.bounds,
        },
        haptic_patterns,
        limits,
      };
    }
  } catch {
    // Fall back to default config
  }
  return DEFAULT_META;
}

export async function fetchReports(): Promise<Report[]> {
  try {
    const res = await fetch(`${API_BASE}/reports`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.reports)) {
        isBackendLive = true;
        saveLocalReports(data.reports);
        return data.reports;
      }
    }
  } catch {
    // Network or server error
  }
  // Resilient fallback
  return getLocalReports();
}

/** A request the server understood and refused (4xx). Its message is safe to show the user. */
export class ApiRequestError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

async function toApiRequestError(res: Response): Promise<ApiRequestError> {
  let code = 'request_failed';
  let message = `The server rejected the request (${res.status}).`;
  let details: { field: string; issue: string }[] = [];
  try {
    const body = await res.json();
    code = body?.error?.code ?? code;
    details = Array.isArray(body?.error?.details) ? body.error.details : [];
  } catch {
    // Non-JSON error body; keep the generic message.
  }
  if (code === 'out_of_bounds') {
    message = 'That location is outside the UMD demo area. Move the pin onto campus and try again.';
  } else if (code === 'rate_limited') {
    message = 'Too many reports in a short time. Please wait a minute and try again.';
  } else if (code === 'validation_failed') {
    message = details.length
      ? `Please fix the report: ${details.map((d) => `${d.field} ${d.issue}`).join('; ')}.`
      : 'The report was not valid. Check the category, location and note.';
  }
  return new ApiRequestError(res.status, code, message);
}

/**
 * Submits a report. If the server refuses it (4xx) this throws an ApiRequestError so the form can
 * show why. Only when the server cannot be reached (network failure, timeout, 5xx) does it save the
 * report locally so the demo keeps working.
 */
export async function createReport(payload: NewReportPayload): Promise<Report> {
  let res: Response | null = null;
  try {
    res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Backend unreachable: fall through to the local fallback below.
  }

  if (res) {
    if (res.ok) {
      const data = await res.json();
      if (data.report) {
        const local = getLocalReports();
        saveLocalReports([data.report, ...local]);
        return data.report;
      }
    } else if (res.status < 500) {
      throw await toApiRequestError(res);
    }
  }

  // Create optimistic local report
  const newReport: Report = {
    id: `${LOCAL_REPORT_ID_PREFIX}${Date.now()}`,
    category: payload.category,
    lat: payload.lat,
    lng: payload.lng,
    note: payload.note || null,
    created_at: new Date().toISOString(),
    status: 'unverified',
    source: 'user',
    flag_count: 0,
    confirm_count: 1,
    is_stale: false,
    age_hours: 0,
  };

  const updated = [newReport, ...getLocalReports()];
  saveLocalReports(updated);
  return newReport;
}

export async function confirmReport(id: string): Promise<Report | null> {
  try {
    const res = await fetch(`${API_BASE}/reports/${id}/confirm`, {
      method: 'POST',
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.report;
    }
  } catch {
    // Fallback
  }

  const reports = getLocalReports();
  const target = reports.find((r) => r.id === id);
  if (target) {
    target.confirm_count += 1;
    if (target.confirm_count >= 3 && target.status === 'unverified') {
      target.status = 'confirmed';
    }
    saveLocalReports(reports);
    return { ...target };
  }
  return null;
}

export async function flagReport(id: string): Promise<Report | null> {
  try {
    const res = await fetch(`${API_BASE}/reports/${id}/flag`, {
      method: 'POST',
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.report;
    }
  } catch {
    // Fallback
  }

  const reports = getLocalReports();
  const target = reports.find((r) => r.id === id);
  if (target) {
    target.flag_count += 1;
    if (target.flag_count >= 3) {
      target.status = 'hidden';
    }
    saveLocalReports(reports);
    return { ...target };
  }
  return null;
}

export async function fetchRoutes(): Promise<Route[]> {
  try {
    // GET /api/routes returns summaries only; geometry and steps come from GET /api/routes/:id.
    const res = await fetch(`${API_BASE}/routes`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.routes) && data.routes.length > 0) {
        const full = await Promise.all(
          data.routes.map(async (summary: { id: string }): Promise<Route | null> => {
            try {
              const r = await fetch(`${API_BASE}/routes/${encodeURIComponent(summary.id)}`, {
                signal: AbortSignal.timeout(3000),
              });
              if (!r.ok) return null;
              const route = (await r.json()) as Route;
              return route.geometry?.coordinates?.length >= 2 && Array.isArray(route.steps) ? route : null;
            } catch {
              return null;
            }
          })
        );
        const usable = full.filter((r): r is Route => r !== null);
        if (usable.length > 0) return usable;
      }
    }
  } catch {
    // Fall back to prepared demo routes
  }
  return DEMO_PREPARED_ROUTES;
}

export async function fetchRouteWarnings(
  routeId: string,
  bufferM = 25
): Promise<RouteWarning[] | null> {
  try {
    const res = await fetch(
      `${API_BASE}/routes/${encodeURIComponent(routeId)}/warnings?buffer_m=${bufferM}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.warnings)) {
        return data.warnings;
      }
    }
  } catch {
    // Fall back to client calculation
  }
  return null;
}

export function computeRouteWarnings(
  route: Route,
  reports: Report[],
  bufferM = 25
): RouteWarning[] {
  // Offline fallback for /api/routes/:id/warnings; same projection and buffer as the backend.
  const coords = route.geometry.coordinates; // [lng, lat]
  if (coords.length < 2) return [];
  const cumulative = cumulativeDistancesM(coords);

  return reports
    .filter((r) => r.status !== 'hidden')
    .map((rep) => ({ rep, ...projectOntoPath(coords, cumulative, rep.lat, rep.lng) }))
    .filter((w) => w.offset_m <= bufferM)
    .map((w) => ({
      report: w.rep,
      distance_along_m: Math.round(w.distance_along_m),
      offset_m: Math.round(w.offset_m),
      cue: 'caution' as const,
    }))
    .sort((a, b) => a.distance_along_m - b.distance_along_m);
}