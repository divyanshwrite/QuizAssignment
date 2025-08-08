# Backend API

FastAPI server for processing documents and generating quizzes.

## Setup

```bash
pip install -r requirements.txt
python main.py
```

## Environment

Create `.env` file:
```
OPENROUTER_API_KEY=your_key_here
```

## Endpoints

- POST `/api/generate-quiz` - Generate quiz from file
- GET `/api/saved-quizzes` - List saved quizzes
- POST `/api/submit-score` - Submit leaderboard score
- GET `/api/leaderboard` - Get leaderboard data

## Running the Backend

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

## API Endpoints

### GET /
- Health check endpoint
- Returns: `{"message": "Regulatory Quiz Generator API is running"}`

### POST /api/generate-quiz
- Accepts either a file upload or text input
- Returns: List of quiz questions in JSON format

Example request (file upload):
```
curl -X 'POST' \
  'http://localhost:8000/api/generate-quiz' \
  -H 'accept: application/json' \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@document.pdf;type=application/pdf'
```

Example request (text input):
```
curl -X 'POST' \
  'http://localhost:8000/api/generate-quiz' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Regulatory document text goes here...",
    "num_questions": 5
  }'
```

## Response Format

```json
[
  {
    "question": "What is the main purpose of regulatory compliance?",
    "options": [
      "To avoid penalties",
      "To ensure product quality",
      "To protect consumers",
      "All of the above"
    ],
    "answer": "All of the above",
    "type": "MCQ",
    "level": "Beginner",
    "topic": "Regulatory"
  }
]
```
