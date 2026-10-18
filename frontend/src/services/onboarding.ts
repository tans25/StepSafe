// Bump the version when the disclaimer text changes so everyone sees it again.
const ONBOARDING_STORAGE_KEY = 'stepsafe_onboarding_v2';

export function hasAcceptedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'accepted';
  } catch {
    return false;
  }
}

export function saveOnboardingAccepted() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'accepted');
  } catch (e) {
    console.warn('localStorage write failed', e);
  }
}
