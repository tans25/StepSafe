import { DEFAULT_META, DEMO_PREPARED_ROUTES, SEEDED_FALLBACK_REPORTS } from '../config';
import type { AppMeta, NewReportPayload, Report, Route, RouteWarning } from '../types';
import { haversineDistanceM } from './geo';

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

export async function fetchAppMeta(): Promise<AppMeta> {
  try {
    const res = await fetch(`${API_BASE}/meta`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      return await res.json();
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

export async function createReport(payload: NewReportPayload): Promise<Report> {
  try {
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.report) {
        const local = getLocalReports();
        saveLocalReports([data.report, ...local]);
        return data.report;
      }
    }
  } catch {
    // Fallback optimistic creation
  }

  // Create optimistic local report
  const newReport: Report = {
    id: `rpt_user_${Date.now()}`,
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
    const res = await fetch(`${API_BASE}/routes`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.routes) && data.routes.length > 0) {
        return data.routes;
      }
    }
  } catch {
    // Fall back to prepared demo routes
  }
  return DEMO_PREPARED_ROUTES;
}

export function computeRouteWarnings(
  route: Route,
  reports: Report[],
  bufferM = 35
): RouteWarning[] {
  const warnings: RouteWarning[] = [];
  const coords = route.geometry.coordinates; // [lng, lat]

  reports
    .filter((r) => r.status !== 'hidden')
    .forEach((rep) => {
      // Find min distance from report to any route point
      let minDistance = Infinity;
      let closestIdx = 0;

      coords.forEach((c, idx) => {
        const dist = haversineDistanceM(rep.lat, rep.lng, c[1], c[0]);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });

      if (minDistance <= bufferM) {
        // Approximate distance along route to closest vertex
        let distAlong = 0;
        for (let i = 0; i < closestIdx; i++) {
          distAlong += haversineDistanceM(
            coords[i][1],
            coords[i][0],
            coords[i + 1][1],
            coords[i + 1][0]
          );
        }

        warnings.push({
          report: rep,
          distance_along_m: Math.round(distAlong),
          offset_m: Math.round(minDistance),
          cue: 'caution',
        });
      }
    });

  return warnings.sort((a, b) => a.distance_along_m - b.distance_along_m);
}
