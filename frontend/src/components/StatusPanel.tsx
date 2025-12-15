import { useEffect, useState } from 'react';
import { StatusPanelProps } from '../types/index.js';
import { errorRecoveryService } from '../services/errorRecoveryService.js';

const StatusPanel = ({ 
  panelData, 
  loading, 
  error, 
  selectedProject, 
  onProjectChange, 
  onRefresh,
  selectedPanel,
  onClosePanel,
  retryInfo,
  performanceStats
}: StatusPanelProps) => {
  const [recoveryStatus, setRecoveryStatus] = useState(errorRecoveryService.getRecoveryStatus());

  // Update recovery status when error recovery service state changes
  useEffect(() => {
    const updateRecoveryStatus = () => {
      setRecoveryStatus(errorRecoveryService.getRecoveryStatus());
    };

    // Set up callbacks for error recovery events
    errorRecoveryService.setCallbacks({
      onRecoveryStart: updateRecoveryStatus,
      onRecoverySuccess: updateRecoveryStatus,
      onRecoveryFailed: updateRecoveryStatus,
      onFullRecovery: updateRecoveryStatus
    });

    // Update status periodically while recovery is active
    const interval = setInterval(() => {
      if (recoveryStatus.isRecovering) {
        updateRecoveryStatus();
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [recoveryStatus.isRecovering]);
  const statusCounts = panelData.reduce((acc: Record<string, number>, panel) => {
    acc[panel.status] = (acc[panel.status] || 0) + 1
    return acc
  }, {})

  const statusColors: Record<string, string> = {
    'INSTALLED': '#00ff00',
    'PENDING': '#ffff00',
    'ISSUE': '#ff0000',
    'NOT_STARTED': '#808080'
  }

  // Format date for display
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return 'Not set'
    if (typeof date === 'string') {
      return new Date(date).toLocaleDateString()
    }
    return date.toLocaleDateString()
  }

  return (
    <>
      {/* Main Status Dashboard */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.8)',
        padding: '20px',
        borderRadius: '8px',
        minWidth: '250px',
        color: 'white',
        fontFamily: 'monospace'
      }}>
        <h3 style={{ margin: '0 0 15px 0' }}>Panel Status Dashboard</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label>Project: </label>
          <select 
            value={selectedProject}
            onChange={(e) => onProjectChange(e.target.value)}
            style={{
              background: '#333',
              color: 'white',
              border: '1px solid #555',
              padding: '5px',
              marginLeft: '10px'
            }}
          >
            <option value="BuildingA">Building A</option>
            <option value="BuildingB">Building B</option>
            <option value="ResidentialComplex">Residential Complex</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button 
            onClick={onRefresh}
            disabled={loading}
            style={{
              background: '#0066cc',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>

          {recoveryStatus.isRecovering && (
            <button 
              onClick={() => errorRecoveryService.forceRecovery()}
              style={{
                background: '#ff8800',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Retry Now
            </button>
          )}
        </div>

        {/* Enhanced Error Display */}
        {(error || recoveryStatus.message) && (
          <div style={{ 
            marginBottom: '15px',
            padding: '12px',
            borderRadius: '6px',
            background: 'rgba(255, 102, 102, 0.1)',
            border: '1px solid rgba(255, 102, 102, 0.3)'
          }}>
            {/* Primary error message */}
            {error && (
              <div style={{ color: '#ff6666', marginBottom: '8px' }}>
                <strong>⚠️ Connection Issue:</strong> {error}
              </div>
            )}

            {/* Recovery status message */}
            {recoveryStatus.message && (
              <div style={{ 
                color: recoveryStatus.isRecovering ? '#ffaa66' : '#ff6666',
                fontSize: '12px',
                marginBottom: '8px'
              }}>
                {recoveryStatus.message}
              </div>
            )}

            {/* Detailed retry information */}
            {retryInfo?.isRetrying && (
              <div style={{ fontSize: '11px', color: '#ffaa66' }}>
                Polling retry: Attempt {retryInfo.retryCount}, next in {Math.round(retryInfo.nextRetryDelay / 1000)}s
              </div>
            )}

            {/* Recovery progress */}
            {recoveryStatus.isRecovering && (
              <div style={{ fontSize: '11px', color: '#ffaa66', marginTop: '4px' }}>
                Recovery progress: {recoveryStatus.attempts}/{recoveryStatus.maxAttempts} attempts
                {recoveryStatus.hasApiError && ' • API: ❌'}
                {recoveryStatus.hasStorageError && ' • Storage: ❌'}
              </div>
            )}

            {/* Fallback mode indicator */}
            {(recoveryStatus.hasApiError || recoveryStatus.hasStorageError) && (
              <div style={{ 
                fontSize: '11px', 
                color: '#66ccff', 
                marginTop: '8px',
                padding: '4px 8px',
                background: 'rgba(102, 204, 255, 0.1)',
                borderRadius: '3px'
              }}>
                ℹ️ Running in fallback mode - {recoveryStatus.hasApiError ? 'using default panel colors' : ''} 
                {recoveryStatus.hasApiError && recoveryStatus.hasStorageError ? ' and ' : ''}
                {recoveryStatus.hasStorageError ? 'showing simplified 3D model' : ''}
              </div>
            )}
          </div>
        )}

        {/* Success recovery notification */}
        {!error && !recoveryStatus.isRecovering && !recoveryStatus.hasApiError && !recoveryStatus.hasStorageError && panelData.length > 0 && (
          <div style={{ 
            marginBottom: '15px',
            padding: '8px',
            borderRadius: '4px',
            background: 'rgba(102, 255, 102, 0.1)',
            border: '1px solid rgba(102, 255, 102, 0.3)',
            fontSize: '12px',
            color: '#66ff66'
          }}>
            ✅ All systems operational
          </div>
        )}

        <div>
          <h4 style={{ margin: '0 0 10px 0' }}>Status Summary:</h4>
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: '5px' 
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                backgroundColor: statusColors[status] || '#888',
                marginRight: '8px',
                borderRadius: '2px'
              }} />
              <span>{status}: {count}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '15px', fontSize: '12px', opacity: 0.7 }}>
          Total Panels: {panelData.length}
        </div>

        {/* Performance Indicator */}
        {performanceStats && (
          <div style={{ 
            marginTop: '15px',
            padding: '8px',
            borderRadius: '4px',
            background: performanceStats.status === 'good' ? 'rgba(102, 255, 102, 0.1)' :
                        performanceStats.status === 'warning' ? 'rgba(255, 204, 102, 0.1)' :
                        'rgba(255, 102, 102, 0.1)',
            border: `1px solid ${performanceStats.status === 'good' ? 'rgba(102, 255, 102, 0.3)' :
                                 performanceStats.status === 'warning' ? 'rgba(255, 204, 102, 0.3)' :
                                 'rgba(255, 102, 102, 0.3)'}`
          }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: 'bold',
              color: performanceStats.status === 'good' ? '#66ff66' :
                     performanceStats.status === 'warning' ? '#ffcc66' : '#ff6666',
              marginBottom: '4px'
            }}>
              Performance: {performanceStats.status.toUpperCase()}
            </div>
            {performanceStats.metrics && (
              <div style={{ fontSize: '10px', opacity: 0.8 }}>
                FPS: {performanceStats.metrics.renderingStats.fps} | 
                Memory: {performanceStats.metrics.memoryUsage.totalMB}MB
              </div>
            )}
            {performanceStats.issues.length > 0 && (
              <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                Issues: {performanceStats.issues.join(', ')}
              </div>
            )}
          </div>
        )}

        {selectedPanel && (
          <div style={{ marginTop: '15px', fontSize: '12px', opacity: 0.7 }}>
            Click outside panels to clear selection
          </div>
        )}
      </div>

      {/* Selected Panel Details */}
      {selectedPanel && (
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.9)',
          padding: '20px',
          borderRadius: '8px',
          minWidth: '280px',
          color: 'white',
          fontFamily: 'monospace',
          border: '2px solid #0066cc'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <h3 style={{ margin: 0 }}>Panel Details</h3>
            <button
              onClick={onClosePanel}
              style={{
                background: 'transparent',
                color: '#ccc',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0 5px'
              }}
            >
              ×
            </button>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <strong>Panel ID:</strong> {selectedPanel.id}
          </div>

          {!selectedPanel.status && (
            <div style={{ 
              marginBottom: '15px',
              padding: '8px',
              background: 'rgba(255, 153, 153, 0.2)',
              borderRadius: '4px',
              border: '1px solid rgba(255, 153, 153, 0.5)',
              fontSize: '12px',
              color: '#ff9999'
            }}>
              ⚠️ No status data available for this panel
            </div>
          )}

          <div style={{ marginBottom: '10px' }}>
            <strong>Status:</strong>{' '}
            {selectedPanel.status ? (
              <span style={{ 
                color: statusColors[selectedPanel.status] || '#888',
                fontWeight: 'bold'
              }}>
                {selectedPanel.status}
              </span>
            ) : (
              <span style={{ color: '#ff9999', fontStyle: 'italic' }}>
                No status data available
              </span>
            )}
          </div>

          <div style={{ marginBottom: '10px' }}>
            <strong>Install Date:</strong>{' '}
            {selectedPanel.installDate ? (
              formatDate(selectedPanel.installDate)
            ) : (
              <span style={{ color: '#ccc', fontStyle: 'italic' }}>
                Not available
              </span>
            )}
          </div>

          <div style={{ marginBottom: '10px' }}>
            <strong>Notes:</strong>
            <div style={{ 
              marginTop: '5px',
              padding: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              fontSize: '12px',
              minHeight: '20px'
            }}>
              {selectedPanel.notes || (
                <span style={{ color: '#ccc', fontStyle: 'italic' }}>
                  No notes available
                </span>
              )}
            </div>
          </div>

          {selectedPanel.lastUpdated && (
            <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '10px' }}>
              Last updated: {formatDate(selectedPanel.lastUpdated)}
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default StatusPanel