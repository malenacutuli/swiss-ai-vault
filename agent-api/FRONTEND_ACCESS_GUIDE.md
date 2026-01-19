# Frontend Access Guide

**SwissBrain.ai Platform**

---

## 📍 Frontend Locations

You have **TWO frontend applications** in your SwissBrain platform:

### 1. Main Frontend (React + Vite)
**Location**: `/Users/malena/swiss-ai-vault/`
**Technology**: React, TypeScript, Vite, TailwindCSS
**Purpose**: Main SwissBrain.ai web application

### 2. Agent Frontend (Separate React App)
**Location**: `/Users/malena/swiss-ai-vault/agent-api/frontend/`
**Technology**: React, TypeScript, Vite, TailwindCSS
**Purpose**: Agent management and monitoring interface

---

## 🚀 How to Access the Main Frontend

### Option 1: Development Server (Recommended)

```bash
# Navigate to project root
cd /Users/malena/swiss-ai-vault

# Install dependencies (if needed)
npm install

# Start development server
npm run dev
```

**Access at**: `http://localhost:5173` (default Vite port)

### Option 2: Production Build

```bash
# Build for production
cd /Users/malena/swiss-ai-vault
npm run build

# Preview production build
npm run preview
```

**Access at**: `http://localhost:4173` (default preview port)

---

## 🚀 How to Access the Agent Frontend

### Development Server

```bash
# Navigate to agent frontend
cd /Users/malena/swiss-ai-vault/agent-api/frontend

# Install dependencies (if needed)
npm install

# Start development server
npm run dev
```

**Access at**: `http://localhost:5174` (likely different port to avoid conflict)

---

## 📂 Frontend Structure

### Main Frontend (`/Users/malena/swiss-ai-vault/`)

```
swiss-ai-vault/
├── src/                      # React source code
│   ├── components/          # React components
│   ├── pages/               # Page components
│   ├── integrations/        # Supabase integrations
│   └── ...
├── public/                   # Static assets
├── index.html               # Entry HTML
├── vite.config.ts           # Vite configuration
├── tailwind.config.ts       # TailwindCSS config
└── package.json             # Dependencies and scripts
```

**Available Scripts**:
```json
{
  "dev": "vite",                    // Start dev server
  "build": "vite build",            // Production build
  "build:dev": "vite build --mode development",
  "preview": "vite preview",        // Preview prod build
  "lint": "eslint .",              // Lint code
  "format": "prettier --write ..."  // Format code
}
```

### Agent Frontend (`/Users/malena/swiss-ai-vault/agent-api/frontend/`)

Similar structure optimized for agent management interface.

---

## 🌐 Production Deployment

### Main Frontend

The main frontend is likely deployed to one of:
- **Vercel**: https://swissbrain.vercel.app (if deployed)
- **Netlify**: https://swissbrain.netlify.app (if deployed)
- **Custom Domain**: https://swissbrain.ai (if configured)

### Check Current Deployment

```bash
# Check for deployment configs
cd /Users/malena/swiss-ai-vault
cat vercel.json 2>/dev/null || echo "No Vercel config"
cat netlify.toml 2>/dev/null || echo "No Netlify config"

# Check for deployment info in package.json
cat package.json | grep -A 5 '"deploy"'
```

---

## 🔧 Environment Configuration

### Main Frontend Environment

Create `.env.local` in `/Users/malena/swiss-ai-vault/`:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# API Configuration
VITE_API_URL=http://localhost:8000  # Local
# VITE_API_URL=https://api.swissbrain.ai  # Production

# Agent API
VITE_AGENT_API_URL=https://api.swissbrain.ai/agent
```

### Agent Frontend Environment

Create `.env.local` in `/Users/malena/swiss-ai-vault/agent-api/frontend/`:

```bash
VITE_AGENT_API_URL=http://localhost:8000/agent
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 🎯 Quick Start Guide

### Start Both Frontends Simultaneously

```bash
# Terminal 1: Main Frontend
cd /Users/malena/swiss-ai-vault
npm run dev

# Terminal 2: Agent Frontend
cd /Users/malena/swiss-ai-vault/agent-api/frontend
npm run dev

# Terminal 3: Backend API
cd /Users/malena/swiss-ai-vault/agent-api
uvicorn app.main:app --reload --port 8000
```

**Access**:
- Main Frontend: `http://localhost:5173`
- Agent Frontend: `http://localhost:5174`
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

---

## 📊 Frontend Features

### Main Frontend Includes:

- ✅ User authentication (Supabase Auth)
- ✅ Dashboard
- ✅ Agent creation and management
- ✅ File uploads
- ✅ Prompt management (Phase 5)
- ✅ Real-time updates
- ✅ Responsive design (TailwindCSS)

### Agent Frontend Includes:

- ✅ Agent run monitoring
- ✅ Log streaming
- ✅ Task execution
- ✅ Status tracking
- ✅ Result visualization

---

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use a different port
npm run dev -- --port 3000
```

### Dependencies Not Installed

```bash
# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Environment Variables Not Loading

```bash
# Ensure .env.local exists
cd /Users/malena/swiss-ai-vault
cat .env.local

# Restart dev server after creating/modifying .env.local
```

### Build Errors

```bash
# Clear Vite cache
rm -rf node_modules/.vite
rm -rf dist

# Rebuild
npm run build
```

---

## 📱 Mobile Development

### Test on Mobile Device

```bash
# Start dev server with network access
npm run dev -- --host

# Access from mobile on same network
# http://YOUR_LOCAL_IP:5173
```

Find your local IP:
```bash
# macOS
ipconfig getifaddr en0

# Will show something like: 192.168.1.100
```

---

## 🔍 Current Status Check

Run this to check your frontend setup:

```bash
# Main Frontend Status
cd /Users/malena/swiss-ai-vault
echo "Main Frontend:"
echo "  Node modules: $([ -d node_modules ] && echo '✅ Installed' || echo '❌ Not installed')"
echo "  Package.json: $([ -f package.json ] && echo '✅ Found' || echo '❌ Missing')"
echo "  Vite config: $([ -f vite.config.ts ] && echo '✅ Found' || echo '❌ Missing')"

# Agent Frontend Status
cd /Users/malena/swiss-ai-vault/agent-api/frontend
echo ""
echo "Agent Frontend:"
echo "  Node modules: $([ -d node_modules ] && echo '✅ Installed' || echo '❌ Not installed')"
echo "  Package.json: $([ -f package.json ] && echo '✅ Found' || echo '❌ Missing')"
echo "  Vite config: $([ -f vite.config.ts ] && echo '✅ Found' || echo '❌ Missing')"
```

---

## 🎨 UI Framework

Both frontends use:
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **shadcn/ui** - Component library (likely)
- **React Router** - Navigation

---

## 🚀 Deployment Checklist

Before deploying frontend to production:

- [ ] Environment variables configured
- [ ] Production API URL set
- [ ] Build succeeds without errors
- [ ] All tests passing
- [ ] Assets optimized
- [ ] CORS configured on backend
- [ ] SSL certificate configured
- [ ] Domain DNS configured

---

## 📞 Support

For frontend issues:
- Check browser console for errors
- Verify environment variables are loaded
- Ensure backend API is running
- Check Supabase connection
- Review Vite logs in terminal

---

**Frontend is ready to use! Start the dev server to see your application. 🚀**

**Quick Start Command**:
```bash
cd /Users/malena/swiss-ai-vault && npm run dev
```

Then open: `http://localhost:5173`
