import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Footprints, Map as MapIcon, ShieldAlert, Users, Vibrate, X } from 'lucide-react';
import { SHOW_SENSOR_LAB } from '../config';
import { saveOnboardingAccepted } from '../services/onboarding';

interface OnboardingScreenProps {
  /** Re-opened from the navbar: the disclaimer was already accepted, so it can be closed freely. */
  isRevisit: boolean;
  onFinish: () => void;
}

const FEATURES = [
  {
    icon: Vibrate,
    title: 'Feel your turns',
    text: 'Distinct vibration patterns for left, right and caution, with on-screen text and sound alternatives. iPhones play the sounds only, since iPhone browsers cannot vibrate.',
  },
  {
    icon: MapIcon,
    title: 'See sidewalk barriers',
    text: 'A map of community-reported hazards like closures, potholes, standing water and missing curb ramps.',
  },
  {
    icon: Users,
    title: 'Report what you find',
    text: 'Add a barrier in a few taps so the next person knows what is ahead. Others can confirm or flag it.',
  },
];

const DISCLAIMER_POINTS = [
  'StepSafe is a hackathon prototype for a small campus demo area. It is not a replacement for established navigation or accessibility services.',
  'Hazard reports are community-submitted and may be incomplete, inaccurate or out of date.',
  'StepSafe only covers the University of Maryland, College Park campus.',
  'Walking routes come from OpenStreetMap data or are prepared demo routes. They may not reflect closures, curb ramps or surface conditions.',
  'Always rely on your own judgment and surroundings. Do not look at or interact with your phone while crossing streets or moving around hazards.',
  'Your location centers the map and suggests a report position. It is sent to StepSafe when you submit a report (as the hazard location), and your start point and search text go to OpenStreetMap services when you ask for a walking route.',
  ...(SHOW_SENSOR_LAB ? ['Sensor Lab readings are experimental and never count as a confirmed hazard.'] : []),
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ isRevisit, onFinish }) => {
  const [step, setStep] = useState<'intro' | 'disclaimer'>('intro');
  const [acknowledged, setAcknowledged] = useState(isRevisit);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the step heading so screen readers announce each step.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!isRevisit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isRevisit, onFinish]);

  const handleFinish = () => {
    saveOnboardingAccepted();
    onFinish();
  };

  return (
    <div className="onboarding-screen">
      <div className="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        {isRevisit && (
          <button type="button" className="icon-close-btn onboarding-close" onClick={onFinish} aria-label="Close">
            <X size={20} />
          </button>
        )}

        {step === 'intro' ? (
          <>
            <div className="onboarding-hero">
              <div className="onboarding-brand-icon">
                <Footprints size={30} color="#ffffff" />
              </div>
              <h1 id="onboarding-title" ref={headingRef} tabIndex={-1}>
                Welcome to StepSafe
              </h1>
              <p className="onboarding-tagline">
                Haptic walking navigation and a community map of sidewalk barriers, so you can keep your eyes on the
                path instead of the screen.
              </p>
            </div>

            <ul className="onboarding-feature-list">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="onboarding-feature">
                  <div className="onboarding-feature-icon">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h2>{title}</h2>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="onboarding-footer">
              <StepDots step={step} />
              <button type="button" className="btn-primary" onClick={() => setStep('disclaimer')} id="onboarding-next-btn">
                <span>Next</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="onboarding-hero">
              <div className="onboarding-brand-icon onboarding-warning-icon">
                <ShieldAlert size={30} color="#ffffff" />
              </div>
              <h1 id="onboarding-title" ref={headingRef} tabIndex={-1}>
                Before you start
              </h1>
              <p className="onboarding-tagline">Please read this. StepSafe is a guide, not a guarantee.</p>
            </div>

            <ul className="onboarding-disclaimer-list">
              {DISCLAIMER_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>

            <label className="onboarding-ack">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                id="onboarding-ack-checkbox"
              />
              <span>I understand that StepSafe's routes and reports are informational and not a guarantee of accessibility or safety.</span>
            </label>

            <div className="onboarding-footer">
              <button type="button" className="btn-secondary" onClick={() => setStep('intro')}>
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <StepDots step={step} />
              <button
                type="button"
                className="btn-primary"
                onClick={handleFinish}
                disabled={!acknowledged}
                id="onboarding-accept-btn"
              >
                {isRevisit ? 'Close' : 'Get started'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function StepDots({ step }: { step: 'intro' | 'disclaimer' }) {
  return (
    <div className="onboarding-dots" aria-label={`Step ${step === 'intro' ? 1 : 2} of 2`} role="img">
      <span className={step === 'intro' ? 'active' : ''} />
      <span className={step === 'disclaimer' ? 'active' : ''} />
    </div>
  );
}
