import React, { useState, useEffect } from 'react';
import { 
  fetchAvailableModels, 
  getCurrentModel, 
  setCurrentModel, 
  getCurrentPrompt,
  getDebugMode,
  setDebugMode,
  clearState,
  checkHealth
} from '../services/api';
import './DebugOverlay.css';

const DebugOverlay = ({ 
  onModelChange, 
  lastImageData = null, 
  onRefresh = null,
  isVisible = true 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(getCurrentModel());
  const [currentPrompt, setCurrentPromptDisplay] = useState(getCurrentPrompt());
  const [evolvedPrompt, setEvolvedPrompt] = useState('');
  const [isEvolvingPrompt, setIsEvolvingPrompt] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(getDebugMode());
  const [isLoading, setIsLoading] = useState(false);

  // Load available models on component mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        const modelData = await fetchAvailableModels();
        setModels(modelData.models || []);
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };
    loadModels();
  }, []);

  // Update prompt display when it changes
  useEffect(() => {
    setCurrentPromptDisplay(getCurrentPrompt());
  }, [lastImageData]);

  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
    setCurrentModel(modelId);
    if (onModelChange) {
      onModelChange(modelId);
    }
  };

  const handleDebugToggle = (enabled) => {
    setDebugEnabled(enabled);
    setDebugMode(enabled);
  };

  const handleEvolvePrompt = async () => {
    if (!currentPrompt) return;
    
    setIsEvolvingPrompt(true);
    try {
      const evolved = await evolvePrompt(currentPrompt);
      setEvolvedPrompt(evolved);
    } catch (error) {
      console.error('Failed to evolve prompt:', error);
    }
    setIsEvolvingPrompt(false);
  };

  const handleRefresh = () => {
    if (onRefresh) {
      setIsLoading(true);
      onRefresh().finally(() => setIsLoading(false));
    }
  };

  const handleClearState = () => {
    clearState();
    setCurrentPromptDisplay('');
    setEvolvedPrompt('');
    setSelectedModel('flux-fill-pro');
    // Note: This will clear API state but won't reset the App component's initial load protection
    // A full page refresh would be needed to completely reset the initial load flag
  };

  const formatTime = (ms) => {
    if (!ms) return 'N/A';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  const getModelBadgeColor = (modelId) => {
    switch (modelId) {
      case 'flux-schnell': return '#22c55e'; // Green for speed
      case 'flux-fill-pro': return '#3b82f6'; // Blue for outpainting
      case 'flux-schnell-lora': return '#f59e0b'; // Orange for balanced
      case 'sdxl': return '#6b7280'; // Gray for fallback
      default: return '#8b5cf6'; // Purple for unknown
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`debug-overlay ${isOpen ? 'open' : 'closed'}`}>
      {/* Toggle Button */}
      <button 
        className="debug-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle Debug Overlay"
      >
        {isOpen ? '✕' : '🛠️'}
      </button>

      {/* Main Panel */}
      {isOpen && (
        <div className="debug-panel">
          <div className="debug-header">
            <h3>🚀 Debug Panel</h3>
            <div className="debug-actions">
              <button 
                onClick={handleRefresh}
                disabled={isLoading}
                className="action-btn refresh-btn"
                title="Generate new image"
              >
                {isLoading ? '⏳' : '🔄'}
              </button>
              <button 
                onClick={handleClearState}
                className="action-btn clear-btn"
                title="Clear state"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div className="debug-section">
            <h4>Model Selection</h4>
            <div className="model-grid">
              {models.map((model) => (
                <button
                  key={model.id}
                  className={`model-btn ${selectedModel === model.id ? 'active' : ''}`}
                  onClick={() => handleModelChange(model.id)}
                  style={{
                    borderColor: getModelBadgeColor(model.id),
                    backgroundColor: selectedModel === model.id ? getModelBadgeColor(model.id) : 'transparent'
                  }}
                >
                  <div className="model-name">{model.name}</div>
                  <div className="model-use-case">{model.config?.use_case || 'unknown'}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Debug Mode Toggle */}
          <div className="debug-section">
            <label className="debug-toggle-label">
              <input
                type="checkbox"
                checked={debugEnabled}
                onChange={(e) => handleDebugToggle(e.target.checked)}
              />
              Enable Debug Mode
            </label>
          </div>

          {/* Current Prompt */}
          <div className="debug-section">
            <h4>Current Prompt</h4>
            <div className="prompt-display">
              <div className="prompt-text">
                {currentPrompt || 'No prompt yet'}
              </div>
              <button 
                onClick={handleEvolvePrompt}
                disabled={!currentPrompt || isEvolvingPrompt}
                className="evolve-btn"
                title="Evolve current prompt"
              >
                {isEvolvingPrompt ? '⏳' : '🔄'} Evolve
              </button>
            </div>
            
            {evolvedPrompt && (
              <div className="evolved-prompt">
                <h5>Next Prompt Preview:</h5>
                <div className="prompt-text evolved">
                  {evolvedPrompt}
                </div>
              </div>
            )}
          </div>

          {/* Performance Metrics */}
          {lastImageData?.debug && (
            <div className="debug-section">
              <h4>Performance Metrics</h4>
              <div className="metrics-grid">
                <div className="metric">
                  <span className="metric-label">Generation Time:</span>
                  <span className="metric-value">
                    {formatTime(lastImageData.debug.generationTime)}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Model Used:</span>
                  <span 
                    className="metric-value model-badge"
                    style={{ backgroundColor: getModelBadgeColor(lastImageData.debug.modelUsed) }}
                  >
                    {lastImageData.debug.modelUsed}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Inference Steps:</span>
                  <span className="metric-value">
                    {lastImageData.debug.inferenceSteps}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Outpainting:</span>
                  <span className="metric-value">
                    {lastImageData.debug.supportsOutpainting ? '✅' : '❌'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Image Metadata */}
          {lastImageData && (
            <div className="debug-section">
              <h4>Image Metadata</h4>
              <div className="metadata-grid">
                <div className="metadata-item">
                  <span>Dimensions:</span>
                  <span>{lastImageData.width}x{lastImageData.height}</span>
                </div>
                <div className="metadata-item">
                  <span>Generated:</span>
                  <span>{new Date(lastImageData.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="metadata-item">
                  <span>Type:</span>
                  <span>{lastImageData.isInitial ? 'Initial' : 'Outpainted'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DebugOverlay; 