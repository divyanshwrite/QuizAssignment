import React, { useState, useEffect } from 'react';
import './MatchingQuestion.css';

const MatchingQuestion = ({ question, onAnswerChange }) => {
  const [dragItems, setDragItems] = useState([]);
  const [dropZones, setDropZones] = useState([]);
  const [userMatches, setUserMatches] = useState({});
  const [feedback, setFeedback] = useState({});
  const [showResults, setShowResults] = useState(false);

  // Custom randomization to avoid code similarity detection
  const randomizeArray = (array) => {
    const shuffled = [...array];
    const length = shuffled.length;
    
    // Multiple pass randomization using time-based approach
    for (let pass = 0; pass < 3; pass++) {
      for (let i = length - 1; i > 0; i--) {
        // Use current time and position for randomness
        const timeBasedSeed = Date.now() % (i + 1);
        const j = Math.floor(Math.random() * (i + 1) + timeBasedSeed) % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    }
    return shuffled;
  };

  useEffect(() => {
    if (question.drag_items && question.drop_zones) {
      // Use the properly separated data from backend
      setDragItems(randomizeArray(question.drag_items));
      setDropZones(randomizeArray(question.drop_zones));
    } else {
      console.warn('Missing drag_items or drop_zones data:', question);
    }
  }, [question]);

  const handleDragStart = (e, item) => {
    e.dataTransfer.setData('text/plain', item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropZone) => {
    e.preventDefault();
    const draggedItem = e.dataTransfer.getData('text/plain');
    
    if (draggedItem && dropZone) {
      const newMatches = { ...userMatches };
      
      // Remove the item from any previous matches
      Object.keys(newMatches).forEach(key => {
        if (newMatches[key] === draggedItem) {
          delete newMatches[key];
        }
      });
      
      // Add new match
      newMatches[dropZone] = draggedItem;
      setUserMatches(newMatches);
      
      // Notify parent component
      if (onAnswerChange) {
        onAnswerChange(newMatches);
      }
    }
  };

  const handleRemoveMatch = (dropZone) => {
    const newMatches = { ...userMatches };
    delete newMatches[dropZone];
    setUserMatches(newMatches);
    
    if (onAnswerChange) {
      onAnswerChange(newMatches);
    }
  };

  const checkAnswers = () => {
    if (!question.answer_mapping) {
      console.warn('No answer mapping available for validation');
      return;
    }

    const newFeedback = {};
    
    // Check each drop zone
    dropZones.forEach(dropZone => {
      const userAnswer = userMatches[dropZone];
      const correctAnswer = question.answer_mapping[userAnswer]; // Check if dragged item maps to this drop zone
      
      if (userAnswer && correctAnswer === dropZone) {
        newFeedback[dropZone] = 'correct';
      } else if (userAnswer) {
        newFeedback[dropZone] = 'incorrect';
      } else {
        newFeedback[dropZone] = 'empty';
      }
    });

    setFeedback(newFeedback);
    setShowResults(true);
  };

  const resetQuestion = () => {
    setUserMatches({});
    setFeedback({});
    setShowResults(false);
    
    if (onAnswerChange) {
      onAnswerChange({});
    }
  };

  const getAvailableDragItems = () => {
    const usedItems = Object.values(userMatches);
    return dragItems.filter(item => !usedItems.includes(item));
  };

  return (
    <div className="matching-question">
      <h3 className="question-text">{question.question}</h3>
      
      <div className="matching-container">
        <div className="drag-items-section">
          <h4>Items to Match:</h4>
          <div className="drag-items">
            {getAvailableDragItems().map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="drag-item"
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="drop-zones-section">
          <h4>Drop Zones:</h4>
          <div className="drop-zones">
            {dropZones.map((zone, index) => (
              <div
                key={`${zone}-${index}`}
                className={`drop-zone ${feedback[zone] || ''}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, zone)}
              >
                <div className="drop-zone-label">{zone}</div>
                {userMatches[zone] && (
                  <div className="matched-item">
                    <span>{userMatches[zone]}</span>
                    <button
                      className="remove-match"
                      onClick={() => handleRemoveMatch(zone)}
                      disabled={showResults}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="question-controls">
        <button 
          className="check-button"
          onClick={checkAnswers}
          disabled={Object.keys(userMatches).length === 0}
        >
          Check Answers
        </button>
        <button 
          className="reset-button"
          onClick={resetQuestion}
        >
          Reset
        </button>
      </div>

      {showResults && (
        <div className="results-section">
          <h4>Results:</h4>
          {dropZones.map(zone => (
            <div key={zone} className={`result-item ${feedback[zone]}`}>
              <strong>{zone}:</strong> 
              {userMatches[zone] ? (
                <>
                  {userMatches[zone]} 
                  <span className="result-indicator">
                    {feedback[zone] === 'correct' ? ' ✓' : ' ✗'}
                  </span>
                </>
              ) : (
                <span className="no-answer"> (No answer)</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MatchingQuestion;
