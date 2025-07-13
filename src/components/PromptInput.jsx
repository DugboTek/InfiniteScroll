import React, { useState } from 'react';
import './PromptInput.css';

const PromptInput = ({ onPromptSubmit, isExpanding = false, hasStarted = false }) => {
  const [userInput, setUserInput] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isExpanding) return;

    try {
      await onPromptSubmit(userInput.trim());
      setUserInput('');
    } catch (error) {
      console.error('Error submitting prompt:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const examples = [
    "enchanted fairy realm",
    "steampunk floating city", 
    "underwater crystal kingdom",
    "volcanic dragon empire",
    "alien jungle planet",
    "frozen magical palace"
  ];

  const handleExampleClick = (example) => {
    setUserInput(example);
  };

  // Don't show the input if the user has already started
  if (hasStarted) {
    return null;
  }

  return (
    <div className="dream-world-overlay">
      <div className="dream-world-container">
        <div className="dream-world-header">
          <h1 className="dream-world-title">
            Type your dream world
          </h1>
          <p className="dream-world-subtitle">
            Describe any world you can imagine, and we'll create an infinite aerial journey through it
          </p>
        </div>

        <form onSubmit={handleSubmit} className="dream-world-form">
          <div className="dream-input-container">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="A magical kingdom with floating castles..."
              className="dream-input"
              disabled={isExpanding}
              maxLength={200}
              autoFocus
            />
            <button 
              type="submit" 
              className={`dream-submit-btn ${isExpanding ? 'loading' : ''}`}
              disabled={!userInput.trim() || isExpanding}
            >
              {isExpanding ? (
                <>
                  <div className="spinner"></div>
                  Creating your world...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                    <path d="M2 2l7.586 7.586"/>
                    <circle cx="11" cy="11" r="8"/>
                  </svg>
                  Create World
                </>
              )}
            </button>
          </div>
        </form>

        <div className="dream-examples-section">
          <p className="examples-label">Try these dream worlds:</p>
          <div className="dream-examples-grid">
            {examples.map((example, index) => (
              <button
                key={index}
                type="button"
                className="dream-example-chip"
                onClick={() => handleExampleClick(example)}
                disabled={isExpanding}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="dream-features">
          <div className="feature">
            <div className="feature-icon"></div>
            <span>Seamless aerial exploration</span>
          </div>
          <div className="feature">
            <div className="feature-icon"></div>
            <span>AI-generated infinite worlds</span>
          </div>
          <div className="feature">
            <div className="feature-icon"></div>
            <span>Consistent perspective throughout</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptInput; 