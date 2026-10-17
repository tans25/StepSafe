import React, { useState, useEffect, useRef } from 'react';
import { Activity, ShieldAlert, Play, Square, Info, Sparkles, RefreshCw } from 'lucide-react';

interface SensorSample {
  timestamp: number;
  ax: number;
  ay: number;
  az: number;
  magnitude: number;
}

export const SensorLabModal: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSamples, setRecordedSamples] = useState<SensorSample[]>([]);
  const [sensorStatus, setSensorStatus] = useState<string>('Ready to start');
  const [currentAccel, setCurrentAccel] = useState<{ x: number; y: number; z: number; mag: number }>({
    x: 0,
    y: 9.8,
    z: 0,
    mag: 9.8,
  });
  const [impactCount, setImpactCount] = useState(0);
  const [recentImpact, setRecentImpact] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<number[]>([]);
  const recordBufferRef = useRef<SensorSample[]>([]);

  // Canvas Waveform Animator
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let y = 0; y < canvas.height; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw Baseline (gravity ~9.8 m/s^2)
      const baselineY = canvas.height * 0.6;
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, baselineY);
      ctx.lineTo(canvas.width, baselineY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Acceleration Magnitude Waveform
      const history = historyRef.current;
      if (history.length > 1) {
        ctx.strokeStyle = recentImpact ? '#ef4444' : '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        const stepX = canvas.width / 60;
        history.forEach((val, i) => {
          // Normalize ~0-25 m/s^2 to canvas height
          const y = canvas.height - (val / 25) * canvas.height;
          const x = i * stepX;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [recentImpact]);

  // Sensor Listener
  useEffect(() => {
    if (!isMonitoring) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc) return;

      const ax = acc.x || 0;
      const ay = acc.y || 0;
      const az = acc.z || 0;
      const mag = Math.sqrt(ax * ax + ay * ay + az * az);

      setCurrentAccel({
        x: Number(ax.toFixed(2)),
        y: Number(ay.toFixed(2)),
        z: Number(az.toFixed(2)),
        mag: Number(mag.toFixed(2)),
      });

      // Update waveform history
      historyRef.current.push(mag);
      if (historyRef.current.length > 60) {
        historyRef.current.shift();
      }

      // Threshold bump detection: sudden spike over 16 m/s^2
      if (mag > 16.5) {
        setRecentImpact(true);
        setImpactCount((prev) => prev + 1);
        setTimeout(() => setRecentImpact(false), 600);
      }

      // If recording sample
      if (isRecording) {
        recordBufferRef.current.push({
          timestamp: Date.now(),
          ax,
          ay,
          az,
          magnitude: mag,
        });
      }
    };

    window.addEventListener('devicemotion', handleMotion);

    // Fallback simulated sensor stream if testing on desktop browser without hardware accelerometer
    let mockInterval: number | null = null;
    const isMobileHardware = typeof window !== 'undefined' && 'ontouchstart' in window;

    if (!isMobileHardware) {
      setSensorStatus('Simulating realistic human walking motion & footstep patterns (Desktop Demo)');
      mockInterval = window.setInterval(() => {
        // Natural step bounce: 9.8 base + sine wave footfalls + occasional bump
        const t = Date.now() / 250;
        const bump = Math.random() < 0.05 ? 6.5 : 0;
        const fakeMag = 9.8 + Math.sin(t) * 2.2 + Math.cos(t * 2) * 1.1 + bump;
        const fakeAx = Math.sin(t * 1.5) * 1.2;
        const fakeAy = 9.8 + Math.cos(t) * 1.8;
        const fakeAz = Math.sin(t) * 0.8;

        setCurrentAccel({
          x: Number(fakeAx.toFixed(2)),
          y: Number(fakeAy.toFixed(2)),
          z: Number(fakeAz.toFixed(2)),
          mag: Number(fakeMag.toFixed(2)),
        });

        historyRef.current.push(fakeMag);
        if (historyRef.current.length > 60) historyRef.current.shift();

        if (fakeMag > 15.5) {
          setRecentImpact(true);
          setImpactCount((c) => c + 1);
          setTimeout(() => setRecentImpact(false), 500);
        }

        if (isRecording) {
          recordBufferRef.current.push({
            timestamp: Date.now(),
            ax: fakeAx,
            ay: fakeAy,
            az: fakeAz,
            magnitude: fakeMag,
          });
        }
      }, 100);
    } else {
      setSensorStatus('Live DeviceMotion hardware connected.');
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      if (mockInterval) clearInterval(mockInterval);
    };
  }, [isMonitoring, isRecording]);

  const handleStartMonitoring = async () => {
    // Request permission on iOS 13+ if needed
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === 'function'
    ) {
      try {
        const perm = await (
          DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }
        ).requestPermission();
        if (perm !== 'granted') {
          setSensorStatus('Permission to access device motion sensors was denied.');
          return;
        }
      } catch (err) {
        console.warn('DeviceMotion permission request error:', err);
      }
    }
    setIsMonitoring(true);
  };

  const handleStartRecording = () => {
    recordBufferRef.current = [];
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      setRecordedSamples([...recordBufferRef.current]);
    }, 4000);
  };

  // Compute summary stats from recorded window
  const computeSampleStats = () => {
    if (recordedSamples.length === 0) return null;
    const mags = recordedSamples.map((s) => s.magnitude);
    const mean = mags.reduce((a, b) => a + b, 0) / mags.length;
    const max = Math.max(...mags);
    const min = Math.min(...mags);
    const variance =
      mags.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / mags.length;
    return {
      count: mags.length,
      mean: mean.toFixed(2),
      max: max.toFixed(2),
      min: min.toFixed(2),
      stdDev: Math.sqrt(variance).toFixed(2),
    };
  };

  const stats = computeSampleStats();

  return (
    <div className="sensor-lab-container">
      {/* Disclaimer / Ethics Banner required by Technica track rules */}
      <div className="ethics-disclaimer-banner">
        <div className="disclaimer-icon">
          <ShieldAlert size={20} color="#f59e0b" />
        </div>
        <div className="disclaimer-text">
          <strong>Exploratory Sensor Research Demo:</strong> Sensor readings are sampled for academic
          demonstration only. Motion anomalies (bumps, irregularities) are hypotheses for human review
          and are <em>never</em> automatically published as verified public hazards.
        </div>
      </div>

      {/* Main Sensor Gauge & Waveform Card */}
      <div className="sensor-card">
        <div className="sensor-card-header">
          <div className="sensor-title-row">
            <Activity size={18} color="#06b6d4" />
            <h2>Live DeviceMotion Accelerometer</h2>
          </div>
          <span className={`sensor-live-pill ${isMonitoring ? 'active' : ''}`}>
            {isMonitoring ? 'Sensors Active' : 'Idle'}
          </span>
        </div>

        <p className="sensor-status-caption">{sensorStatus}</p>

        {/* Real-time Values Display */}
        <div className="accel-values-grid">
          <div className="accel-metric-box">
            <span className="metric-label">X-Axis (Lateral)</span>
            <span className="metric-val">{currentAccel.x} <small>m/s²</small></span>
          </div>

          <div className="accel-metric-box">
            <span className="metric-label">Y-Axis (Forward)</span>
            <span className="metric-val">{currentAccel.y} <small>m/s²</small></span>
          </div>

          <div className="accel-metric-box">
            <span className="metric-label">Z-Axis (Vertical)</span>
            <span className="metric-val">{currentAccel.z} <small>m/s²</small></span>
          </div>

          <div className={`accel-metric-box magnitude-box ${recentImpact ? 'impact-spike' : ''}`}>
            <span className="metric-label">Total Magnitude |a|</span>
            <span className="metric-val">{currentAccel.mag} <small>m/s²</small></span>
          </div>
        </div>

        {/* Waveform Canvas */}
        <div className="waveform-box">
          <div className="waveform-label-row">
            <span>Live Acceleration Waveform (m/s²)</span>
            <span className="impact-counter-badge">
              Jolts/Bumps Detected: <strong>{impactCount}</strong>
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            className="waveform-canvas"
            aria-label="Real-time motion waveform canvas"
          />
        </div>

        {/* Action Controls */}
        <div className="sensor-actions-row">
          {!isMonitoring ? (
            <button
              type="button"
              className="btn-primary"
              onClick={handleStartMonitoring}
              id="start-sensor-btn"
            >
              <Play size={16} />
              <span>Enable Sensor Monitoring</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsMonitoring(false)}
              id="stop-sensor-btn"
            >
              <Square size={16} />
              <span>Pause Monitoring</span>
            </button>
          )}

          <button
            type="button"
            className={`btn-primary capture-btn ${isRecording ? 'recording-now' : ''}`}
            disabled={!isMonitoring || isRecording}
            onClick={handleStartRecording}
            id="capture-motion-sample-btn"
          >
            {isRecording ? <RefreshCw className="icon-spin" size={16} /> : <Sparkles size={16} />}
            <span>{isRecording ? 'Recording (4s Window)...' : 'Record 4s Motion Window'}</span>
          </button>
        </div>
      </div>

      {/* Captured Window Feature Analysis */}
      {stats && (
        <div className="sensor-card sample-results-card">
          <div className="sensor-card-header">
            <div className="sensor-title-row">
              <Info size={17} color="#6366f1" />
              <h3>Sample Window Feature Vector (4-Second Epoch)</h3>
            </div>
            <span className="dataset-align-badge">Aligned with UCI HAR dataset</span>
          </div>

          <p className="sample-explanation">
            Extracted statistical features computed from your walking sample for offline pattern analysis:
          </p>

          <div className="stats-cards-grid">
            <div className="stat-card">
              <span className="stat-title">Sample Count</span>
              <span className="stat-num">{stats.count}</span>
            </div>
            <div className="stat-card">
              <span className="stat-title">Mean Magnitude</span>
              <span className="stat-num">{stats.mean} m/s²</span>
            </div>
            <div className="stat-card">
              <span className="stat-title">Standard Deviation</span>
              <span className="stat-num">{stats.stdDev}</span>
            </div>
            <div className="stat-card">
              <span className="stat-title">Peak Value</span>
              <span className="stat-num">{stats.max} m/s²</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
