import React, { useState } from 'react';
import { CATEGORY_INFO, DEFAULT_META } from '../config';
import type { CategoryId, Point } from '../types';
import { X, MapPin, Locate, Send, AlertCircle } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { category: CategoryId; lat: number; lng: number; note?: string }) => Promise<void>;
  pendingCoords: Point | null;
  onSelectCoords: (coords: Point) => void;
  onTogglePickOnMap: () => void;
  isPickingLocation: boolean;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  pendingCoords,
  onSelectCoords,
  onTogglePickOnMap,
  isPickingLocation,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('blocked_sidewalk');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentCoords = pendingCoords || {
    lat: DEFAULT_META.demo_area.center[0],
    lng: DEFAULT_META.demo_area.center[1],
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSelectCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setErrorMsg(null);
      },
      (err) => {
        setErrorMsg(`Unable to get location: ${err.message}. Please click on map.`);
      },
      { timeout: 8000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        category: selectedCategory,
        lat: Number(currentCoords.lat.toFixed(6)),
        lng: Number(currentCoords.lng.toFixed(6)),
        note: note.trim() || undefined,
      });
      setNote('');
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit report. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card report-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="report-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 id="report-modal-title">Report Sidewalk Barrier</h2>
            <p className="modal-description">
              Help make campus walking safer. Reports are shared with the community.
            </p>
          </div>
          <button type="button" className="icon-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="report-form">
          {errorMsg && (
            <div className="form-error-banner">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Category Selection */}
          <div className="form-group">
            <label className="form-label">Barrier Category</label>
            <div className="category-grid-picker">
              {Object.entries(CATEGORY_INFO).map(([id, info]) => {
                const isSelected = selectedCategory === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`category-select-tile ${isSelected ? 'selected' : ''}`}
                    style={
                      isSelected
                        ? { borderColor: info.color, backgroundColor: info.badgeBg }
                        : undefined
                    }
                    onClick={() => setSelectedCategory(id as CategoryId)}
                  >
                    <div
                      className="category-tile-dot"
                      style={{ backgroundColor: info.color }}
                    />
                    <div className="category-tile-info">
                      <span className="category-tile-title">{info.label}</span>
                      <span className="category-tile-desc">{info.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location Selection & Review */}
          <div className="form-group location-group">
            <label className="form-label">Review Location</label>
            <div className="location-inputs-row">
              <div className="coordinate-pill">
                <MapPin size={15} color="#6366f1" />
                <span className="coord-text">
                  {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
                </span>
              </div>

              <div className="location-buttons-row">
                <button
                  type="button"
                  className="loc-action-btn"
                  onClick={handleUseCurrentLocation}
                  title="Use GPS position"
                >
                  <Locate size={14} />
                  <span>Use GPS</span>
                </button>

                <button
                  type="button"
                  className={`loc-action-btn ${isPickingLocation ? 'active' : ''}`}
                  onClick={onTogglePickOnMap}
                  title="Tap on map to reposition pin"
                >
                  <MapPin size={14} />
                  <span>{isPickingLocation ? 'Picking...' : 'Pick on Map'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Note Input */}
          <div className="form-group">
            <div className="label-with-counter">
              <label htmlFor="report-note-input" className="form-label">
                Additional Details (Optional)
              </label>
              <span className="char-counter">{280 - note.length} left</span>
            </div>
            <textarea
              id="report-note-input"
              className="form-textarea"
              placeholder="e.g. Broken pavement slab right next to the crosswalk button; avoid in wet weather."
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 280))}
              rows={3}
            />
          </div>

          <div className="modal-actions-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              id="submit-report-btn"
            >
              <Send size={16} />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Barrier Report'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
