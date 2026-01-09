# BabyCare Development Quick Start Guide

## ✅ All Issues Fixed - Ready to Develop!

The repository has been fully configured for Windows development with proper IPv4 setup and no CORS issues.

## Quick Start (30 seconds)

### Option 1: Using PowerShell (Recommended)
```powershell
cd C:\BabyCare
.\START_DEV.ps1
```

### Option 2: Using Batch Script
```powershell
cd C:\BabyCare
.\START_DEV.bat
```

### Option 3: Manual Setup (2 terminals)

**Terminal 1 - Backend:**
```powershell
cd C:\BabyCare\server
npm start
```

**Terminal 2 - Frontend:**
```powershell
cd C:\BabyCare\client
npm run dev
```

## Expected Output

### Backend Console
```
🚀 BabyCare Backend Server running on http://127.0.0.1:5000
📡 Health check: http://127.0.0.1:5000/health
🔐 Environment: development
✅ CORS enabled for: http://127.0.0.1:5173
```

### Frontend Console
```
VITE v5.4.19  ready in 286 ms

  ➜  Local:   http://127.0.0.1:5173/
  ➜  press h + enter to show help
```

## Verify It's Working

### Test Backend Health
```powershell
curl http://127.0.0.1:5000/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2026-01-09T07:58:02.233Z",
  "service": "BabyCare Backend API"
}
```

### Open Frontend
- Navigate to `http://127.0.0.1:5173` in your browser
- Check browser console for any errors
- Try logging in or using app features

## Key Configuration Changes Made

### 1. Frontend API Configuration
- **File**: `client/src/lib/api.ts`
- Changed from hardcoded `http://localhost:5000` to relative `/api`
- Uses Vite proxy → no CORS issues
- Env variable: `VITE_API_BASE_URL=/api`

### 2. Backend CORS Setup
- **File**: `server/index.js`
- Configured to accept requests from `http://127.0.0.1:5173`
- Binds explicitly to IPv4: `app.listen(PORT, '127.0.0.1')`

### 3. Vite Dev Server
- **File**: `client/vite.config.ts`
- Host: `127.0.0.1` (IPv4 only, no IPv6)
- Port: `5173` (auto-increments if in use)
- Proxy: `/api` requests to `http://127.0.0.1:5000`

### 4. Environment Variables
- **Frontend**: `client/.env.local` (with real Firebase credentials)
- **Backend**: `server/.env` (matches frontend URL)

## Why This Works on Windows

❌ **Old Setup (Broke on Windows)**
```
localhost → Resolves to ::1 (IPv6)
::1:8081 → Permission Denied (EACCES)
```

✅ **New Setup (Works on Windows)**
```
127.0.0.1 → Direct IPv4, No Resolution
127.0.0.1:5000 & 127.0.0.1:5173 → Works reliably
```

## API Calls in Frontend Code

```typescript
// API calls use relative /api path (proxied by Vite)
const response = await fetch('/api/babies', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

// Vite automatically routes:
// http://127.0.0.1:5173/api/babies 
//   ↓ (proxied)
// http://127.0.0.1:5000/api/babies
```

## Troubleshooting

### Port Already in Use
```powershell
# Find process using port 5173
Get-NetTCPConnection -LocalPort 5173

# Kill the process (replace 12345 with PID)
Stop-Process -Id 12345 -Force

# Vite will auto-increment if 5173 is taken, but best to free it up
```

### Port 5000 in Use (Critical)
```powershell
# This will break API calls! Must kill the process
Get-NetTCPConnection -LocalPort 5000

# Kill the process
Stop-Process -Id <PID> -Force
```

### Module Not Found Errors
```powershell
# Reinstall dependencies
cd C:\BabyCare\client
Remove-Item -Recurse node_modules -Force
npm install

# Or use npm ci for clean install
npm ci
```

### Firebase Errors
1. Verify `client/.env.local` has real credentials (not placeholders)
2. Check Firebase project is active: https://console.firebase.google.com/
3. Ensure `.env.local` is loaded: restart dev server after changes

### CORS Still Failing?
1. Verify backend console shows: `✅ CORS enabled for: http://127.0.0.1:5173`
2. Check `server/.env` has `CLIENT_URL=http://127.0.0.1:5173`
3. Use browser DevTools Network tab to verify request URL
4. Restart both servers

## All Fixed Configuration Files

| File | Status | Purpose |
|------|--------|---------|
| [client/vite.config.ts](../client/vite.config.ts) | ✅ | Dev server config, proxy setup |
| [client/.env.local](../client/.env.local) | ✅ | Firebase credentials, API URL |
| [client/src/lib/api.ts](../client/src/lib/api.ts) | ✅ | API client with correct env var |
| [server/index.js](../server/index.js) | ✅ | CORS, IPv4 binding |
| [server/.env](../server/.env) | ✅ | Port, CORS origin URL |

## Windows-Specific Notes

1. **IPv6 Issues**: Windows sometimes blocks IPv6 loopback. Our setup uses IPv4 only.
2. **Firewall**: If you see connection refused, check Windows Defender Firewall
3. **PowerShell**: Run in admin mode if you get permission errors
4. **Port Conflicts**: Check `netstat -ano` if ports seem stuck

## Next Steps

1. ✅ Start servers using `START_DEV.ps1`
2. ✅ Open `http://127.0.0.1:5173` in browser
3. ✅ Test Firebase authentication
4. ✅ Try making API calls to backend
5. ✅ Check browser DevTools Console for any errors
6. ✅ Review [FIXES_APPLIED.md](../FIXES_APPLIED.md) for detailed changes

## Environment Variables Reference

### Frontend (.env.local)
```env
VITE_API_BASE_URL=/api              # Proxied by Vite
VITE_FIREBASE_API_KEY=...           # From Firebase console
VITE_FIREBASE_AUTH_DOMAIN=...       # From Firebase console
VITE_FIREBASE_PROJECT_ID=...        # From Firebase console
VITE_FIREBASE_STORAGE_BUCKET=...    # From Firebase console
VITE_FIREBASE_MESSAGING_SENDER_ID=..# From Firebase console
VITE_FIREBASE_APP_ID=...            # From Firebase console
```

### Backend (.env)
```env
PORT=5000                                    # Server port
NODE_ENV=development                         # Environment
CLIENT_URL=http://127.0.0.1:5173            # Frontend URL for CORS
HUGGINGFACE_TOKEN=...                       # Optional, for ML features
```

## Additional Resources

- [Windows Development Setup Details](../WINDOWS_DEVELOPMENT_SETUP.md)
- [Full Fix Summary](../FIXES_APPLIED.md)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [Express Documentation](https://expressjs.com/)

---

**Ready to develop?** Run `.\START_DEV.ps1` and happy coding! 🚀
