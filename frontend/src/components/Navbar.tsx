import React from 'react';
import { Compass, Footprints, Activity, Vibrate, Radio, Info } from 'lucide-react';

interface NavbarProps {
  activeTab: 'map' | 'navigation' | 'sensors';
  setActiveTab: (tab: 'map' | 'navigation' | 'sensors') => void;
  isBackendLive: boolean;
  onOpenHapticTest: () => void;
  onOpenReportModal: () => void;
  onOpenAbout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isBackendLive,
  onOpenHapticTest,
  onOpenReportModal,
  onOpenAbout,
}) => {
  return (
    <header className="navbar-container">
      <div className="navbar-top">
        <div className="navbar-brand">
          <div className="brand-icon">
            <Footprints className="icon-pulse" size={20} color="#ffffff" />
          </div>
          <div className="brand-text">
            <div className="brand-title">StepSafe</div>
            <div className="brand-subtitle">Haptic Walking Navigation</div>
          </div>
        </div>

        <div className="navbar-actions">
          <button
            type="button"
            className="action-pill-btn"
            onClick={onOpenAbout}
            title="About StepSafe and safety disclaimer"
            aria-label="About StepSafe and safety disclaimer"
            id="about-btn"
          >
            <Info size={16} />
            <span className="btn-label-desktop">About</span>
          </button>

          <button
            type="button"
            className="action-pill-btn haptic-test-btn"
            onClick={onOpenHapticTest}
            title="Test sensory vibration cues"
            id="test-haptics-btn"
          >
            <Vibrate size={16} />
            <span className="btn-label-desktop">Test Haptics</span>
          </button>

          <button
            type="button"
            className="action-pill-btn report-cta-btn"
            onClick={onOpenReportModal}
            title="Report a sidewalk barrier or hazard"
            id="report-hazard-header-btn"
          >
            <span className="plus-symbol">+</span>
            <span>Report Barrier</span>
          </button>
        </div>
      </div>

      <div className="navbar-tabs-row">
        <nav className="tab-switcher" aria-label="App Navigation">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
            id="tab-map-view"
          >
            <Compass size={17} />
            <span>Hazard Map</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'navigation' ? 'active' : ''}`}
            onClick={() => setActiveTab('navigation')}
            id="tab-navigation-view"
          >
            <Footprints size={17} />
            <span>Route Guidance</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'sensors' ? 'active' : ''}`}
            onClick={() => setActiveTab('sensors')}
            id="tab-sensors-view"
          >
            <Activity size={17} />
            <span>Sensor Lab</span>
          </button>
        </nav>

        <div className="status-indicator-badge">
          <Radio size={13} className={isBackendLive ? 'status-dot-live' : 'status-dot-demo'} />
          <span className="status-text">{isBackendLive ? 'Live API' : 'Demo Mode'}</span>
        </div>
      </div>
    </header>
  );
};
