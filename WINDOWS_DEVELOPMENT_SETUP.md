# Windows Development Environment Setup - BabyCare

## Overview
This setup configures a clean local development environment specifically optimized for Windows, avoiding IPv6 issues that cause EACCES permission errors.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (http://127.0.0.1:5173)                             │
├─────────────────────────────────────────────────────────────┤
│  React + Vite Frontend                                       │
│  - Port: 5173                                                 │
│  - Host: 127.0.0.1 (IPv4 only)                               │
│  - Proxy: /api → http://127.0.0.1:5000                       │
├─────────────────────────────────────────────────────────────┤
│                          ↓                                    │
├─────────────────────────────────────────────────────────────┤
│  Node.js Backend (Express)                                   │
│  - Port: 5000                                                 │
│  - Host: 127.0.0.1 (IPv4 only)                               │
│  - CORS: Allows http://127.0.0.1:5173                        │
├─────────────────────────────────────────────────────────────┤
│                          ↓                                    │
├─────────────────────────────────────────────────────────────┤
│  Services (Firebase, APIs, Database)                         │
└─────────────────────────────────────────────────────────────┘
```

## Why This Works on Windows

### Problem: IPv6 EACCES Error
Windows sometimes denies binding to the IPv6 loopback address (::1) when Node.js tries to listen on "localhost" (which resolves to ::1 first). Error: `listen EACCES: permission denied ::1:8081`

### Solution: Explicit IPv4 Binding
- **127.0.0.1**: Explicitly binds to IPv4 loopback (guaranteed to work)
- **Vite Proxy**: Eliminates CORS issues by proxying /api requests
- **Explicit Host Binding**: Backend listens on '127.0.0.1' instead of letting Node choose
- **Port 5173**: Vite's default, less likely to have permission issues

## Configuration Files

### 1. Frontend: `client/vite.config.ts`
```typescript
server: {
  host: "127.0.0.1",        // IPv4 only - prevents Windows EACCES
  port: 5173,                // Standard Vite dev port
  proxy: {                   // API requests go to backend
    '/api': {
      target: 'http://127.0.0.1:5000',
      changeOrigin: true,
    },
  },
}
```

**Key Points:**
- `host: "127.0.0.1"` forces IPv4, avoiding ::1 permission issues
- Proxy intercepts /api calls and forwards to backend without CORS
- Frontend code can use relative paths: `fetch('/api/...)`

### 2. Backend: `server/index.js`
```javascript
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: 'http://127.0.0.1:5173',  // Exact frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

app.listen(PORT, '127.0.0.1', () => {  // Explicit IPv4 binding
  console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
});
```

**Key Points:**
- `app.listen(PORT, '127.0.0.1', ...)` explicitly binds to IPv4
- CORS origin matches frontend URL exactly
- No IPv6 loopback binding issues

### 3. Environment Files

**Frontend** (`client/.env.local`):
```env
VITE_API_BASE_URL=http://127.0.0.1:5173/api
```

**Backend** (`server/.env.development`):
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://127.0.0.1:5173
```

## Running Locally

### Terminal 1: Backend
```powershell
cd C:\BabyCare\server
npm install
npm start  # Runs on http://127.0.0.1:5000
```

### Terminal 2: Frontend
```powershell
cd C:\BabyCare\client
npm install
npm run dev  # Runs on http://127.0.0.1:5173
```

### Verify Setup
```powershell
# Test backend health
curl http://127.0.0.1:5000/health

# Frontend will open at http://127.0.0.1:5173
# API calls to /api/* are automatically proxied to backend
```

## API Usage in Frontend

```typescript
// Using relative paths (proxied by Vite)
const response = await fetch('/api/care-logs', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // For cookies
});

// Or using environment variable
const apiUrl = import.meta.env.VITE_API_BASE_URL;
const response = await fetch(`${apiUrl}/care-logs`);
```

## Troubleshooting

### Port Already in Use
```powershell
# Find what's using the port
Get-NetTCPConnection -LocalPort 5173

# Kill the process (replace PID with actual process ID)
Stop-Process -Id <PID> -Force

# Or use a different port in vite.config.ts
# port: 5174
```

### Still Getting EACCES Error
1. Run PowerShell as Administrator
2. Check Windows Firewall isn't blocking
3. Verify no IPv6 is being forced: `ipconfig /all` (disable IPv6 if needed)

### CORS Still Failing
1. Ensure `CLIENT_URL=http://127.0.0.1:5173` in `.env.development`
2. Check CORS origin in `index.js` matches frontend URL
3. Restart backend after changing env vars

### Frontend Can't Reach Backend
1. Verify proxy in `vite.config.ts` target is `http://127.0.0.1:5000`
2. Check backend is running: `curl http://127.0.0.1:5000/health`
3. Check network tab in DevTools to see where requests go

## Production Considerations

**Never use this exact setup in production.** For production:
- Use proper hostnames (not 127.0.0.1)
- Enable HTTPS/TLS
- Use environment-specific configurations
- Implement proper CORS whitelisting
- Use a reverse proxy (nginx, CloudFlare)
- Set up proper logging and monitoring

## Summary

This Windows-optimized setup:
✅ Uses IPv4 (127.0.0.1) exclusively  
✅ Avoids IPv6 permission errors  
✅ Eliminates CORS issues via Vite proxy  
✅ Clean development experience  
✅ Production-safe patterns  
✅ Easy to debug with explicit endpoints  
