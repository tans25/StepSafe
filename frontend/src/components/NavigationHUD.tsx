import React, { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react';
import type { CueType, Point, Report, Route, RouteWarning } from '../types';
import { CATEGORY_INFO } from '../config';
import { triggerHapticCue } from '../services/haptics';
import { cumulativeDistancesM, pointAtDistance, projectOntoPathNear } from '../services/geo';
import {
  calculateLiveWalkingRoute,
  isInDemoArea,
  searchLandmarks,
  searchPlaces,
  POPULAR_CAMPUS_LANDMARKS,
  type CampusLandmark,
  type PlaceResult,
} from '../services/routing';
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
  ChevronDown,
  ChevronUp,
  Search,
  MapPin,
  Sparkles,
  Loader2,
  X,
  Target,
} from 'lucide-react';

interface NavigationHUDProps {
  routes: Route[];
  activeRoute: Route | null;
  onSelectRoute: (route: Route) => void;
  warnings: RouteWarning[];
  onSimulationPositionChange: (pos: Point | null) => void;
  onSelectReport: (report: Report) => void;
  userLocation: Point | null;
  onPickDestinationOnMap: () => void;
  isPickingDestination: boolean;
  destinationPoint: Point | null;
  onClearDestination: () => void;
}

// Cues fire by how far along the route the walker is, in route order, not by straight-line
// distance to a point (which fired later turns early wherever the path doubles back).
const TURN_LEAD_M = 15; // announce a turn this far before reaching it
const HAZARD_LEAD_M = 25; // warn about a hazard this far before reaching it
const ARRIVAL_LEAD_M = 8;
// A cue more than this far behind the walker is skipped instead of firing late.
const PASSED_M = 10;
// Live GPS: further than this from the route counts as off-route (no cues fire).
const OFF_ROUTE_M = 35;

// Simulated walker: 5 m every 300 ms (~1 km a minute). Cue windows are 25 m+ wide, so a
// 5 m step can never jump over one.
const SIM_STEP_M = 5;
const SIM_TICK_MS = 300;
const NEXT_STEP_FRACTION = 0.15;
// Cues that trigger together play one after another, this far apart. Each vibration lasts
// 0.5-0.7 s, so 0.9 s keeps them distinct without lagging behind the walker.
const CUE_GAP_MS = 900;

// Start point when the user's location is unknown or outside the demo area: McKeldin Library.
const DEFAULT_START: Point = { lat: 38.98569, lng: -76.94522 };

interface QueuedCue {
  cue: CueType;
  text: string;
  kind: 'turn' | 'hazard' | 'arrival';
  alongM: number;
}

interface CuePoint extends QueuedCue {
  id: string;
  leadM: number;
}

/** Every cue on the route (turns, hazards, arrival) with its distance along the route. */
function buildCuePoints(route: Route, warnings: RouteWarning[]): CuePoint[] {
  const steps: CuePoint[] = route.steps.map((s) => {
    const arrival = s.cue === 'arrived';
    return {
      id: `step-${s.index}`,
      kind: arrival ? 'arrival' : 'turn',
      cue: s.cue,
      text: s.instruction,
      alongM: s.distance_along_m,
      leadM: arrival ? ARRIVAL_LEAD_M : TURN_LEAD_M,
    };
  });
  const hazards: CuePoint[] = warnings.map((w) => ({
    id: `hazard-${w.report.id}`,
    kind: 'hazard',
    cue: 'caution',
    text: hazardCueText(w.report),
    alongM: w.distance_along_m,
    leadM: HAZARD_LEAD_M,
  }));
  return [...steps, ...hazards];
}

const NARROW_QUERY = '(max-width: 900px)';
function subscribeNarrow(onChange: () => void) {
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
const getIsNarrow = () => window.matchMedia(NARROW_QUERY).matches;

export const NavigationHUD: React.FC<NavigationHUDProps> = ({
  routes,
  activeRoute,
  onSelectRoute,
  warnings,
  onSimulationPositionChange,
  onSelectReport,
  userLocation,
  onPickDestinationOnMap,
  isPickingDestination,
  destinationPoint,
  onClearDestination,
}) => {
  // Navigation Source Mode: 'live' (search / tap a destination) vs 'prepared' (pre-seeded routes)
  const [navMode, setNavMode] = useState<'live' | 'prepared'>('live');

  // Search & Destination state
  const [searchQuery, setSearchQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [hasSearchedPlaces, setHasSearchedPlaces] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Simulation & Cue states
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgressRatio, setSimProgressRatio] = useState(0); // 0 to 1
  const [currentCue, setCurrentCue] = useState<QueuedCue | null>(null);
  const [cueFlash, setCueFlash] = useState(false);
  const [useLiveGps, setUseLiveGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const triggeredCueIds = useRef<Set<string>>(new Set());
  const walkerAlongRef = useRef(0); // walker's distance along the route (m), simulated or GPS
  const cueQueueRef = useRef<QueuedCue[]>([]);
  const cueTimerRef = useRef<number | null>(null);
  const [isOffRoute, setIsOffRoute] = useState(false);

  // Phones: once a route is chosen the panel shrinks to a compact bar so the map gets the screen.
  const isNarrow = useSyncExternalStore(subscribeNarrow, getIsNarrow);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const isCompact = isNarrow && !!activeRoute && !isPanelExpanded;

  const startIsUserLocation = !!userLocation && isInDemoArea(userLocation);
  const effectiveStart: Point = startIsUserLocation && userLocation ? userLocation : DEFAULT_START;

  // Route geometry with cumulative distances, for distance-based simulation and GPS progress.
  const routeGeom = useMemo(() => {
    if (!activeRoute || activeRoute.geometry.coordinates.length < 2) return null;
    const coords = activeRoute.geometry.coordinates;
    const cumulative = cumulativeDistancesM(coords);
    return { coords, cumulative, total: cumulative[cumulative.length - 1] };
  }, [activeRoute]);

  // Timers and GPS callbacks read these refs, so they always see the latest route and hazards
  // (e.g. a hazard reported mid-walk is warned about on the same walk).
  const activeRouteRef = useRef(activeRoute);
  const routeGeomRef = useRef(routeGeom);
  const warningsRef = useRef(warnings);
  useEffect(() => {
    activeRouteRef.current = activeRoute;
    routeGeomRef.current = routeGeom;
    warningsRef.current = warnings;
  }, [activeRoute, routeGeom, warnings]);

  // ---- Cue queue -------------------------------------------------------------------------------

  const playNextCue = useCallback(function playNext() {
    let next = cueQueueRef.current.shift();
    // A turn the walker has already passed while waiting in the queue is dropped, not buzzed late.
    while (next && next.kind === 'turn' && walkerAlongRef.current > next.alongM + PASSED_M) {
      next = cueQueueRef.current.shift();
    }
    if (!next) {
      cueTimerRef.current = null;
      return;
    }
    setCurrentCue(next);
    setCueFlash(true);
    triggerHapticCue(next.cue, { playSoundFallback: true });
    window.setTimeout(() => setCueFlash(false), 800);
    cueTimerRef.current = window.setTimeout(playNext, CUE_GAP_MS);
  }, []);

  const enqueueCue = useCallback(
    (item: QueuedCue) => {
      cueQueueRef.current.push(item);
      if (cueTimerRef.current === null) playNextCue();
    },
    [playNextCue]
  );

  const clearCues = useCallback(() => {
    cueQueueRef.current = [];
    if (cueTimerRef.current !== null) clearTimeout(cueTimerRef.current);
    cueTimerRef.current = null;
    setCurrentCue(null);
  }, []);

  useEffect(
    () => () => {
      if (cueTimerRef.current !== null) clearTimeout(cueTimerRef.current);
    },
    []
  );

  // ---- Cue detection ---------------------------------------------------------------------------

  /** Fires every cue whose window the walker (at `alongM` metres along the route) has reached. */
  const checkCuesAt = useCallback(
    (alongM: number) => {
      const route = activeRouteRef.current;
      if (!route) return;
      walkerAlongRef.current = alongM;

      buildCuePoints(route, warningsRef.current)
        .filter((p) => !triggeredCueIds.current.has(p.id) && alongM >= p.alongM - p.leadM)
        .sort((a, b) => a.alongM - b.alongM)
        .forEach((p) => {
          triggeredCueIds.current.add(p.id);
          // Already well past it (e.g. GPS picked up mid-route): skip rather than announce late.
          if (p.kind !== 'arrival' && alongM > p.alongM + PASSED_M) return;
          enqueueCue(p);
        });
    },
    [enqueueCue]
  );

  // ---- Walk simulation -------------------------------------------------------------------------

  const resetWalk = useCallback(() => {
    setIsSimulating(false);
    setSimProgressRatio(0);
    setIsOffRoute(false);
    walkerAlongRef.current = 0;
    triggeredCueIds.current.clear();
    clearCues();
  }, [clearCues]);

  // Moves the simulated walker to `targetM` along the route, checking cues every SIM_STEP_M on the
  // way so a long jump (e.g. "Next Step") can't skip a turn or hazard.
  const advanceSimTo = useCallback(
    (targetM: number) => {
      const geom = routeGeomRef.current;
      if (!geom) return;

      const target = Math.min(targetM, geom.total);
      for (let d = walkerAlongRef.current + SIM_STEP_M; d < target; d += SIM_STEP_M) checkCuesAt(d);
      checkCuesAt(target);

      onSimulationPositionChange(pointAtDistance(geom.coords, geom.cumulative, target));
      setSimProgressRatio(geom.total > 0 ? target / geom.total : 1);
      if (target >= geom.total) setIsSimulating(false);
    },
    [checkCuesAt, onSimulationPositionChange]
  );

  useEffect(() => {
    if (!isSimulating) return;
    const id = window.setInterval(() => advanceSimTo(walkerAlongRef.current + SIM_STEP_M), SIM_TICK_MS);
    return () => clearInterval(id);
  }, [isSimulating, advanceSimTo]);

  // ---- Live GPS tracking -----------------------------------------------------------------------

  useEffect(() => {
    if (!useLiveGps || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const curPoint: Point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onSimulationPositionChange(curPoint);
        const geom = routeGeomRef.current;
        if (!geom || geom.total <= 0) return;
        const { offset_m, distance_along_m } = projectOntoPathNear(
          geom.coords,
          geom.cumulative,
          curPoint.lat,
          curPoint.lng,
          walkerAlongRef.current
        );
        const offRoute = offset_m > OFF_ROUTE_M;
        setIsOffRoute(offRoute);
        if (offRoute) return;
        checkCuesAt(distance_along_m);
        setSimProgressRatio(distance_along_m / geom.total);
      },
      (err) => {
        setGpsError(err.message);
        setUseLiveGps(false);
      },
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [useLiveGps, checkCuesAt, onSimulationPositionChange]);

  // ---- Destinations ----------------------------------------------------------------------------

  // If no route selected in prepared mode, pick the first route
  useEffect(() => {
    if (!activeRoute && routes.length > 0 && navMode === 'prepared') {
      onSelectRoute(routes[0]);
    }
  }, [routes, activeRoute, navMode, onSelectRoute]);

  const handleCalculateRouteToPoint = async (dest: Point, name: string) => {
    setSearchQuery('');
    setPlaceResults([]);
    setHasSearchedPlaces(false);
    setRouteError(null);
    resetWalk();

    if (!isInDemoArea(dest)) {
      setRouteError('That destination is outside the UMD demo area. Pick a spot on campus.');
      return;
    }

    setIsCalculatingRoute(true);
    try {
      const liveRoute = await calculateLiveWalkingRoute(effectiveStart, dest, name);
      onSelectRoute(liveRoute);
      onSimulationPositionChange(null);
      setIsPanelExpanded(false);
    } catch (err) {
      console.error('Failed to calculate live route:', err);
      setRouteError('Could not calculate a route. Please try again.');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // A destination tapped on the map arrives as a prop; route to it under a generic name
  // (not the previous search's name). Only a new tap counts: this panel unmounts on tab
  // switches, and remounting must not recalculate the old destination.
  const calculateRef = useRef(handleCalculateRouteToPoint);
  const handledDestinationRef = useRef(destinationPoint);
  useEffect(() => {
    calculateRef.current = handleCalculateRouteToPoint;
  });
  useEffect(() => {
    if (!destinationPoint || destinationPoint === handledDestinationRef.current) return;
    handledDestinationRef.current = destinationPoint;
    calculateRef.current(destinationPoint, 'Selected map location');
  }, [destinationPoint]);

  const handleSelectPlace = (place: { lat: number; lng: number; name: string }) => {
    onClearDestination();
    handleCalculateRouteToPoint({ lat: place.lat, lng: place.lng }, place.name);
  };

  const handleSelectLandmark = (landmark: CampusLandmark) => handleSelectPlace(landmark);

  // Online place search runs only on submit (Enter / Search key): Nominatim forbids search-as-you-type.
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 3) return;
    setIsSearching(true);
    try {
      setPlaceResults(await searchPlaces(searchQuery));
      setHasSearchedPlaces(true);
    } finally {
      setIsSearching(false);
    }
  };

  const landmarkMatches = searchLandmarks(searchQuery);
  const searchResults = [
    ...landmarkMatches,
    ...placeResults.filter((p) => !landmarkMatches.some((l) => l.name === p.name)),
  ].slice(0, 8);

  // Reset simulation when a prepared route is chosen
  const handleRouteChange = (routeId: string) => {
    const found = routes.find((r) => r.id === routeId);
    if (found) {
      resetWalk();
      onSimulationPositionChange(null);
      onSelectRoute(found);
      setIsPanelExpanded(false);
    }
  };

  // ---- Controls --------------------------------------------------------------------------------

  const handleToggleSimulation = () => {
    if (useLiveGps) setUseLiveGps(false);
    if (!isSimulating && walkerAlongRef.current >= (routeGeom?.total ?? 0)) {
      // Finished: start again from the beginning
      resetWalk();
    }
    setIsSimulating(!isSimulating);
  };

  const handleResetSimulation = () => {
    resetWalk();
    if (activeRoute) {
      const first = activeRoute.geometry.coordinates[0];
      onSimulationPositionChange({ lat: first[1], lng: first[0] });
    }
  };

  const handleStepForward = () => {
    if (!routeGeom) return;
    advanceSimTo(walkerAlongRef.current + routeGeom.total * NEXT_STEP_FRACTION);
  };

  const handleToggleGps = () => {
    if (isSimulating) setIsSimulating(false);
    if (!useLiveGps && !navigator.geolocation) {
      setGpsError('Location is not supported in this browser.');
      return;
    }
    setGpsError(null);
    setUseLiveGps(!useLiveGps);
  };

  const playLabel = isSimulating ? 'Pause Walk' : 'Play Walk Simulation';
  const cueText = isOffRoute
    ? 'You are off the route. Head back toward the line on the map.'
    : currentCue
      ? currentCue.text
      : 'Press Play to simulate, or use GPS outdoors';

  // Compact bar (phones, while a route is active): current cue, progress and walk controls only.
  if (isCompact && activeRoute) {
    return (
      <div className="navigation-panel-container nav-compact">
        <div className={`compact-cue-row ${cueFlash ? 'flashing-cue' : ''}`} aria-live="assertive">
          <div className="cue-hud-icon-box compact-cue-icon">{getCueIcon(currentCue ? currentCue.cue : 'left')}</div>
          <div className="compact-cue-text">
            <span className="compact-route-name">
              {activeRoute.name} · {warnings.length} hazard{warnings.length === 1 ? '' : 's'}
            </span>
            <span className="compact-instruction">{cueText}</span>
          </div>
        </div>

        <div className="route-progress-track">
          <div className="route-progress-fill" style={{ width: `${Math.round(simProgressRatio * 100)}%` }} />
        </div>

        <div className="compact-controls">
          <button
            type="button"
            className={`sim-control-btn play-btn ${isSimulating ? 'simulating-active' : ''}`}
            onClick={handleToggleSimulation}
            aria-label={playLabel}
          >
            {isSimulating ? <Pause size={17} /> : <Play size={17} />}
            <span>{isSimulating ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            className={`sim-control-btn secondary ${useLiveGps ? 'gps-active' : ''}`}
            onClick={handleToggleGps}
            aria-label={useLiveGps ? 'Stop live GPS tracking' : 'Track with live GPS'}
          >
            <Navigation size={16} />
            <span>{useLiveGps ? 'GPS on' : 'GPS'}</span>
          </button>
          <button type="button" className="sim-control-btn secondary" onClick={handleResetSimulation} aria-label="Reset walk to start">
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            className="sim-control-btn secondary"
            onClick={() => setIsPanelExpanded(true)}
            aria-label="Show route details and change destination"
          >
            <ChevronUp size={16} />
            <span>Details</span>
          </button>
        </div>
        {gpsError && <span className="gps-err-text">{gpsError}</span>}
      </div>
    );
  }

  return (
    <div className="navigation-panel-container">
      {isNarrow && activeRoute && (
        <button type="button" className="collapse-panel-btn" onClick={() => setIsPanelExpanded(false)}>
          <ChevronDown size={16} />
          <span>Show bigger map</span>
        </button>
      )}

      {/* Navigation Mode Switcher Tabs */}
      <div className="nav-mode-switcher">
        <button
          type="button"
          className={`nav-mode-pill ${navMode === 'live' ? 'active' : ''}`}
          onClick={() => setNavMode('live')}
          id="mode-live-navigation"
        >
          <Sparkles size={14} />
          <span>Live: Any Campus Spot</span>
        </button>

        <button
          type="button"
          className={`nav-mode-pill ${navMode === 'prepared' ? 'active' : ''}`}
          onClick={() => {
            setNavMode('prepared');
            onClearDestination();
            setRouteError(null);
            resetWalk();
            onSimulationPositionChange(null);
            if (routes.length > 0) onSelectRoute(routes[0]);
          }}
          id="mode-prepared-routes"
        >
          <Compass size={14} />
          <span>Prepared Routes</span>
        </button>
      </div>

      {/* LIVE DESTINATION MODE */}
      {navMode === 'live' && (
        <div className="nav-card live-destination-card">
          <div className="live-header-row">
            <span className="live-search-label">
              <MapPin size={15} color="#06b6d4" />
              <span>Where do you want to walk on campus?</span>
            </span>
          </div>

          {/* Search Input Box: landmarks match as you type; Enter searches OpenStreetMap */}
          <form className="destination-search-container" onSubmit={handleSearchSubmit} role="search">
            <Search size={16} className="search-icon-inside" />
            <input
              type="search"
              enterKeyHint="search"
              className="destination-search-input"
              placeholder="Search a campus building, then press Enter"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPlaceResults([]);
                setHasSearchedPlaces(false);
              }}
              id="live-destination-search-input"
              aria-label="Search for a campus destination"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => {
                  setSearchQuery('');
                  setPlaceResults([]);
                  setHasSearchedPlaces(false);
                }}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </form>

          {/* Search Suggestions Dropdown */}
          {searchResults.length > 0 && (
            <div className="search-suggestions-dropdown">
              {searchResults.map((res, i) => (
                <button
                  type="button"
                  key={`${res.name}-${i}`}
                  className="search-suggestion-item"
                  onClick={() => handleSelectPlace(res)}
                >
                  <MapPin size={15} className="suggestion-pin-icon" />
                  <div className="suggestion-text">
                    <span className="suggestion-title">{res.name}</span>
                    {res.subtitle && <span className="suggestion-subtitle">{res.subtitle}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {isSearching && (
            <div className="searching-spinner-row">
              <Loader2 size={14} className="icon-spin" />
              <span>Searching campus locations...</span>
            </div>
          )}

          {hasSearchedPlaces && !isSearching && searchResults.length === 0 && (
            <p className="nav-hint-text">No places found in the UMD demo area.</p>
          )}

          {/* Action Row: Pick on Map */}
          <div className="pick-on-map-cta-row">
            <button
              type="button"
              className={`pick-dest-map-btn ${isPickingDestination ? 'active' : ''}`}
              onClick={onPickDestinationOnMap}
              id="pick-dest-map-btn"
            >
              <Target size={15} />
              <span>{isPickingDestination ? 'Tap on map now...' : 'Tap a Spot on the Map to Walk There'}</span>
            </button>
          </div>

          {/* Popular Campus Landmark Chips */}
          <div className="popular-landmarks-section">
            <span className="popular-title">Quick Campus Destinations:</span>
            <div className="landmark-chips-scroll">
              {POPULAR_CAMPUS_LANDMARKS.slice(0, 7).map((l) => (
                <button
                  key={l.name}
                  type="button"
                  className="landmark-chip"
                  onClick={() => handleSelectLandmark(l)}
                >
                  <span>{l.name.split(' (')[0].replace('for Computer Science', '')}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="nav-hint-text">
            {startIsUserLocation
              ? 'Routes start from your current location.'
              : 'Routes start from McKeldin Library (your location is unavailable or outside the UMD demo area).'}
          </p>

          {isCalculatingRoute && (
            <div className="calculating-route-row">
              <Loader2 size={16} className="icon-spin text-cyan" />
              <span>Calculating walking route from OpenStreetMap...</span>
            </div>
          )}

          {routeError && (
            <p className="nav-error-text" role="alert">
              {routeError}
            </p>
          )}
        </div>
      )}

      {/* PREPARED ROUTES MODE */}
      {navMode === 'prepared' && (
        <div className="nav-card route-picker-card">
          <div className="route-select-row">
            <label htmlFor="route-dropdown" className="route-picker-label">
              <Compass size={16} />
              <span>Select Campus Demo Route:</span>
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
        </div>
      )}

      {/* Route Metadata Strip */}
      {activeRoute && (
        <div className="nav-card active-route-summary-card">
          <div className="active-route-name-row">
            <span className="active-route-title">{activeRoute.name}</span>
            <span className="route-kind-badge">{activeRoute.kind === 'live' ? 'Live Walking Route' : 'Prepared Route'}</span>
          </div>
          <div className="route-meta-strip">
            <span className="route-stat-item">
              <strong>{activeRoute.distance_m}m</strong> walk
            </span>
            <span className="route-stat-divider">•</span>
            <span className="route-stat-item">
              <strong>~{activeRoute.est_minutes} min</strong>
            </span>
            <span className="route-stat-divider">•</span>
            <span className="route-stat-item">
              <strong>{activeRoute.steps.length}</strong> cues
            </span>
            <span className="route-stat-divider">•</span>
            <span className="route-stat-item warnings-count">
              <strong>{warnings.length}</strong> hazards nearby
            </span>
          </div>
          {activeRoute.disclaimer && <p className="route-disclaimer-text">{activeRoute.disclaimer}</p>}
        </div>
      )}

      {/* Turn-by-Turn Cue Banner */}
      <div className={`nav-card cue-hud-banner ${cueFlash ? 'flashing-cue' : ''}`} aria-live="assertive">
        <div className="cue-hud-icon-box">
          {getCueIcon(currentCue ? currentCue.cue : 'left')}
        </div>
        <div className="cue-hud-text-box">
          <div className="cue-hud-status-badge">
            {currentCue ? currentCue.cue.toUpperCase() + ' CUE' : 'READY TO NAVIGATE'}
          </div>
          <div className="cue-hud-instruction">
            {cueText}
          </div>
        </div>
      </div>

      {/* Walk Simulator / GPS Controls */}
      <div className="nav-card simulation-controls-card">
        <div className="sim-header-row">
          <div className="sim-title">
            <Radio size={14} className={isSimulating ? 'icon-pulse text-indigo' : ''} />
            <span>Walk Guidance & Simulation</span>
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
            disabled={!activeRoute}
            id="sim-play-pause-btn"
          >
            {isSimulating ? <Pause size={17} /> : <Play size={17} />}
            <span>{isSimulating ? 'Pause Walk' : 'Play Walk Simulation'}</span>
          </button>

          <button
            type="button"
            className="sim-control-btn secondary"
            onClick={handleStepForward}
            disabled={!activeRoute}
            title="Jump ahead 15% of the route"
            id="sim-step-btn"
          >
            <SkipForward size={16} />
            <span>Next Step</span>
          </button>

          <button
            type="button"
            className="sim-control-btn secondary"
            onClick={handleResetSimulation}
            disabled={!activeRoute}
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
            onClick={handleToggleGps}
            disabled={!activeRoute}
            id="live-gps-mode-btn"
          >
            <Navigation size={14} />
            <span>{useLiveGps ? 'Tracking via Live GPS' : 'Switch to Real Outdoors GPS'}</span>
          </button>
          {gpsError && <span className="gps-err-text">{gpsError}</span>}
        </div>
      </div>

      {/* Hazards Along Route */}
      <div className="nav-card warnings-list-card">
        <div className="card-section-title">
          <AlertTriangle size={16} color="#f59e0b" />
          <span>Hazards Along This Route ({warnings.length})</span>
        </div>

        {warnings.length === 0 ? (
          <p className="no-warnings-text">No reported barriers within 25m of this walking route.</p>
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
                      {(CATEGORY_INFO[warn.report.category]?.label ?? 'Hazard').toUpperCase()}
                    </span>
                    <span className="warning-distance-badge">
                      {warn.distance_along_m}m along route
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

/** e.g. "Caution: Pothole / Pit ahead. Deep pothole at the crosswalk edge." */
function hazardCueText(report: Report): string {
  const label = CATEGORY_INFO[report.category]?.label ?? 'Hazard';
  return `Caution: ${label} ahead.${report.note ? ` ${report.note}` : ''}`;
}

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
