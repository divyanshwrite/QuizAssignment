// API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Check if we're in production and using localhost (potential misconfiguration)
const isProduction = import.meta.env.MODE === 'production';
const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');

if (isProduction && isLocalhost) {
  console.warn('⚠️ Production build is configured to use localhost API. Please set VITE_API_BASE_URL environment variable.');
}

export { API_BASE_URL };
