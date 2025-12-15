import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorRecoveryService } from './errorRecoveryService.js';

// Mock the API and storage services
vi.mock('./api.js', () => ({
  statusApi: {
    testConnection: vi.fn()
  }
}));

vi.mock('./azureStorage.js', () => ({
  azureStorage: {
    testConnection: vi.fn()
  }
}));

describe('ErrorRecoveryService', () => {
  let service: ErrorRecoveryService;
  let mockCallbacks: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ErrorRecoveryService();
    
    mockCallbacks = {
      onRecoveryStart: vi.fn(),
      onRecoverySuccess: vi.fn(),
      onRecoveryFailed: vi.fn(),
      onFullRecovery: vi.fn()
    };
    
    service.setCallbacks(mockCallbacks);
  });

  afterEach(() => {
    service.stopRecovery();
  });

  describe('error reporting', () => {
    it('should report API errors correctly', () => {
      service.reportApiError('API connection failed');
      
      const errorState = service.getErrorState();
      expect(errorState.hasApiError).toBe(true);
      expect(errorState.lastApiError).toBe('API connection failed');
      expect(errorState.apiErrorTime).toBeInstanceOf(Date);
    });

    it('should report storage errors correctly', () => {
      service.reportStorageError('Storage connection failed');
      
      const errorState = service.getErrorState();
      expect(errorState.hasStorageError).toBe(true);
      expect(errorState.lastStorageError).toBe('Storage connection failed');
      expect(errorState.storageErrorTime).toBeInstanceOf(Date);
    });

    it('should detect when system has errors', () => {
      expect(service.hasErrors()).toBe(false);
      
      service.reportApiError('API error');
      expect(service.hasErrors()).toBe(true);
      
      service.reportApiSuccess();
      expect(service.hasErrors()).toBe(false);
      
      service.reportStorageError('Storage error');
      expect(service.hasErrors()).toBe(true);
    });
  });

  describe('recovery reporting', () => {
    it('should report API recovery success', () => {
      service.reportApiError('API error');
      expect(service.getErrorState().hasApiError).toBe(true);
      
      service.reportApiSuccess();
      expect(service.getErrorState().hasApiError).toBe(false);
      expect(mockCallbacks.onRecoverySuccess).toHaveBeenCalledWith('api');
    });

    it('should report storage recovery success', () => {
      service.reportStorageError('Storage error');
      expect(service.getErrorState().hasStorageError).toBe(true);
      
      service.reportStorageSuccess();
      expect(service.getErrorState().hasStorageError).toBe(false);
      expect(mockCallbacks.onRecoverySuccess).toHaveBeenCalledWith('storage');
    });

    it('should trigger full recovery when all errors are resolved', () => {
      service.reportApiError('API error');
      service.reportStorageError('Storage error');
      
      service.reportApiSuccess();
      expect(mockCallbacks.onFullRecovery).not.toHaveBeenCalled();
      
      service.reportStorageSuccess();
      expect(mockCallbacks.onFullRecovery).toHaveBeenCalled();
    });
  });

  describe('user-friendly messages', () => {
    it('should provide appropriate error messages', () => {
      expect(service.getUserFriendlyErrorMessage()).toBe('');
      
      service.reportApiError('API error');
      expect(service.getUserFriendlyErrorMessage()).toContain('Unable to fetch panel status data');
      
      service.reportStorageError('Storage error');
      expect(service.getUserFriendlyErrorMessage()).toContain('Unable to load 3D model files');
    });

    it('should provide recovery status information', () => {
      const status = service.getRecoveryStatus();
      expect(status.isRecovering).toBe(false);
      expect(status.hasApiError).toBe(false);
      expect(status.hasStorageError).toBe(false);
      
      service.reportApiError('API error');
      const statusWithError = service.getRecoveryStatus();
      expect(statusWithError.hasApiError).toBe(true);
      expect(statusWithError.message).toContain('Unable to fetch panel status data');
    });
  });

  describe('recovery control', () => {
    it('should stop recovery when requested', () => {
      service.reportApiError('API error');
      expect(service.getErrorState().isRecovering).toBe(true);
      
      service.stopRecovery();
      expect(service.getErrorState().isRecovering).toBe(false);
      expect(service.getErrorState().recoveryAttempts).toBe(0);
    });
  });
});