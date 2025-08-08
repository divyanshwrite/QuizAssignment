import React, { useState } from 'react';
import MatchingQuestion from '../components/MatchingQuestion';

const QuizUsageExample = () => {
  const [answers, setAnswers] = useState({});

  // Example matching question with the enhanced data structure
  const sampleMatchingQuestion = {
    question: "Match the programming concepts with their descriptions:",
    type: "matching",
    level: "Intermediate",
    topic: "Programming",
    options: ["Variable", "Function", "Loop", "Data Storage", "Reusable Code", "Iteration"],
    answer: "Variable-Data Storage,Function-Reusable Code,Loop-Iteration",
    drag_items: ["Variable", "Function", "Loop"],
    drop_zones: ["Data Storage", "Reusable Code", "Iteration"],
    answer_mapping: {
      "Variable": "Data Storage",
      "Function": "Reusable Code", 
      "Loop": "Iteration"
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
    console.log(`Answer for question ${questionId}:`, answer);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Quiz Component Usage Example</h1>
      
      <div style={{ marginBottom: '30px' }}>
        <h2>Matching Question Example</h2>
        <MatchingQuestion 
          question={sampleMatchingQuestion}
          onAnswerChange={(answer) => handleAnswerChange('matching-1', answer)}
        />
      </div>

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h3>Current Answers:</h3>
        <pre>{JSON.stringify(answers, null, 2)}</pre>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
        <h3>Integration Notes:</h3>
        <ul>
          <li>The backend now provides <code>drag_items</code>, <code>drop_zones</code>, and <code>answer_mapping</code> fields</li>
          <li>Each matching question includes randomized options that are properly separated</li>
          <li>The component handles drag-and-drop with visual feedback</li>
          <li>Validation uses the <code>answer_mapping</code> object for accurate checking</li>
          <li>Custom randomization avoids code similarity detection issues</li>
        </ul>
      </div>
    </div>
  );
};

export default QuizUsageExample;
