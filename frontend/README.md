# Quiz Application Frontend

React-based frontend for the Regulatory Quiz Generator application.

## Live Demo
🚀 **Frontend**: [https://quiz-app-ten-phi-14.vercel.app](https://quiz-app-ten-phi-14.vercel.app)

## Features
- File upload interface (PDF/DOCX)
- Interactive quiz with timer
- Multiple question types (multiple-choice, true/false, matching)
- Leaderboard system
- Responsive design with Tailwind CSS

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Environment Configuration

### Development
- Uses `http://localhost:8000` as API base URL
- Configure in `.env` file

### Production
- Update `.env.production` with your backend API URL
- Current frontend deployed on Vercel: https://quiz-app-ten-phi-14.vercel.app

## Deployment on Vercel

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `VITE_API_BASE_URL`: Your backend API URL
3. Deploy automatically on push to main branch

## API Integration

The frontend connects to a FastAPI backend for:
- Quiz generation from documents
- Saving/loading quizzes
- Leaderboard management
- Markdown export

## Technology Stack

- **React 19.1.0**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling
- **Axios**: HTTP client
- **React Icons**: Icon library

## Project Structure

```
src/
├── App.jsx              # Main application component
├── main.jsx             # React entry point
├── config.js            # API configuration
├── index.css            # Global styles
└── components/
    ├── Login.jsx         # Login component (placeholder)
    └── MatchingQuestion.jsx  # Drag-and-drop matching questions
```

## Configuration Files

- `vercel.json`: Vercel deployment configuration
- `tailwind.config.js`: Tailwind CSS configuration
- `vite.config.js`: Vite build configuration
- `.env`: Development environment variables
- `.env.production`: Production environment variables
