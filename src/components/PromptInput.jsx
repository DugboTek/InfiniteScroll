import React, { useState, useRef, useEffect } from 'react';
import './PromptInput.css';

const PromptInput = ({ onPromptSubmit, isExpanding = false, currentPrompt = '' }) => {
  const [userInput, setUserInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false); // New state for scroll
  const inputRef = useRef(null);
  const lastScrollY = useRef(0); // Ref to track scroll direction

  // Effect to handle scroll detection based on direction
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Determine scroll direction
      if (currentScrollY > lastScrollY.current && currentScrollY > 30) {
        // Scrolling Down
        setIsScrolled(true);
        // Collapse the input if it's open but empty
        if (isExpanded && !userInput.trim()) {
          setIsExpanded(false);
        }
      } else {
        // Scrolling Up
        setIsScrolled(false);
      }
      
      // Update the last scroll position
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isExpanded, userInput]); // Re-run if these states change


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isExpanding) return;

    try {
      await onPromptSubmit(userInput.trim());
      setUserInput('');
      setIsExpanded(false); // Collapse after submission
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

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const handleBlur = (e) => {
    // Only collapse if input is empty and we're not clicking on an example button
    // Use setTimeout to allow example clicks to be processed first
    setTimeout(() => {
      if (!userInput.trim() && document.activeElement !== inputRef.current) {
        setIsExpanded(false);
      }
    }, 150);
  };

  const examples = [
    "futuristic space station",
    "steampunk floating city", 
    "underwater crystal cave",
    "volcanic dragon lair",
    "alien jungle landscape",
    "frozen arctic outpost"
  ];

  const handleExampleClick = (example) => {
    console.log('Example clicked:', example);
    setUserInput(example);
    setIsExpanded(true);
    // Focus the input after setting the value
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  };

  const containerClasses = [
    'floating-prompt-container',
    isExpanded ? 'expanded' : '',
    isScrolled ? 'scrolled' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      <div className="current-world-info" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="world-info-text">
          <span className="current-world-label">Current scene:</span>
          <span className="current-world-text">{currentPrompt || "Tap here to begin a new journey..."}</span>
        </div>
        <span className={`collapse-icon ${isExpanded ? 'open' : ''}`}>▶</span>
      </div>
      
      <div className="collapsible-content">
        <form onSubmit={handleSubmit} className="floating-prompt-form">
          <div className="floating-input-container">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Describe a scene to explore..."
              className="floating-input"
              disabled={isExpanding}
              maxLength={200}
            />
            <button 
              type="submit" 
              className={`floating-submit-btn ${isExpanding ? 'loading' : ''}`}
              disabled={!userInput.trim() || isExpanding}
            >
              {isExpanding ? (
                <>
                  <div className="spinner"></div>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                    <path d="M2 2l7.586 7.586"/>
                    <circle cx="11" cy="11" r="8"/>
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Show examples when expanded */}
        {isExpanded && (
          <div className="floating-examples-section">
            <p className="floating-examples-label">Quick examples:</p>
            <div className="floating-examples-grid">
              {examples.map((example, index) => (
                <button
                  key={index}
                  type="button"
                  className="floating-example-chip"
                  onClick={() => handleExampleClick(example)}
                  onMouseDown={(e) => e.preventDefault()} // Prevent input blur on click
                  disabled={isExpanding}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptInput; 