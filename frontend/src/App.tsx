import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { MapContainer } from './components/MapContainer';
import { NavigationHUD } from './components/NavigationHUD';
import { ReportModal } from './components/ReportModal';
import { ReportDetailModal } from './components/ReportDetailModal';
import { HapticTestModal } from './components/HapticTestModal';
import { SensorLabModal } from './components/SensorLabModal';
import { OnboardingScreen } from './components/OnboardingScreen';
import { DEFAULT_META, SHOW_SENSOR_LAB } from './config';
import type { CategoryId, Point, Report, Route, RouteWarning } from './types';
import {
  checkBackendHealth,
  computeRouteWarnings,
  confirmReport,
  createReport,
  fetchAppMeta,
  fetchReports,
  fetchRoutes,
  fetchRouteWarnings,
  flagReport,
} from './services/api';
import { setHapticPatterns } from './services/haptics';
import { hasAcceptedOnboarding } from './services/onboarding';
import './App.css';

export function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'navigation' | 'sensors'>('map');
  const [reports, setReports] = useState<Report[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [warnings, setWarnings] = useState<RouteWarning[]>([]);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const [showStale, setShowStale] = useState<boolean>(true);

  // Modals & Selection
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isHapticTestOpen, setIsHapticTestOpen] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [pendingReportCoords, setPendingReportCoords] = useState<Point | null>(null);

  // Geolocation & Simulation
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [simulationPosition, setSimulationPosition] = useState<Point | null>(null);
  const [isBackendLive, setIsBackendLive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Intro + disclaimer: shown until accepted once, re-openable from the navbar.
  const [hasOnboarded, setHasOnboarded] = useState(hasAcceptedOnboarding);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(!hasOnboarded);
  const closeOnboarding = useCallback(() => {
    setIsOnboardingOpen(false);
    setHasOnboarded(true);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Initial Data Load
  useEffect(() => {
    async function init() {
      const health = await checkBackendHealth();
      setIsBackendLive(health.ok);

      // Backend is the source of truth for haptic patterns.
      const meta = await fetchAppMeta();
      setHapticPatterns(meta.haptic_patterns);

      const [loadedReports, loadedRoutes] = await Promise.all([
        fetchReports(),
        fetchRoutes(),
      ]);

      setReports(loadedReports);
      setRoutes(loadedRoutes);
      if (loadedRoutes.length > 0) {
        setActiveRoute(loadedRoutes[0]);
      }
    }
    init();
  }, []);

  // Ask for location only after the disclaimer (which explains its use) is accepted.
  useEffect(() => {
    if (!hasOnboarded) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // Default to UMD campus center if declined
          setUserLocation({
            lat: DEFAULT_META.demo_area.center[0],
            lng: DEFAULT_META.demo_area.center[1],
          });
        },
        { timeout: 6000 }
      );
    }
  }, [hasOnboarded]);

  // Recalculate route warnings when route or reports change
  useEffect(() => {
    let cancelled = false;
    async function loadWarnings() {
      if (!activeRoute) return;
      const backendWarnings = await fetchRouteWarnings(activeRoute.id);
      if (cancelled) return;
      if (backendWarnings !== null) {
        setWarnings(backendWarnings);
      } else if (reports.length > 0) {
        setWarnings(computeRouteWarnings(activeRoute, reports));
      }
    }
    loadWarnings();
    return () => {
      cancelled = true;
    };
  }, [activeRoute, reports]);

  // Filtered reports for the map
  const filteredReports = reports.filter((r) => {
    if (r.status === 'hidden') return false;
    if (!showStale && r.is_stale) return false;
    if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
    return true;
  });

  // Handle map click when placing report
  const handleMapClickForReport = useCallback(
    (coords: Point) => {
      if (isPickingLocation || isReportModalOpen) {
        setPendingReportCoords(coords);
        setIsPickingLocation(false);
        setIsReportModalOpen(true);
      }
    },
    [isPickingLocation, isReportModalOpen]
  );

  // Submit new report
  const handleSubmitReport = async (data: {
    category: CategoryId;
    lat: number;
    lng: number;
    note?: string;
  }) => {
    const created = await createReport(data);
    setReports((prev) => [created, ...prev]);
    setPendingReportCoords(null);
    showToast('Hazard barrier submitted! Thank you for helping accessible navigation.');
  };

  // Confirm report
  const handleConfirmReport = async (id: string) => {
    const updated = await confirmReport(id);
    if (updated) {
      setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setSelectedReport(updated);
      showToast('Thank you for confirming this barrier condition.');
    }
  };

  // Flag report
  const handleFlagReport = async (id: string) => {
    const updated = await flagReport(id);
    if (updated) {
      setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
      if (updated.status === 'hidden') {
        setSelectedReport(null);
        showToast('Report flagged and hidden after community review.');
      } else {
        setSelectedReport(updated);
        showToast('Barrier flagged as inaccurate.');
      }
    }
  };

  return (
    <>
    {/* inert keeps keyboard and screen-reader focus out of the app while the intro is open */}
    <div className="app-root-layout" inert={isOnboardingOpen}>
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isBackendLive={isBackendLive}
        onOpenHapticTest={() => setIsHapticTestOpen(true)}
        onOpenAbout={() => setIsOnboardingOpen(true)}
        onOpenReportModal={() => {
          if (!pendingReportCoords && userLocation) {
            setPendingReportCoords(userLocation);
          }
          setIsReportModalOpen(true);
        }}
      />

      {/* Main Content Area */}
      <main className="app-main-content">
        {SHOW_SENSOR_LAB && activeTab === 'sensors' ? (
          <SensorLabModal />
        ) : (
          <div className="map-and-sidebar-layout">
            {/* Map Area */}
            <div className="map-section-pane">
              <FilterBar
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                showStale={showStale}
                onToggleShowStale={() => setShowStale(!showStale)}
                reportCount={filteredReports.length}
              />

              <MapContainer
                reports={filteredReports}
                userLocation={userLocation}
                activeRoute={activeTab === 'navigation' ? activeRoute : null}
                simulationPosition={simulationPosition}
                selectedReport={selectedReport}
                onSelectReport={setSelectedReport}
                pendingReportCoords={pendingReportCoords}
                onMapClickForReport={handleMapClickForReport}
                isPickingLocation={isPickingLocation}
              />
            </div>

            {/* Side HUD / Navigation Panel */}
            {activeTab === 'navigation' && (
              <aside className="navigation-side-pane">
                <NavigationHUD
                  routes={routes}
                  activeRoute={activeRoute}
                  onSelectRoute={setActiveRoute}
                  warnings={warnings}
                  onSimulationPositionChange={setSimulationPosition}
                  onSelectReport={setSelectedReport}
                />
              </aside>
            )}
          </div>
        )}
      </main>

      {/* Report Barrier Form Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setIsPickingLocation(false);
        }}
        onSubmit={handleSubmitReport}
        pendingCoords={pendingReportCoords}
        onSelectCoords={setPendingReportCoords}
        onTogglePickOnMap={() => {
          setIsReportModalOpen(false);
          setIsPickingLocation(true);
          showToast('Tap anywhere on the map to set the barrier location.');
        }}
        isPickingLocation={isPickingLocation}
      />

      {/* Report Detail & Confirmation Modal */}
      <ReportDetailModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        onConfirm={handleConfirmReport}
        onFlag={handleFlagReport}
      />

      {/* Haptic & Sound Test Modal */}
      <HapticTestModal
        isOpen={isHapticTestOpen}
        onClose={() => setIsHapticTestOpen(false)}
      />

      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div className="floating-toast-alert" role="status">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>

    {/* Intro & Disclaimer */}
    {isOnboardingOpen && <OnboardingScreen isRevisit={hasOnboarded} onFinish={closeOnboarding} />}
    </>
  );
}

export default App;