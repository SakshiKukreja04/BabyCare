# BabyCare Development Setup - Complete Fix Summary

## Issues Fixed

### 1. ✅ Frontend API Configuration
**File**: [client/src/lib/api.ts](client/src/lib/api.ts)
- **Issue**: Used wrong env variable `VITE_API_URL` that didn't exist
- **Issue**: Had hardcoded `http://localhost:5000` instead of using proxy
- **Fix**: Changed to `VITE_API_BASE_URL` with fallback to `/api` (uses Vite proxy)
```typescript
// Before
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// After
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
```

### 2. ✅ Frontend Environment Variables
**File**: [client/.env.local](client/.env.local)
- **Issue**: Placeholders instead of real Firebase credentials
- **Fix**: Populated with actual Firebase config from `client/.env`
- **Fix**: Set `VITE_API_BASE_URL=/api` to use Vite proxy (no direct CORS calls)

### 3. ✅ Backend Environment Variables
**File**: [server/.env](server/.env)
- **Issue**: `CLIENT_URL=http://localhost:8080` didn't match frontend
- **Issue**: CORS mismatch causing potential issues
- **Fix**: Updated to `CLIENT_URL=http://127.0.0.1:5173`

### 4. ✅ Vite Configuration
**File**: [client/vite.config.ts](client/vite.config.ts)
- **Status**: Already correctly configured with:
  - IPv4 binding: `host: "127.0.0.1"` (prevents Windows EACCES errors)
  - Port: `5173`
  - API proxy: `/api` → `http://127.0.0.1:5000`

### 5. ✅ Backend Server Configuration
**File**: [server/index.js](server/index.js)
- **Status**: Already correctly updated with:
  - Explicit IPv4 binding: `app.listen(PORT, '127.0.0.1')`
  - CORS allowing `http://127.0.0.1:5173`
  - Proper methods and headers

## Final Configuration Summary

### Frontend (Port 5173)
```
Client .env.local:
  VITE_API_BASE_URL=/api  ← Uses Vite proxy, no CORS issues
  VITE_FIREBASE_API_KEY=AIzaSyAWwS4fkKGwPp0FH9SdrNrmfDc8brCRtU0
  VITE_FIREBASE_PROJECT_ID=carenest-b986b
  [... other Firebase config ...]

Vite Config:
  host: 127.0.0.1 (IPv4)
  port: 5173
  proxy /api → http://127.0.0.1:5000
```

### Backend (Port 5000)
```
Server .env:
  PORT=5000
  NODE_ENV=development
  CLIENT_URL=http://127.0.0.1:5173

Express Config:
  app.listen(PORT, '127.0.0.1')
  CORS origin: http://127.0.0.1:5173
```

## How to Start Development

### Terminal 1: Backend
```powershell
cd C:\BabyCare\server
npm install          # Install dependencies if needed
npm start            # Starts on http://127.0.0.1:5000
```

### Terminal 2: Frontend
```powershell
cd C:\BabyCare\client
npm install          # Install dependencies if needed
npm run dev          # Starts on http://127.0.0.1:5173
```

### Verify Everything Works
```powershell
# Test backend health endpoint
curl http://127.0.0.1:5000/health

# Open browser to frontend
# http://127.0.0.1:5173

# API calls in frontend code automatically use /api proxy
# Example: fetch('/api/babies') → http://127.0.0.1:5000/api/babies
```

## Why This Setup Works

1. **IPv4 Only**: Avoids Windows EACCES errors on ::1 (IPv6 loopback)
2. **Explicit Binding**: `app.listen(PORT, '127.0.0.1')` prevents Node from trying IPv6
3. **Vite Proxy**: `/api` requests proxied by Vite elimates CORS issues entirely
4. **Environment Variables**: All services use same IPs/ports, no conflicts
5. **No Direct CORS**: Frontend never makes direct cross-origin calls to backend

## If You Still Have Issues

### Port Already in Use
```powershell
# Find what's using port
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

# Kill process (replace 12345 with actual PID)
Stop-Process -Id 12345 -Force
```

### Clear Node Modules & Reinstall
```powershell
# Frontend
cd C:\BabyCare\client
Remove-Item -Recurse node_modules -Force
npm install

# Backend
cd C:\BabyCare\server
Remove-Item -Recurse node_modules -Force
npm install
```

### Environment Not Loading
- Restart dev server after changing `.env` files
- Vite doesn't hot-reload env variables
- Check `.env.local` exists and has actual credentials (not placeholders)

### CORS Still Failing
1. Verify `CLIENT_URL` in `server/.env` matches your frontend URL
2. Check backend console for CORS errors
3. Verify `/api` proxy in vite.config.ts points to `http://127.0.0.1:5000`
4. Use browser DevTools Network tab to see actual request URLs

## Checklist Before Starting

- [ ] `client/.env.local` exists with real Firebase credentials
- [ ] `server/.env` has `CLIENT_URL=http://127.0.0.1:5173`
- [ ] `vite.config.ts` has proxy `/api` → `http://127.0.0.1:5000`
- [ ] `server/index.js` listens on `127.0.0.1:5000`
- [ ] Running on IPv4 addresses only (no localhost resolution to ::1)
- [ ] Both ports (5173, 5000) are available

## All Fixed Files

1. [client/vite.config.ts](client/vite.config.ts) ✅
2. [client/.env.local](client/.env.local) ✅
3. [client/src/lib/api.ts](client/src/lib/api.ts) ✅
4. [server/.env](server/.env) ✅
5. [server/index.js](server/index.js) ✅

You're ready to develop! 🚀
