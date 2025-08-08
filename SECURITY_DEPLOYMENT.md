# Deployment Security Guide

This guide explains how to securely deploy your application without exposing sensitive API keys.

## 🔒 Security Best Practices

### ❌ What NOT to do:
- Never hardcode API keys in your source code
- Never commit `.env` files to version control
- Never expose API keys in frontend code
- Never push sensitive credentials to GitHub

### ✅ What TO do:
- Use environment variables for all sensitive data
- Set environment variables directly in your hosting platform
- Keep `.env` files local for development only
- Use `.env.example` files to document required variables

## 🚀 Platform-Specific Setup

### Render Deployment

1. **Backend Setup:**
   - Go to your Render service dashboard
   - Navigate to "Environment" tab
   - Add environment variable:
     - Key: `OPENROUTER_API_KEY`
     - Value: `your_actual_openrouter_api_key`

2. **Frontend Setup:**
   - In your frontend service environment:
     - Key: `VITE_API_BASE_URL`
     - Value: `https://your-backend-service.onrender.com`

### Vercel Deployment

1. **Frontend Setup:**
   - Go to your Vercel project dashboard
   - Navigate to "Settings" → "Environment Variables"
   - Add:
     - Key: `VITE_API_BASE_URL`
     - Value: `https://your-backend-domain.com`

### Railway Deployment

1. **Backend Setup:**
   - Open your Railway project
   - Go to "Variables" tab
   - Add:
     - Key: `OPENROUTER_API_KEY`
     - Value: `your_actual_openrouter_api_key`

## 🔧 Local Development Setup

1. **Backend:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your actual API key
   ```

2. **Frontend:**
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env with your local backend URL (usually http://localhost:8000)
   ```

## 🗂️ File Structure After Security Setup

```
backend/
├── .env                 # Local only - DO NOT COMMIT
├── .env.example         # Template - SAFE TO COMMIT
├── .gitignore          # Includes .env - SAFE TO COMMIT
└── main.py             # No hardcoded keys - SAFE TO COMMIT

frontend/
├── .env                 # Local only - DO NOT COMMIT
├── .env.example         # Template - SAFE TO COMMIT
├── .gitignore          # Includes .env - SAFE TO COMMIT
└── src/config.js       # Uses env vars - SAFE TO COMMIT
```

## ⚠️ Emergency: If You Accidentally Exposed Keys

1. **Immediately revoke/regenerate** the exposed API key at OpenRouter
2. **Remove the key** from your code
3. **Force push** a clean commit to remove the key from Git history
4. **Set up environment variables** properly as described above

## 🔍 Verification Checklist

Before deploying:
- [ ] No hardcoded API keys in source code
- [ ] `.env` files are in `.gitignore`
- [ ] Environment variables are set in hosting platform
- [ ] Local `.env` files contain only placeholder values
- [ ] API keys work in deployed environment

## 📞 Support

If you need help setting up environment variables on your hosting platform:
- Render: https://render.com/docs/environment-variables
- Vercel: https://vercel.com/docs/concepts/projects/environment-variables
- Railway: https://docs.railway.app/develop/variables
