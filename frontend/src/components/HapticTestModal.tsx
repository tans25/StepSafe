import { useState } from 'react';
import { isVibrationSupported, triggerHapticCue } from '../services/haptics';
import type { CueType } from '../types';
import { X, Vibrate, Volume2, CheckCircle2, ArrowUpLeft, ArrowUpRight, AlertTriangle, Flag, Sparkles } from 'lucide-react';

interface HapticTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HapticTestModal: React.FC<HapticTestModalProps> = ({ isOpen, onClose }) => {
  const [activeCue, setActiveCue] = useState<CueType | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const vibSupported = isVibrationSupported();

  const handleTest = (cue: CueType) => {
    setActiveCue(cue);
    const { vibrated, pattern } = triggerHapticCue(cue, { playSoundFallback: true });

    if (vibrated) {
      setTestResult(`Vibrating pattern [${pattern.join(', ')}] ms on your device!`);
    } else {
      setTestResult(`Audio + visual cue played (Device Vibration API unavailable on this browser).`);
    }

    setTimeout(() => {
      setActiveCue(null);
    }, 1000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card haptic-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="haptic-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="title-with-badge">
              <Vibrate size={20} color="#6366f1" />
              <h2 id="haptic-modal-title">Haptic & Tactile Cue Tester</h2>
            </div>
            <p className="modal-description">
              Test how tactile turn signals and caution warnings feel without looking at your screen.
            </p>
          </div>
          <button type="button" className="icon-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        {/* Device Support Callout */}
        <div className={`support-callout-box ${vibSupported ? 'supported' : 'fallback-mode'}`}>
          <div className="support-icon">
            {vibSupported ? <CheckCircle2 size={18} color="#10b981" /> : <Volume2 size={18} color="#f59e0b" />}
          </div>
          <div className="support-details">
            <span className="support-status">
              {vibSupported
                ? 'Vibration API Active & Supported'
                : 'Acoustic Synthesizer Fallback Active'}
            </span>
            <span className="support-subtext">
              {vibSupported
                ? 'Physical motor pulses will trigger in your hand.'
                : 'iOS Safari / Desktops do not expose vibration motors to websites. StepSafe plays synthesized spatial audio tones so you can test cues.'}
            </span>
          </div>
        </div>

        {/* 4 Cues Grid */}
        <div className="cues-test-grid">
          {/* LEFT CUE */}
          <div className={`cue-test-card ${activeCue === 'left' ? 'cue-firing cue-left' : ''}`}>
            <div className="cue-test-top">
              <div className="cue-type-icon left-icon">
                <ArrowUpLeft size={24} />
              </div>
              <div className="cue-type-info">
                <h3>Left Turn Cue</h3>
                <span className="timing-spec">Pattern: 150ms vib · 100ms pause · 150ms vib</span>
              </div>
            </div>
            <p className="cue-purpose-text">Two rapid pulses signaling a left turn ahead.</p>
            <button
              type="button"
              className="test-trigger-btn"
              onClick={() => handleTest('left')}
              id="test-cue-left"
            >
              <Vibrate size={15} />
              <span>Feel Left Cue</span>
            </button>
          </div>

          {/* RIGHT CUE */}
          <div className={`cue-test-card ${activeCue === 'right' ? 'cue-firing cue-right' : ''}`}>
            <div className="cue-test-top">
              <div className="cue-type-icon right-icon">
                <ArrowUpRight size={24} />
              </div>
              <div className="cue-type-info">
                <h3>Right Turn Cue</h3>
                <span className="timing-spec">Pattern: 350ms steady vibration</span>
              </div>
            </div>
            <p className="cue-purpose-text">One continuous longer vibration for right turns.</p>
            <button
              type="button"
              className="test-trigger-btn"
              onClick={() => handleTest('right')}
              id="test-cue-right"
            >
              <Vibrate size={15} />
              <span>Feel Right Cue</span>
            </button>
          </div>

          {/* CAUTION CUE */}
          <div className={`cue-test-card ${activeCue === 'caution' ? 'cue-firing cue-caution' : ''}`}>
            <div className="cue-test-top">
              <div className="cue-type-icon caution-icon">
                <AlertTriangle size={24} />
              </div>
              <div className="cue-type-info">
                <h3>Caution / Barrier Ahead</h3>
                <span className="timing-spec">Pattern: 3 rapid bursts + solid warning pulse</span>
              </div>
            </div>
            <p className="cue-purpose-text">Urgent staccato buzz warning of a sidewalk barrier.</p>
            <button
              type="button"
              className="test-trigger-btn"
              onClick={() => handleTest('caution')}
              id="test-cue-caution"
            >
              <Vibrate size={15} />
              <span>Feel Caution Cue</span>
            </button>
          </div>

          {/* ARRIVED CUE */}
          <div className={`cue-test-card ${activeCue === 'arrived' ? 'cue-firing cue-arrived' : ''}`}>
            <div className="cue-test-top">
              <div className="cue-type-icon arrived-icon">
                <Flag size={24} />
              </div>
              <div className="cue-type-info">
                <h3>Destination Reached</h3>
                <span className="timing-spec">Pattern: Double pulse + extended celebratory hum</span>
              </div>
            </div>
            <p className="cue-purpose-text">Celebratory chime confirming arrival at endpoint.</p>
            <button
              type="button"
              className="test-trigger-btn"
              onClick={() => handleTest('arrived')}
              id="test-cue-arrived"
            >
              <Sparkles size={15} />
              <span>Feel Arrival Cue</span>
            </button>
          </div>
        </div>

        {testResult && (
          <div className="haptic-feedback-banner">
            <span>{testResult}</span>
          </div>
        )}

        <div className="modal-actions-footer">
          <button type="button" className="btn-primary" onClick={onClose}>
            Done Testing
          </button>
        </div>
      </div>
    </div>
  );
};
