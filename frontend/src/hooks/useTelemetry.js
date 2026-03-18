// src/hooks/useTelemetry.js
// WebSocket live telemetry hook — connects to backend WS, reconnects on drop
import { useState, useEffect, useRef, useCallback } from 'react';
import { createWS } from '../services/api';

export function useTelemetry() {
  const [telemetry,  setTelemetry]  = useState([]);
  const [alerts,     setAlerts]     = useState([]);
  const [kpis,       setKpis]       = useState({});
  const [connected,  setConnected]  = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const wsRef    = useRef(null);
  const retryRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      const ws = createWS((msg) => {
        switch (msg.type) {
          case 'TELEMETRY_UPDATE':
            setTelemetry(msg.telemetry || []);
            setAlerts(msg.alerts || []);
            setKpis(msg.kpis || {});
            setLastUpdate(new Date(msg.timestamp));
            break;
          case 'NEW_ALERT':
            setAlerts(prev => [msg.alert, ...prev].slice(0, 20));
            break;
          case 'CONNECTED':
            console.log('[WS] Sentinel telemetry stream active');
            break;
          default:
            break;
        }
      });

      ws.onopen  = () => { setConnected(true); clearTimeout(retryRef.current); };
      ws.onclose = () => {
        setConnected(false);
        retryRef.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => setConnected(false);
      wsRef.current = ws;
    } catch (err) {
      console.warn('[WS] Connection failed, retrying...', err.message);
      retryRef.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Helper: get telemetry for a specific vessel
  const getVesselTelemetry = useCallback((vesselId) => {
    return telemetry.find(t => t.vessel_id === vesselId) || null;
  }, [telemetry]);

  // Helper: unacknowledged alert count
  const alertCount = alerts.filter(a => !a.is_acknowledged).length;

  return { telemetry, alerts, kpis, connected, lastUpdate, getVesselTelemetry, alertCount };
}
