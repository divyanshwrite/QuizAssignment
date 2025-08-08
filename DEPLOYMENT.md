# Backend Deployment Guide

## Current Status
- **Frontend**: Deployed on Vercel at https://quiz-app-ten-phi-14.vercel.app
- **Backend**: Needs to be deployed (currently configured for localhost)

## Next Steps for Full Deployment

### 1. Deploy Backend
You need to deploy your FastAPI backend to a cloud service. Here are some options:

#### Option A: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Option B: Render
1. Push your code to GitHub
2. Connect to Render.com
3. Create a new Web Service
4. Configure build command: `pip install -r requirements.txt`
5. Configure start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

#### Option C: Heroku
```bash
# Install Heroku CLI and login
heroku create your-quiz-app-backend
git push heroku main
```

### 2. Update Environment Variables

After deploying your backend, update these files:

#### Frontend (.env.production)
```env
VITE_API_BASE_URL=https://your-backend-url.com
```

#### Backend Environment
Set this environment variable in your deployment platform:
```env
OPENROUTER_API_KEY=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
```

### 3. Update CORS Configuration
The backend is already configured to accept requests from your Vercel frontend:
```python
allow_origins=[
    # ... other origins
    "https://quiz-app-ten-phi-14.vercel.app"
]
```

### 4. Redeploy Frontend
After updating the backend URL, redeploy your frontend on Vercel to use the new environment variables.

## Production Checklist

- [ ] Deploy backend to cloud service
- [ ] Set OPENROUTER_API_KEY environment variable
- [ ] Update VITE_API_BASE_URL in frontend
- [ ] Test API endpoints
- [ ] Verify CORS configuration
- [ ] Test file upload functionality
- [ ] Test quiz generation
- [ ] Test leaderboard functionality

## Recommended Backend Deployment Services

1. **Railway**: Easy Python deployment, good free tier
2. **Render**: Free tier available, automatic deploys
3. **Railway**: Docker support, database hosting
4. **Heroku**: Popular platform, easy to use
5. **Digital Ocean App Platform**: Good performance, reasonable pricing

## File Structure After Deployment
```
backend/
├── main.py              # FastAPI application
├── requirements.txt     # Dependencies
├── Procfile            # For Heroku (if using)
├── railway.toml        # For Railway (if using)
└── generated_quizzes/  # Quiz storage (persistent volume needed)
```

## Important Notes

1. **File Storage**: The current implementation stores quizzes in local JSON files. For production, consider using a database or cloud storage.

2. **API Keys**: Never commit API keys to version control. Use environment variables.

3. **CORS**: Make sure your backend URL is added to the CORS allowed origins.

4. **File Upload Limits**: Current limit is 10MB. Adjust based on your hosting provider's limits.
