import React from 'react';
import './ImageContainer.css';

const ImageContainer = ({ src, prompt, isInitial }) => {
  return (
    <div className="image-container">
      <img 
        src={src} 
        alt="AI-generated visual story segment" 
        loading="lazy"
        onError={(e) => {
          console.error('Image failed to load:', src);
          e.target.src = `https://picsum.photos/seed/${Math.random()}/1920/1080`;
        }}
      />
      {/* Optional: Show prompt for debugging - can be removed in production */}
      {process.env.NODE_ENV === 'development' && prompt && (
        <div className="prompt-overlay">
          <span className="prompt-text">{isInitial ? '🎬 ' : '📖 '}{prompt}</span>
        </div>
      )}
    </div>
  );
};

export default ImageContainer;
