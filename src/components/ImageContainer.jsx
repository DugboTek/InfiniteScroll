import React, { useState } from 'react';
import './ImageContainer.css';

const ImageContainer = ({ 
  src, 
  prompt, 
  isInitial = false, 
  debug = null,
  modelUsed = null,
  generationTime = null 
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const formatTime = (ms) => {
    if (!ms) return 'N/A';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  const getModelBadgeColor = (model) => {
    switch (model) {
      case 'flux-schnell': return '#22c55e';
      case 'flux-fill-pro': return '#3b82f6';
      case 'flux-schnell-lora': return '#f59e0b';
      case 'sdxl': return '#6b7280';
      default: return '#8b5cf6';
    }
  };

  return (
    <div className="image-container">
      {/* Image */}
      <img 
        src={src} 
        alt={prompt || "Generated image"} 
        onLoad={handleImageLoad}
        loading="lazy"
        className={imageLoaded ? 'loaded' : 'loading'}
      />
      
      {/* Prompt Overlay */}
      {prompt && showPrompt && (
        <div className="prompt-overlay">
          <div className="prompt-content">
            <div className="prompt-header">
              <span className="prompt-label">
                {isInitial ? '🎨 Initial Prompt' : '🔄 Evolved Prompt'}
              </span>
              <button 
                className="prompt-toggle"
                onClick={() => setShowPrompt(false)}
                title="Hide prompt"
              >
                ✕
              </button>
            </div>
            <div className="prompt-text">
              {prompt}
            </div>
            
            {/* Debug Information */}
            {debug && (
              <div className="debug-info">
                <div className="debug-item">
                  <span 
                    className="model-badge"
                    style={{ backgroundColor: getModelBadgeColor(debug.modelUsed) }}
                  >
                    {debug.modelUsed}
                  </span>
                  <span className="generation-time">
                    {formatTime(debug.generationTime)}
                  </span>
                  <span className="inference-steps">
                    {debug.inferenceSteps} steps
                  </span>
                  {debug.supportsOutpainting && (
                    <span className="outpainting-badge">🎨 Outpainting</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Show Prompt Button (when hidden) */}
      {prompt && !showPrompt && (
        <button 
          className="show-prompt-btn"
          onClick={() => setShowPrompt(true)}
          title="Show prompt"
        >
          💬
        </button>
      )}
      
      {/* Loading Indicator */}
      {!imageLoaded && (
        <div className="image-loading">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading image...</div>
        </div>
      )}
    </div>
  );
};

export default ImageContainer;
