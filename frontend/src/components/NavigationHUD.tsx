import React, { useState, useEffect, useRef } from 'react';
import type { CueType, Point, Report, Route, RouteWarning } from '../types';
import { triggerHapticCue } from '../services/haptics';
import { haversineDistanceM } from '../services/geo';
import {
  ArrowUpRight,
  ArrowUpLeft,
  AlertTriangle,
  Flag,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Navigation,
  Compass,
  Radio,
  ChevronRight,
} from 'lucide-react';

interface NavigationHUDProps {
  routes: Route[];
  activeRoute: Route | null;
  onSelectRoute: (route: Route) => void;
  warnings: RouteWarning[];
  onSimulationPositionChange: (pos: Point | null) => void;
  onSelectReport: (report: Report) => void;
}

export const NavigationHUD: React.FC<NavigationHUDProps> = ({
  routes,
  activeRoute,
  onSelectRoute,
  warnings,
  onSimulationPositionChange,
  onSelectReport,
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgressRatio, setSimProgressRatio] = useState(0); // 0 to 1
  const [currentCue, setCurrentCue] = useState<{ cue: CueType; text: string } | null>(null);
  const [cueFlash, setCueFlash] = useState(false);
  const [useLiveGps, setUseLiveGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const triggeredStepIndices = useRef<Set<number>>(new Set());
  const triggeredWarningIds = useRef<Set<string>>(new Set());
  const timerRef = useRef<number | null>(null);

  // If no route selected, pick the first route
  useEffect(() => {
    if (!activeRoute && routes.length > 0) {
      onSelectRoute(routes[0]);
    }
  }, [routes, activeRoute, onSelectRoute]);

  // Reset simulation when route changes
  const handleRouteChange = (routeId: string) => {
    const found = routes.find((r) => r.id === routeId);
    if (found) {
      setIsSimulating(false);
      setSimProgressRatio(0);
      triggeredStepIndices.current.clear();
      triggeredWarningIds.current.clear();
      onSimulationPositionChange(null);
      setCurrentCue(null);
      onSelectRoute(found);
    }
  };

  // Live GPS tracking
  useEffect(() => {
    if (!useLiveGps || !activeRoute) return;

    if (!navigator.geolocation) {
      setGpsError('Geolocation API not supported.');
      setUseLiveGps(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const curPoint: Point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        onSimulationPositionChange(curPoint);
        checkCuesAtPosition(curPoint);
      },
      (err) => {
        setGpsError(err.message);
        setUseLiveGps(false);
      },
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [useLiveGps, activeRoute]);

  // Check cues whenever current position updates
  const checkCuesAtPosition = (pos: Point) => {
    if (!activeRoute) return;

    // Check steps
    activeRoute.steps.forEach((step) => {
      if (triggeredStepIndices.current.has(step.index)) return;
      const dist = haversineDistanceM(pos.lat, pos.lng, step.location.lat, step.location.lng);
      if (dist <= step.trigger_radius_m) {
        triggeredStepIndices.current.add(step.index);
        fireCue(step.cue, step.instruction);
      }
    });

    // Check route hazard warnings within 25 meters
    warnings.forEach((warn) => {
      if (triggeredWarningIds.current.has(warn.report.id)) return;
      const dist = haversineDistanceM(pos.lat, pos.lng, warn.report.lat, warn.report.lng);
      if (dist <= 28) {
        triggeredWarningIds.current.add(warn.report.id);
        fireCue('caution', `Caution: ${warn.report.note || 'Hazard reported near path'}`);
      }
    });
  };

  const fireCue = (cue: CueType, text: string) => {
    setCurrentCue({ cue, text });
    setCueFlash(true);
    triggerHapticCue(cue, { playSoundFallback: true });

    setTimeout(() => {
      setCueFlash(false);
    }, 1200);
  };

  // Walk Simulation Runner
  useEffect(() => {
    if (!isSimulating || !activeRoute) return;

    const coords = activeRoute.geometry.coordinates; // [lng, lat]
    if (coords.length < 2) return;

    timerRef.current = window.setInterval(() => {
      setSimProgressRatio((prev) => {
        const next = prev + 0.025; // advance along route
        if (next >= 1) {
          setIsSimulating(false);
          const lastCoord = coords[coords.length - 1];
          onSimulationPositionChange({ lat: lastCoord[1], lng: lastCoord[0] });
          const arriveStep = activeRoute.steps.find((s) => s.cue === 'arrived');
          fireCue('arrived', arriveStep ? arriveStep.instruction : 'You have arrived!');
          return 1;
        }

        // Interpolate position along polyline
        const totalSegments = coords.length - 1;
        const exactIndex = next * totalSegments;
        const segmentIdx = Math.min(Math.floor(exactIndex), totalSegments - 1);
        const segmentProgress = exactIndex - segmentIdx;

        const p1 = coords[segmentIdx];
        const p2 = coords[segmentIdx + 1];

        const interpolated: Point = {
          lat: p1[1] + (p2[1] - p1[1]) * segmentProgress,
          lng: p1[0] + (p2[0] - p1[0]) * segmentProgress,
        };

        onSimulationPositionChange(interpolated);
        checkCuesAtPosition(interpolated);

        return next;
      });
    }, 450);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSimulating, activeRoute]);

  const handleToggleSimulation = () => {
    if (useLiveGps) setUseLiveGps(false);
    if (!isSimulating && simProgressRatio >= 1) {
      // restart
      setSimProgressRatio(0);
      triggeredStepIndices.current.clear();
      triggeredWarningIds.current.clear();
    }
    setIsSimulating(!isSimulating);
  };

  const handleResetSimulation = () => {
    setIsSimulating(false);
    setSimProgressRatio(0);
    triggeredStepIndices.current.clear();
    triggeredWarningIds.current.clear();
    if (activeRoute) {
      const first = activeRoute.geometry.coordinates[0];
      onSimulationPositionChange({ lat: first[1], lng: first[0] });
    }
    setCurrentCue(null);
  };

  const handleStepForward = () => {
    if (!activeRoute) return;
    const coords = activeRoute.geometry.coordinates;
    const next = Math.min(1, simProgressRatio + 0.15);
    setSimProgressRatio(next);

    const totalSegments = coords.length - 1;
    const exactIndex = next * totalSegments;
    const segmentIdx = Math.min(Math.floor(exactIndex), totalSegments - 1);
    const segmentProgress = exactIndex - segmentIdx;

    const p1 = coords[segmentIdx];
    const p2 = coords[segmentIdx + 1];

    const interpolated: Point = {
      lat: p1[1] + (p2[1] - p1[1]) * segmentProgress,
      lng: p1[0] + (p2[0] - p1[0]) * segmentProgress,
    };

    onSimulationPositionChange(interpolated);
    checkCuesAtPosition(interpolated);
  };

  return (
    <div className="navigation-panel-container">
      {/* Route Selector Card */}
      <div className="nav-card route-picker-card">
        <div className="route-select-row">
          <label htmlFor="route-dropdown" className="route-picker-label">
            <Compass size={16} />
            <span>Select Campus Walking Route:</span>
          </label>
          <select
            id="route-dropdown"
            className="route-dropdown-select"
            value={activeRoute?.id || ''}
            onChange={(e) => handleRouteChange(e.target.value)}
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.distance_m}m · ~{r.est_minutes} min)
              </option>
            ))}
          </select>
        </div>

        {activeRoute && (
          <div className="route-meta-strip">
            <span className="route-stat-item">
              <strong>{activeRoute.distance_m}m</strong> walk
            </span>
            <span className="route-stat-divider">•</span>
            <span className="route-stat-item">
              <strong>~{activeRoute.est_minutes} min</strong> estimated
            </span>
            <span className="route-stat-divider">•</span>
            <span className="route-stat-item warnings-count">
              <strong>{warnings.length}</strong> hazards nearby
            </span>
          </div>
        )}
      </div>

      {/* Prominent High-Contrast Turn-by-Turn Cue Banner */}
      <div className={`nav-card cue-hud-banner ${cueFlash ? 'flashing-cue' : ''}`}>
        <div className="cue-hud-icon-box">
          {getCueIcon(currentCue ? currentCue.cue : 'left')}
        </div>
        <div className="cue-hud-text-box">
          <div className="cue-hud-status-badge">
            {currentCue ? currentCue.cue.toUpperCase() + ' CUE' : 'READY TO NAVIGATE'}
          </div>
          <div className="cue-hud-instruction">
            {currentCue ? currentCue.text : 'Start walking or press Play to simulate path'}
          </div>
        </div>
      </div>

      {/* Walk Simulator / GPS Controls */}
      <div className="nav-card simulation-controls-card">
        <div className="sim-header-row">
          <div className="sim-title">
            <Radio size={14} className={isSimulating ? 'icon-pulse text-indigo' : ''} />
            <span>Interactive Walking Simulator</span>
          </div>
          <span className="sim-percent">{Math.round(simProgressRatio * 100)}% Complete</span>
        </div>

        {/* Progress Bar along route */}
        <div className="route-progress-track">
          <div
            className="route-progress-fill"
            style={{ width: `${Math.round(simProgressRatio * 100)}%` }}
          />
        </div>

        <div className="sim-buttons-group">
          <button
            type="button"
            className={`sim-control-btn play-btn ${isSimulating ? 'simulating-active' : ''}`}
            onClick={handleToggleSimulation}
            id="sim-play-pause-btn"
          >
            {isSimulating ? <Pause size={17} /> : <Play size={17} />}
            <span>{isSimulating ? 'Pause Walk' : 'Play Walk Simulation'}</span>
          </button>

          <button
            type="button"
            className="sim-control-btn secondary"
            onClick={handleStepForward}
            title="Step forward 15%"
            id="sim-step-btn"
          >
            <SkipForward size={16} />
            <span>Next Step</span>
          </button>

          <button
            type="button"
            className="sim-control-btn secondary"
            onClick={handleResetSimulation}
            title="Reset walk to start"
            id="sim-reset-btn"
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>
        </div>

        <div className="live-gps-toggle-row">
          <button
            type="button"
            className={`gps-toggle-btn ${useLiveGps ? 'active' : ''}`}
            onClick={() => {
              if (isSimulating) setIsSimulating(false);
              setUseLiveGps(!useLiveGps);
            }}
            id="live-gps-mode-btn"
          >
            <Navigation size={14} />
            <span>{useLiveGps ? 'Tracking via Live GPS' : 'Switch to Real Outdoors GPS'}</span>
          </button>
          {gpsError && <span className="gps-err-text">{gpsError}</span>}
        </div>
      </div>

      {/* Warnings Along This Route */}
      <div className="nav-card warnings-list-card">
        <div className="card-section-title">
          <AlertTriangle size={16} color="#f59e0b" />
          <span>Hazards Along This Route ({warnings.length})</span>
        </div>

        {warnings.length === 0 ? (
          <p className="no-warnings-text">No reported barriers within 35m of this walking route.</p>
        ) : (
          <div className="warnings-scroll-list">
            {warnings.map((warn) => (
              <div
                key={warn.report.id}
                className="warning-item-row"
                onClick={() => onSelectReport(warn.report)}
              >
                <div className="warning-item-icon">
                  <AlertTriangle size={16} color="#ef4444" />
                </div>
                <div className="warning-item-content">
                  <div className="warning-item-header">
                    <span className="warning-cat-name">
                      {warn.report.category.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="warning-distance-badge">
                      {warn.distance_along_m}m ahead
                    </span>
                  </div>
                  <p className="warning-note-snippet">
                    {warn.report.note || 'Hazard reported on sidewalk'}
                  </p>
                </div>
                <ChevronRight size={16} className="chevron" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function getCueIcon(cue: CueType) {
  switch (cue) {
    case 'left':
      return <ArrowUpLeft size={32} color="#ffffff" />;
    case 'right':
      return <ArrowUpRight size={32} color="#ffffff" />;
    case 'caution':
      return <AlertTriangle size={32} color="#ffffff" />;
    case 'arrived':
      return <Flag size={32} color="#ffffff" />;
  }
}
