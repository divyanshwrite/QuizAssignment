import { useState, useEffect } from 'react';
import './App.css';
import { API_BASE_URL } from './config.js';

function App() {
  const [file, setFile] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [showSavedQuizzes, setShowSavedQuizzes] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [questionTimes, setQuestionTimes] = useState([]);
  const [matchingAnswers, setMatchingAnswers] = useState({});
  const [draggedItem, setDraggedItem] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [gameMode, setGameMode] = useState('quiz');
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    let interval = null;
    if (isTimerActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(time => time - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isTimerActive) {
      handleNextQuestion();
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timeRemaining]);

  useEffect(() => {
    if (quiz && quiz.length > 0) {
      setTimeRemaining(30);
      setIsTimerActive(true);
      setQuestionStartTime(Date.now());
    }
  }, [quiz, currentQuestion]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && (selectedFile.type === 'application/pdf' || 
                         selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please upload a valid PDF or DOCX file');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file first');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size should be less than 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsSubmitting(true);
      setError('');
      
      const response = await fetch(`${API_BASE_URL}/api/generate-quiz`, {
        method: 'POST',
        body: formData,
        mode: 'cors',
      });

      const data = await response.json();
      
      if (!response.ok) {
        let errorMessage = data.detail || 'Failed to generate quiz';
        
        if (response.status === 429) {
          errorMessage = '⏱️ Rate limit exceeded! The free AI model allows only 1 quiz per minute. Please wait and try again.';
        } else if (errorMessage.includes('Rate limit exceeded')) {
          errorMessage = '⏱️ Too many requests! Please wait 60 seconds before generating another quiz.';
        } else if (errorMessage.includes('malformed content')) {
          errorMessage = '🤖 AI generated invalid content. Please try again in a minute with a different file.';
        }
        
        throw new Error(errorMessage);
      }

      // Validate the quiz data structure
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid quiz data received from server');
      }

      // Additional validation for each question
      const isValidQuiz = data.every(question => 
        question.question && 
        Array.isArray(question.options) && 
        question.options.length > 0 &&
        question.answer &&
        question.type &&
        question.level &&
        question.topic
      );

      if (!isValidQuiz) {
        throw new Error('Invalid quiz format received from server');
      }

      setQuiz(data);
      setCurrentQuestion(0);
      setScore(0);
      setIsFlipped(false);
    } catch (err) {
      console.error('Error generating quiz:', err);
      
      // More specific error messages based on error type
      let errorMessage = 'Error generating quiz. Please try again.';
      
      if (err.message.includes('Failed to parse JSON')) {
        errorMessage = 'Error processing the document. The content might not be in a supported format.';
      } else if (err.message.includes('Invalid quiz data') || err.message.includes('Invalid quiz format')) {
        errorMessage = 'The quiz could not be generated from this document. Please try a different file.';
      } else if (err.message) {
        // Use the error message from the backend if available
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOptionSelect = (optionIndex) => {
    setSelectedOption(optionIndex);
  };

  const handleNextQuestion = () => {
    // Record time taken for this question
    const timeSpent = questionStartTime ? (Date.now() - questionStartTime) / 1000 : 30;
    setQuestionTimes(prev => [...prev, Math.round(timeSpent)]);

    // Check if answer is correct
    if (selectedOption !== null || (currentQ.type === 'matching' && Object.keys(matchingAnswers).length > 0)) {
      const currentQ = quiz[currentQuestion];
      let isCorrect = false;
      
      if (currentQ.type === 'matching') {
        // Get the correct answer format (e.g., "Name1-Role1,Name2-Role2")
        const correctAnswer = currentQ.answer.trim();
        
        // Convert user's answers to a normalized format
        const userAnswer = Object.entries(matchingAnswers)
          .map(([key, value]) => {
            // Get the actual item text instead of just the index
            const itemIndex = parseInt(key) - 1;
            const itemText = currentQ.options[itemIndex]?.split('|')[0]?.trim() || key;
            return `${itemText}-${value}`.toLowerCase();
          })
          .sort()
          .join(',');
          
        // Normalize the correct answer format
        const normalizedCorrect = correctAnswer
          .split(',')
          .map(pair => {
            // Handle both formats: "Name-Role" and "Name-Name-Role"
            const parts = pair.trim().split('-').map(p => p.trim());
            if (parts.length >= 2) {
              // If we have duplicate names (Name-Name-Role), just take first and last part
              const name = parts[0];
              const role = parts[parts.length - 1];
              return `${name}-${role}`.toLowerCase();
            }
            return '';
          })
          .filter(Boolean) // Remove any empty strings
          .sort()
          .join(',');
          
        // Compare the sorted, normalized strings
        isCorrect = userAnswer === normalizedCorrect;
        
        console.log('Matching validation:', {
          correctAnswer: correctAnswer,
          normalizedCorrect: normalizedCorrect,
          userAnswer: userAnswer,
          isCorrect: isCorrect,
          matchingAnswers: matchingAnswers
        });
      } else {
        // Case-insensitive answer matching
        const userAnswer = currentQ.options[selectedOption];
        const correctAnswer = currentQ.answer;
        isCorrect = userAnswer?.trim().toLowerCase() === correctAnswer?.trim().toLowerCase();
      }
      
      if (isCorrect) {
        setScore(score + 1);
      }
    }

    // Move to next question or show results
    if (currentQuestion < quiz.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedOption(null);
      setMatchingAnswers({});
      setTimeRemaining(30);
      setQuestionStartTime(Date.now());
    } else {
      // Quiz finished
      setIsTimerActive(false);
    }
  };

  const resetQuiz = () => {
    setQuiz(null);
    setFile(null);
    setCurrentQuestion(0);
    setScore(0);
    setSelectedOption(null);
    setTimeRemaining(30);
    setIsTimerActive(false);
    setQuestionTimes([]);
    setQuestionStartTime(null);
    setMatchingAnswers({});
    setIsFlipped(false);
    setHasSubmitted(false);
    setPlayerName('');
  };

  const fetchSavedQuizzes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/saved-quizzes`);
      const data = await response.json();
      setSavedQuizzes(data.saved_quizzes || []);
    } catch (err) {
      console.error('Error fetching saved quizzes:', err);
    }
  };

  const exportQuizAsMarkdown = async (filename) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/quiz/${filename}/markdown`);
      if (!response.ok) {
        throw new Error('Failed to export quiz');
      }
      
      const markdownContent = await response.text();
      
      // Create a blob and download with DD_MM format
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const exportFilename = `QUIZ_EXPORTED_${day}_${month}.md`;
      
      const blob = new Blob([markdownContent], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting quiz:', err);
      setError('Error exporting quiz as Markdown');
    }
  };

  const loadSavedQuiz = async (filename) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/quiz/${filename}`);
      const data = await response.json();
      
      // Convert the saved quiz format to the format expected by the frontend
      const questions = data.questions.map(q => ({
        question: q.question,
        options: q.options,
        answer: q.answer,
        type: q.type,
        level: q.level,
        topic: q.topic
      }));
      
      setQuiz(questions);
      setCurrentQuestion(0);
      setScore(0);
      setSelectedOption(null);
      setShowSavedQuizzes(false);
      setTimeRemaining(30);
      setIsTimerActive(true);
      setQuestionTimes([]);
      setQuestionStartTime(Date.now());
      setMatchingAnswers({});
    } catch (err) {
      console.error('Error loading saved quiz:', err);
      setError('Error loading saved quiz');
    }
  };

  const generateAndExportMarkdown = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file first');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size should be less than 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsSubmitting(true);
      setError('');
      
      const response = await fetch(`${API_BASE_URL}/api/generate-quiz/markdown`, {
        method: 'POST',
        body: formData,
        mode: 'cors',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate quiz');
      }

      const markdownContent = await response.text();
      
      // Create a blob and download
      const blob = new Blob([markdownContent], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quiz_${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error generating markdown quiz:', err);
      setError(err.message || 'Error generating quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Drag and drop functions for matching questions
  const handleDragStart = (e, item, index) => {
    setDraggedItem({ item, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // Required for some browsers
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Add visual feedback for drag over
    e.currentTarget.classList.add('ring-2', 'ring-blue-400', 'ring-opacity-50');
  };

  const handleDragLeave = (e) => {
    // Remove visual feedback when drag leaves
    e.currentTarget.classList.remove('ring-2', 'ring-blue-400', 'ring-opacity-50');
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    // Remove visual feedback
    e.currentTarget.classList.remove('ring-2', 'ring-blue-400', 'ring-opacity-50');
    
    if (draggedItem) {
      const newMatches = { ...matchingAnswers };
      const itemNumber = draggedItem.index + 1;
      const targetLetter = String.fromCharCode(65 + targetIndex); // A, B, C, D
      
      // Remove any existing match for this item
      Object.keys(newMatches).forEach(key => {
        if (parseInt(key) === itemNumber) {
          delete newMatches[key];
        }
      });
      
      // Remove any existing match for this target letter
      Object.keys(newMatches).forEach(key => {
        if (newMatches[key] === targetLetter) {
          delete newMatches[key];
        }
      });
      
      // Add new match
      newMatches[itemNumber] = targetLetter;
      setMatchingAnswers(newMatches);
      setDraggedItem(null);
    }
  };

  const removeMatch = (itemIndex) => {
    const newMatches = { ...matchingAnswers };
    delete newMatches[itemIndex];
    setMatchingAnswers(newMatches);
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/leaderboard`);
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    }
  };

  const showToastNotification = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const submitScore = async (score, totalQuestions, timeTaken, topics) => {
    // Check if name is provided
    if (!playerName.trim()) {
      showToastNotification('Name is required to submit score!');
      return;
    }
    
    // Check if already submitted
    if (hasSubmitted) {
      showToastNotification('Score already submitted for this test!');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/leaderboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_name: playerName.trim(),
          score: score,
          total_questions: totalQuestions,
          time_taken: timeTaken,
          quiz_topic: topics.join(', '),
          completion_date: new Date().toISOString()
        }),
      });

      if (response.ok) {
        setHasSubmitted(true);
        showToastNotification('Test submitted successfully!');
        await fetchLeaderboard(); // Refresh leaderboard
      } else {
        showToastNotification('Failed to submit score. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting score:', err);
      showToastNotification('Error submitting score. Please try again.');
    }
  };

  // Flashcard specific functions
  const nextCard = () => {
    if (currentQuestion < quiz.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setIsFlipped(false);
    }
  };

  const prevCard = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setIsFlipped(false);
    }
  };

  const flipCard = () => {
    setIsFlipped(!isFlipped);
  };

  if (!quiz) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col">
        <div className="w-full flex-1 py-8 flex flex-col">
          {/* Header Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-6 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Regulatory Quiz Generator
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Transform your regulatory documents into interactive quizzes and flashcards for enhanced learning
            </p>
          </div>
          
          {/* Main Card */}
          <div className="bg-white/90 backdrop-blur-sm shadow-2xl rounded-2xl border border-white/20 overflow-hidden min-h-[calc(100vh-4rem)] flex flex-col">
            {/* Navigation Tabs */}
            <div className="bg-white border-b border-gray-200">
              <div className="flex justify-center">
                <div className="inline-flex bg-gray-100 rounded-lg p-1 m-6">
                  <button
                    onClick={() => {
                      setShowSavedQuizzes(false);
                      setShowLeaderboard(false);
                    }}
                    className={`px-6 py-3 rounded-md font-medium text-sm transition-all duration-200 flex items-center space-x-2 ${
                      !showSavedQuizzes && !showLeaderboard 
                        ? 'bg-blue-600 text-white shadow-md transform scale-105' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Generate New Quiz</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowSavedQuizzes(true);
                      setShowLeaderboard(false);
                      fetchSavedQuizzes();
                    }}
                    className={`px-6 py-3 rounded-md font-medium text-sm transition-all duration-200 flex items-center space-x-2 ${
                      showSavedQuizzes && !showLeaderboard 
                        ? 'bg-blue-600 text-white shadow-md transform scale-105' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>Saved Quizzes</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowLeaderboard(true);
                      setShowSavedQuizzes(false);
                      fetchLeaderboard();
                    }}
                    className={`px-6 py-3 rounded-md font-medium text-sm transition-all duration-200 flex items-center space-x-2 ${
                      showLeaderboard 
                        ? 'bg-blue-600 text-white shadow-md transform scale-105' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <span>Leaderboard</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-8 sm:p-12">
              {/* Game Mode Selection */}
              {!showLeaderboard && !showSavedQuizzes && (
                <div className="mb-8 text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Learning Style</h3>
                  <div className="inline-flex bg-gray-100 rounded-xl p-1">
                    <button
                      onClick={() => setGameMode('quiz')}
                      className={`px-8 py-4 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2 ${
                        gameMode === 'quiz' 
                          ? 'bg-blue-600 text-white shadow-lg transform scale-105' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Interactive Quiz</span>
                    </button>
                    <button
                      onClick={() => setGameMode('flashcards')}
                      className={`px-8 py-4 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2 ${
                        gameMode === 'flashcards' 
                          ? 'bg-purple-600 text-white shadow-lg transform scale-105' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span>Flashcards</span>
                    </button>
                  </div>
                </div>
              )}

            {showLeaderboard ? (
              /* Leaderboard View */
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full mb-6 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-8">Leaderboard Champions</h3>
                {leaderboard.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 text-lg">No scores recorded yet.</p>
                    <p className="text-gray-500">Be the first to complete a quiz!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {leaderboard.map((entry, index) => (
                      <div key={index} className={`relative overflow-hidden rounded-xl p-6 transition-all duration-300 hover:scale-105 ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 shadow-lg' :
                        index === 1 ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-300 shadow-md' :
                        index === 2 ? 'bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 shadow-md' :
                        'bg-white border border-gray-200 hover:border-blue-300 shadow-sm'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg relative shadow-lg ${
                              index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                              index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                              index === 2 ? 'bg-gradient-to-r from-orange-400 to-red-500' :
                              'bg-gradient-to-r from-blue-400 to-blue-600'
                            }`}>
                              {index < 3 ? (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                              ) : (
                                index + 1
                              )}
                            </div>
                            <div className="text-left">
                              <h4 className="font-bold text-gray-900 text-lg">{entry.player_name}</h4>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">{entry.score}/{entry.total_questions}</span> questions • 
                                <span className="font-bold text-blue-600 ml-1">{entry.percentage}%</span> • 
                                <span className="ml-1">{Math.floor(entry.time_taken / 60)}:{(entry.time_taken % 60).toString().padStart(2, '0')}</span>
                              </p>
                              <p className="text-xs text-indigo-600 font-medium mt-1">
                                {entry.quiz_topic} • {new Date(entry.completion_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {index < 3 && (
                            <div className="text-right">
                              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                                index === 0 ? 'bg-yellow-200 text-yellow-800' :
                                index === 1 ? 'bg-gray-200 text-gray-800' :
                                'bg-orange-200 text-orange-800'
                              }`}>
                                {index === 0 ? 'CHAMPION' : index === 1 ? 'RUNNER-UP' : 'THIRD PLACE'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : showSavedQuizzes ? (
              /* Saved Quizzes View */
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-full mb-6 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-8">Your Saved Quizzes</h3>
                {savedQuizzes.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 text-lg">No saved quizzes found.</p>
                    <p className="text-gray-500">Generate your first quiz to get started!</p>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2">
                    {savedQuizzes.map((quiz, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-blue-300 transition-all duration-300 hover:scale-105">
                        <div className="flex flex-col h-full">
                          <div className="flex-1">
                            <div className="flex items-center mb-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <h4 className="font-bold text-gray-900 text-lg truncate">{quiz.filename}</h4>
                            </div>
                            <div className="space-y-2 mb-4">
                              <p className="text-sm text-gray-600 flex items-center">
                                <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-medium">{quiz.total_questions}</span> questions
                              </p>
                              <p className="text-xs text-gray-500 flex items-center">
                                <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4M8 7h8M8 7l-1 10a2 2 0 002 2h6a2 2 0 002-2L16 7" />
                                </svg>
                                {new Date(quiz.generated_at).toLocaleString()}
                              </p>
                              <div className="flex items-start">
                                <svg className="w-4 h-4 mr-2 text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                <div className="flex flex-wrap gap-1">
                                  {quiz.topics.map((topic, topicIndex) => (
                                    <span key={topicIndex} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                      {topic}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-2 pt-4 border-t border-gray-100">
                            <button
                              onClick={() => loadSavedQuiz(quiz.filename)}
                              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium text-sm flex items-center justify-center space-x-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              <span>Load Quiz</span>
                            </button>
                            <button
                              onClick={() => exportQuizAsMarkdown(quiz.filename)}
                              className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 font-medium text-sm flex items-center justify-center space-x-1"
                              title="Export as Markdown"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                              </svg>
                              <span>Export</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Generate New Quiz View */
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-6 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18m9-12H3" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Create Your Quiz</h3>
                <p className="text-gray-600 mb-8">Upload a PDF or DOCX document to generate an interactive learning experience</p>
                
            <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl mx-auto">
              <div className="relative group">
                <input
                  type="file"
                  id="document"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="document"
                  className="cursor-pointer block w-full border-2 border-dashed border-blue-300 rounded-xl p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition-all duration-300 group-hover:scale-105"
                >
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto group-hover:bg-blue-200 transition-colors shadow-inner">
                      {file ? (
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      ) : (
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-blue-600 group-hover:text-blue-800">
                        {file ? file.name : 'Click to select your document'}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Supported formats: PDF, DOCX (Max 10MB)
                      </p>
                    </div>
                  </div>
                </label>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-pulse">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div className="relative">
                  <button
                    type="submit"
                    disabled={!file || isSubmitting}
                    className={`w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-xl text-base font-semibold text-white transition-all duration-300 ${
                      !file || isSubmitting 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:scale-105 shadow-lg hover:shadow-xl'
                    } focus:outline-none focus:ring-4 focus:ring-blue-300`}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating your quiz...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Generate Interactive Quiz
                      </>
                    )}
                  </button>
                </div>
                
                <div className="relative">
                  <button
                    onClick={generateAndExportMarkdown}
                    disabled={!file || isSubmitting}
                    className={`w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-xl text-base font-semibold text-white transition-all duration-300 ${
                      !file || isSubmitting 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 hover:scale-105 shadow-lg hover:shadow-xl'
                    } focus:outline-none focus:ring-4 focus:ring-green-300`}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Generate & Export as Markdown
                  </button>
                </div>
                
                {isSubmitting && (
                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <p className="text-sm text-blue-700 font-medium">
                        AI is analyzing your document and creating questions...
                      </p>
                    </div>
                    <p className="text-xs text-blue-600">This may take a moment. Please wait...</p>
                  </div>
                )}
              </div>
            </form>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show flashcard interface
  if (gameMode === 'flashcards') {
    const currentQ = quiz[currentQuestion];
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50">
        <div className="w-full py-8 min-h-screen flex flex-col">
          <div className="bg-white/90 backdrop-blur-sm shadow-2xl border border-white/20 overflow-hidden flex-1 flex flex-col">
            {/* Flashcard Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shadow-inner">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      Flashcard {currentQuestion + 1} of {quiz.length}
                    </h2>
                    <p className="text-purple-100 text-sm">Click card to flip</p>
                  </div>
                </div>
                <div className="bg-white/20 text-white px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-sm">
                  {currentQ.topic} • {currentQ.level}
                </div>
              </div>
              <div className="mt-4">
                <div className="h-2 bg-purple-500/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white/80 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${((currentQuestion + 1) / quiz.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* Flashcard Content */}
            <div className="p-8 sm:p-12 flex-1 flex flex-col justify-center">
              <div className="text-center mb-12">
                <div 
                  className={`relative bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-12 min-h-[350px] flex items-center justify-center cursor-pointer transition-all duration-500 transform hover:scale-105 ${
                    isFlipped ? 'rotate-y-180' : ''
                  } shadow-lg hover:shadow-xl`}
                  onClick={flipCard}
                  style={{
                    perspective: '1000px',
                    transformStyle: 'preserve-3d'
                  }}
                >
                  <div className="text-center w-full">
                    {!isFlipped ? (
                      /* Front of card - Question */
                      <div className="space-y-6">
                        <div className="inline-flex items-center px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {currentQ.type === 'true-false' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : currentQ.type === 'matching' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            )}
                          </svg>
                          {currentQ.type === 'true-false' ? 'TRUE/FALSE' : 
                           currentQ.type === 'matching' ? 'MATCHING' : 'MULTIPLE CHOICE'}
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-relaxed">
                          {currentQ.question}
                        </h3>
                        <div className="flex items-center justify-center space-x-2 text-purple-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.122 2.122" />
                          </svg>
                          <span className="text-sm font-medium">Click to reveal answer</span>
                        </div>
                      </div>
                    ) : (
                      /* Back of card - Answer */
                      <div className="space-y-6">
                        <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          ANSWER
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-green-700 leading-relaxed">
                          {currentQ.answer}
                        </h3>
                        {currentQ.type === 'multiple-choice' && (
                          <div className="bg-white rounded-xl p-6 border border-gray-200 max-w-md mx-auto">
                            <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              All Options:
                            </p>
                            <div className="space-y-2">
                              {currentQ.options.map((option, index) => (
                                <div key={index} className={`text-sm p-3 rounded-lg flex items-center ${
                                  option === currentQ.answer 
                                    ? 'bg-green-100 text-green-800 font-semibold border border-green-300' 
                                    : 'bg-gray-50 text-gray-700'
                                }`}>
                                  <span className="mr-3 font-bold">
                                    {String.fromCharCode(65 + index)}.
                                  </span>
                                  <span>{option}</span>
                                  {option === currentQ.answer && (
                                    <span className="ml-auto text-green-600">✓</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-center space-x-2 text-purple-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span className="text-sm font-medium">Click to flip back</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Navigation Controls */}
              <div className="flex justify-between items-center">
                <button
                  onClick={prevCard}
                  disabled={currentQuestion === 0}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                    currentQuestion === 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700 hover:scale-105 shadow-lg'
                  }`}
                >
                  <span>←</span>
                  <span>Previous</span>
                </button>
                
                <div className="flex items-center space-x-4">
                  <button
                    onClick={resetQuiz}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 font-semibold px-4 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Exit Flashcards</span>
                  </button>
                  <button
                    onClick={flipCard}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-xl hover:from-purple-200 hover:to-pink-200 font-semibold transition-all duration-200 hover:scale-105"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isFlipped ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      )}
                    </svg>
                    <span>{isFlipped ? 'Show Question' : 'Show Answer'}</span>
                  </button>
                </div>
                
                <button
                  onClick={nextCard}
                  disabled={currentQuestion === quiz.length - 1}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                    currentQuestion === quiz.length - 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700 hover:scale-105 shadow-lg'
                  }`}
                >
                  <span>Next</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show quiz interface
  const currentQ = quiz[currentQuestion];
  const isLastQuestion = currentQuestion === quiz.length - 1;
  
  // Calculate if answer is correct based on question type
  let isCorrect = false;
  let showResult = false;
  
  if (currentQ.type === 'matching') {
    showResult = Object.keys(matchingAnswers).length > 0;
    if (showResult) {
      const correctMatches = currentQ.answer.split(',').map(match => match.trim());
      const userMatches = Object.entries(matchingAnswers).map(([key, value]) => `${key}-${value}`);
      isCorrect = correctMatches.length === userMatches.length && 
                 correctMatches.every(match => userMatches.includes(match));
    }
  } else {
    showResult = selectedOption !== null;
    isCorrect = selectedOption !== null && currentQ.options[selectedOption] === currentQ.answer;
  }
  
  const quizCompleted = currentQuestion === quiz.length - 1 && showResult;

  // Show final results
  if (quizCompleted) {
    const totalTime = questionTimes.reduce((acc, time) => acc + time, 0);
    const averageTime = Math.round(totalTime / questionTimes.length);
    const percentage = Math.round((score / quiz.length) * 100);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <div className="w-full py-8 min-h-screen flex flex-col">
          <div className="bg-white/90 backdrop-blur-sm shadow-2xl border border-white/20 overflow-hidden flex-1 flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-8 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
              <div className="relative">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">Congratulations!</h2>
                <p className="text-green-100 text-lg">You've completed the quiz successfully</p>
              </div>
            </div>
            
            <div className="p-8 sm:p-12 flex-1 flex flex-col justify-center">
              {/* Score Display */}
              <div className="text-center mb-12">
                <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full mb-6 ${
                  percentage >= 80 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                  percentage >= 60 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                  'bg-gradient-to-r from-red-400 to-pink-500'
                } shadow-2xl`}>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">{percentage}%</div>
                    <div className="text-white text-sm font-medium">Score</div>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {score} out of {quiz.length} questions correct
                </p>
                <p className={`text-lg mt-2 font-semibold ${
                  percentage >= 80 ? 'text-green-600' :
                  percentage >= 60 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {percentage >= 80 ? 'Excellent Work!' :
                   percentage >= 60 ? 'Good Job!' :
                   'Keep Practicing!'}
                </p>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 text-center">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{formatTime(totalTime)}</div>
                  <div className="text-sm text-blue-700 font-medium">Total Time</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200 text-center">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">{formatTime(averageTime)}</div>
                  <div className="text-sm text-purple-700 font-medium">Average per Question</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200 text-center">
                  <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">
                    {questionTimes.filter(time => time <= 30).length}/{quiz.length}
                  </div>
                  <div className="text-sm text-orange-700 font-medium">Within Time Limit</div>
                </div>
              </div>
              
              {/* Submit Score Section */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-xl border border-gray-200 mb-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Join the Leaderboard!</h4>
                  <p className="text-gray-600">Submit your score and compete with other learners</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                  <input
                    type="text"
                    placeholder="Enter your name (required)"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className={`flex-1 px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 ${
                      !playerName.trim() 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-100' 
                        : 'border-green-300 focus:border-green-500 focus:ring-green-100'
                    } font-medium`}
                    required
                  />
                  <button
                    onClick={() => {
                      const topics = [...new Set(quiz.map(q => q.topic))];
                      submitScore(score, quiz.length, totalTime, topics);
                    }}
                    disabled={hasSubmitted || !playerName.trim()}
                    className={`px-8 py-3 rounded-xl font-semibold transition-all duration-200 ${
                      hasSubmitted || !playerName.trim()
                        ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 hover:scale-105 shadow-lg'
                    }`}
                  >
                    {hasSubmitted ? (
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Submitted</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>Submit Score</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Action Button */}
              <div className="text-center">
                <button
                  onClick={resetQuiz}
                  className="px-12 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 font-bold text-lg transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span>Take Another Quiz</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Toast Notification */}
        {showToast && (
          <div className="fixed top-8 right-8 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-xl shadow-2xl z-50 animate-bounce border border-white/20">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">{toastMessage}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50">
      <div className="w-full min-h-screen flex flex-col">
        <div className="bg-white shadow rounded-lg overflow-hidden flex-1 m-0">
          {/* Quiz Header */}
          <div className="bg-blue-600 px-6 py-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">
                Question {currentQuestion + 1} of {quiz.length}
              </h2>
              <div className="flex items-center space-x-4">
                <div className={`text-white px-3 py-1 rounded-full text-sm font-medium ${
                  timeRemaining <= 10 ? 'bg-red-500 animate-pulse' : 'bg-blue-700'
                }`}>
                  {formatTime(timeRemaining)}
                </div>
                <div className="bg-blue-700 text-white px-3 py-1 rounded-full text-sm font-medium">
                  {currentQ.topic} • {currentQ.level} • {currentQ.type === 'true-false' ? 'T/F' : currentQ.type === 'matching' ? 'Match' : 'MCQ'}
                </div>
              </div>
            </div>
            <div className="mt-2">
              <div className="h-2 bg-blue-500 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-300"
                  style={{ width: `${((currentQuestion + 1) / quiz.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {/* Question */}
          <div className="p-6">
            <div className="mb-8">
              <h3 className="text-xl font-medium text-gray-900 mb-6">{currentQ.question}</h3>
              
              <div className="space-y-3">
                {currentQ.type === 'matching' ? (
                  /* Matching Question UI */
                  <div>
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>Instructions:</strong> Drag items from the left to match them with the correct options on the right.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Items to match */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Items to Match:</h4>
                      <div className="space-y-2">
                        {currentQ.options.map((option, index) => {
                          // Split the option into item and description parts
                          const parts = option.includes('|') ? option.split('|') : [option, ''];
                          const [item, description] = parts;
                          const isMatched = Object.entries(matchingAnswers).find(([key, value]) => 
                            key === (index + 1).toString() || value === String.fromCharCode(65 + index)
                          );
                          return (
                            <div 
                              key={index}
                              draggable={!showResult}
                              onDragStart={(e) => handleDragStart(e, item, index)}
                              className={`p-3 border rounded-lg transition-colors ${
                                !showResult 
                                  ? 'cursor-move hover:shadow-md' 
                                  : 'cursor-default'
                              } ${
                                isMatched 
                                  ? 'border-blue-500 bg-blue-50' 
                                  : 'border-gray-200 hover:border-gray-300'
                              } ${
                                draggedItem && draggedItem.index === index
                                  ? 'opacity-50 scale-95'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{index + 1}. {item.trim()}</span>
                                {isMatched && (
                                  <div className="flex items-center">
                                    <span className="text-blue-600 text-sm mr-2">
                                      → {matchingAnswers[index + 1] || String.fromCharCode(65 + Object.entries(matchingAnswers).find(([k, v]) => v === String.fromCharCode(65 + index))?.[0] - 1)}
                                    </span>
                                    {!showResult && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeMatch(parseInt(isMatched[0]));
                                        }}
                                        className="text-red-500 hover:text-red-700 ml-2"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Drop zones */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Match with:</h4>
                      <div className="space-y-2">
                        {currentQ.options.map((option, index) => {
                          // Split the option into item and description parts
                          const parts = option.includes('|') ? option.split('|') : ['', option];
                          const [item, description] = parts;
                          const letter = String.fromCharCode(65 + index);
                          
                          // Find if any item is matched to this target
                          const matchedItem = Object.entries(matchingAnswers).find(
                            ([key, value]) => value === letter
                          )?.[0];
                          
                          return (
                            <div 
                              key={index}
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, index)}
                              className={`p-3 border-2 border-dashed rounded-lg min-h-[60px] flex items-center justify-between transition-colors ${
                                matchedItem 
                                  ? 'border-green-400 bg-green-50' 
                                  : 'border-gray-300 hover:border-blue-400'
                              }`}
                            >
                              <span>{letter}. {description.trim() || `Match with ${letter}`}</span>
                              {matchedItem && (
                                <div className="flex items-center">
                                  <span className="text-green-600 text-sm mr-2">← {matchedItem}</span>
                                  {!showResult && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeMatch(parseInt(matchedItem));
                                      }}
                                      className="text-red-500 hover:text-red-700 text-sm ml-2"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    </div>
                  </div>
                ) : (
                  /* Regular MCQ/T-F Questions */
                  currentQ.options.map((option, index) => (
                    <div 
                      key={index}
                      onClick={() => !showResult && handleOptionSelect(index)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        showResult 
                          ? option === currentQ.answer
                            ? 'border-green-500 bg-green-50'
                            : selectedOption === index
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-200 hover:border-gray-300'
                          : selectedOption === index
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center">
                        {currentQ.type === 'true-false' ? (
                          <div className="flex items-center">
                            <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                              selectedOption === index ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                            }`}>
                              {selectedOption === index && (
                                <div className="w-2 h-2 rounded-full bg-white m-0.5"></div>
                              )}
                            </div>
                            <span className="font-medium">{option}</span>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <div className={`w-6 h-6 rounded border-2 mr-3 flex items-center justify-center text-sm font-medium ${
                              selectedOption === index 
                                ? 'border-blue-500 bg-blue-500 text-white' 
                                : 'border-gray-300'
                            }`}>
                              {String.fromCharCode(65 + index)}
                            </div>
                            <span>{option}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {showResult && (
                <div className={`mt-4 p-4 rounded-lg ${
                  isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {isCorrect ? 'Correct!' : `Incorrect. The correct answer is: ${currentQ.answer}`}
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <button
                onClick={resetQuiz}
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                Start Over
              </button>
              
              <div className="text-gray-700 font-medium">
                Score: {score} / {currentQuestion + (showResult ? 1 : 0)}
              </div>
              
              <button
                onClick={handleNextQuestion}
                disabled={currentQ.type === 'matching' ? Object.keys(matchingAnswers).length === 0 : selectedOption === null}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  (currentQ.type === 'matching' ? Object.keys(matchingAnswers).length === 0 : selectedOption === null)
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isLastQuestion ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Toast Notification */}
        {showToast && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
