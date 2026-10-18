import React, { useState } from 'react';
import { CATEGORY_INFO } from '../config';
import { isLocalOnlyReport } from '../services/api';
import { formatRelativeTime } from '../services/geo';
import type { Report } from '../types';
import { X, ThumbsUp, Flag, Clock, AlertTriangle, CheckCircle, Shield } from 'lucide-react';

interface ReportDetailModalProps {
  report: Report | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
  onFlag: (id: string) => Promise<void>;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  report,
  onClose,
  onConfirm,
  onFlag,
}) => {
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [hasFlagged, setHasFlagged] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (!report) return null;

  const catInfo = CATEGORY_INFO[report.category] || CATEGORY_INFO.other;

  const handleConfirmClick = async () => {
    if (hasConfirmed || actionLoading) return;
    setActionLoading(true);
    try {
      await onConfirm(report.id);
      setHasConfirmed(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFlagClick = async () => {
    if (hasFlagged || actionLoading) return;
    setActionLoading(true);
    try {
      await onFlag(report.id);
      setHasFlagged(true);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card detail-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="report-detail-title"
      >
        <div className="modal-header">
          <div className="category-header-pill" style={{ backgroundColor: catInfo.badgeBg, color: catInfo.color }}>
            <span className="dot" style={{ backgroundColor: catInfo.color }} />
            <span id="report-detail-title">{catInfo.label}</span>
          </div>
          <button type="button" className="icon-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        <div className="detail-body">
          <div className="detail-meta-row">
            <span className="detail-meta-chip">
              <Clock size={13} />
              <span>{formatRelativeTime(report.created_at)}</span>
            </span>

            {report.is_stale ? (
              <span className="detail-meta-chip stale-badge">
                <AlertTriangle size={13} />
                <span>Stale: may be outdated</span>
              </span>
            ) : (
              <span className="detail-meta-chip verified-badge">
                <CheckCircle size={13} />
                <span>{report.status === 'confirmed' ? 'Community Confirmed' : 'Community Reported'}</span>
              </span>
            )}

            <span className="detail-meta-chip source-badge">
              <Shield size={13} />
              <span>
                {report.source === 'seed'
                  ? 'Sample Demo Data'
                  : isLocalOnlyReport(report)
                    ? 'Saved on This Device Only'
                    : 'Live Walker Report'}
              </span>
            </span>
          </div>

          {report.source === 'seed' && (
            <p className="detail-sample-note">
              Sample report for the demo. It does not describe a real, verified sidewalk condition.
            </p>
          )}

          <div className="detail-note-box">
            <p className="detail-note-text">
              {report.note ? report.note : 'No extra notes provided for this hazard barrier.'}
            </p>
          </div>

          <div className="detail-coords-row">
            <span className="coord-label">Coordinates:</span>
            <span className="coord-val">
              {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
            </span>
          </div>

          <div className="detail-actions-row">
            <button
              type="button"
              className={`action-btn confirm-btn ${hasConfirmed ? 'confirmed' : ''}`}
              onClick={handleConfirmClick}
              disabled={actionLoading || hasConfirmed}
              title="Confirm that this sidewalk barrier is present"
              id="confirm-report-btn"
            >
              <ThumbsUp size={16} />
              <span>
                {hasConfirmed ? 'Confirmed!' : `Confirm Barrier (${report.confirm_count + (hasConfirmed ? 1 : 0)})`}
              </span>
            </button>

            <button
              type="button"
              className={`action-btn flag-btn ${hasFlagged ? 'flagged' : ''}`}
              onClick={handleFlagClick}
              disabled={actionLoading || hasFlagged}
              title="Flag if fixed, resolved, or inaccurate"
              id="flag-report-btn"
            >
              <Flag size={16} />
              <span>{hasFlagged ? 'Flagged' : `Flag Inaccurate (${report.flag_count})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
