import { useState, useEffect, useCallback, useRef } from 'react';
import { pollingService } from '../services/pollingService.js';
import { PanelStatus } from '../types/index.js';

export interface UseStatusPollingResult {
  panelData: PanelStatus[];
  loading: boolean;
  error: string | null;
  retryInfo: {
    isRetrying: boolean;
    retryCount: number;
    nextRetryDelay: number;
  };
  refresh: () => Promise<void>;
}

/**
 * Custom hook for managing status data polling
 */
export function useStatusPolling(projectId: string): UseStatusPollingResult {
  const [panelData, setPanelData] = useState<PanelStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryInfo, setRetryInfo] = useState({
    isRetrying: false,
    retryCount: 0,
    nextRetryDelay: 0
  });

  const isInitialLoad = useRef(true);

  const handleData = useCallback((data: PanelStatus[]) => {
    setPanelData(data);
    setError(null);
    setLoading(false);
    setRetryInfo(prev => ({ ...prev, isRetrying: false, retryCount: 0 }));
    isInitialLoad.current = false;
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err.message);
    // Only set loading to false after initial load attempt
    if (!isInitialLoad.current) {
      setLoading(false);
    }
  }, []);

  const handleRetry = useCallback((attempt: number, delay: number) => {
    setRetryInfo({
      isRetrying: true,
      retryCount: attempt,
      nextRetryDelay: delay
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await pollingService.refresh();
    } catch (err) {
      // Error will be handled by the polling service callbacks
    }
  }, []);

  useEffect(() => {
    // Start polling when component mounts or project changes
    setLoading(true);
    setError(null);
    isInitialLoad.current = true;

    pollingService.start(projectId, {
      onData: handleData,
      onError: handleError,
      onRetry: handleRetry
    });

    return () => {
      // Stop polling when component unmounts
      pollingService.stop();
    };
  }, [projectId, handleData, handleError, handleRetry]);

  useEffect(() => {
    // Update project ID if it changes while polling is active
    pollingService.updateProject(projectId);
  }, [projectId]);

  return {
    panelData,
    loading,
    error,
    retryInfo,
    refresh
  };
}