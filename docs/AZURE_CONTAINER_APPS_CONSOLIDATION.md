# Azure Container Apps Consolidation — Feasibility Assessment

## 1. Current State Analysis

### Repository Structure
```
shura/ (mono-repo)
├── shura-frontend/   — React 19 + Vite 6 + TypeScript (SPA)
├── shura-backend/    — Node.js + Express 5 + PostgreSQL + Socket.io
└── docs, SQL migrations, etc.
```

### Frontend Stack
| Component | Technology |
|-----------|-----------|
| Framework | React 19 with TypeScript |
| Build Tool | Vite 6 |
| Routing | react-router-dom v7 |
| Real-time | socket.io-client |
| Dev Port | 3006 |
| Output | Static SPA (`dist/` folder) |

### Backend Stack
| Component | Technology |
|-----------|-----------|
| Runtime | Node.js (Express 5) |
| Database | PostgreSQL (via `pg` driver) |
| Auth | JWT + bcryptjs/argon2 |
| Real-time | Socket.io (WebSocket + HTTP long-poll) |
| File Upload | Cloudinary (via multer) |
| Payments | Razorpay |
| Email | Nodemailer (Gmail SMTP) |
| Port | 5001 (default) |

### Current Deployment Model
- **Frontend**: Targeted for Vercel / Netlify / Azure Static Web Apps (static SPA)
- **Backend**: Targeted for Railway / Render / Azure Container Apps
- **Database**: Managed PostgreSQL (Railway/Azure Flexible Server)
- **CI/CD**: None configured (no `.github/workflows`, no Dockerfile)
- **Containerisation**: None — no Dockerfiles exist yet

### Coupling Analysis
- Frontend communicates with backend via `VITE_API_URL` (REST) and `VITE_WS_URL` (WebSocket)
- In dev, Vite proxies `/api` to the backend — production uses direct URL
- Clean separation: frontend is a pure SPA, backend is a stateless API (except WebSocket state in memory)

---

## 2. Feasibility Assessment

### **Verdict: ✅ YES — Fully Feasible**

Consolidating both frontend and backend into a single Azure Container Apps deployment is straightforward and recommended for this project's scale.

**Rationale:**
1. The frontend is a static SPA that can be served by Express (or nginx) within the same container
2. The backend is already a single Node.js process — no microservices decomposition needed
3. Socket.io works natively on Container Apps (supports WebSocket connections)
4. The coupling via environment variables makes unification trivial
5. No complex build dependencies or platform-specific features block containerisation

---

## 3. Target Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Container Apps                       │
│                    (Container App Environment)                │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Container App: shura-app                      │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────────────────┐   │ │
│  │  │  Node.js (Express 5)                            │   │ │
│  │  │                                                  │   │ │
│  │  │  GET /*  → serves static frontend (dist/)       │   │ │
│  │  │  /api/*  → backend API routes                   │   │ │
│  │  │  WS      → Socket.io (WebRTC signaling)         │   │ │
│  │  └─────────────────────────────────────────────────┘   │ │
│  │                                                         │ │
│  │  Scaling: 0–10 replicas (HTTP/CPU-based)               │ │
│  │  Ingress: External, port 5001, WebSocket enabled       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│  Azure Database for       │     │  Cloudinary (External)    │
│  PostgreSQL Flexible      │     │  File/Image Storage       │
│  Server                   │     │                           │
└──────────────────────────┘     └──────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single container (not sidecar) | App is simple enough; Express serves both static files and API |
| Express serves frontend | Eliminates nginx sidecar complexity; 1 container = simpler ops |
| Scale to zero | Cost savings during low-traffic periods |
| WebSocket transport enabled | Required for Socket.io real-time features |
| Managed PostgreSQL | Don't run DB in containers; use Azure Flexible Server |

### WebSocket Considerations
- Azure Container Apps supports WebSocket with `transport: http` ingress
- Socket.io will work with sticky sessions (single replica) or Redis adapter (multi-replica)
- **For multi-replica scaling**: Add Azure Cache for Redis as Socket.io adapter

---

## 4. Implementation Files

### 4.1 Dockerfile (multi-stage)

See `Dockerfile` at the repo root.

```dockerfile
# ============ Stage 1: Build Frontend ============
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY shura-frontend/package*.json ./
RUN npm ci
COPY shura-frontend/ ./
RUN npm run build

# ============ Stage 2: Production Image ============
FROM node:20-alpine AS production
WORKDIR /app

# Install backend dependencies
COPY shura-backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY shura-backend/ ./

# Copy built frontend into backend's public directory
COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:5001/api/health || exit 1

CMD ["node", "server.js"]
```

### 4.2 Backend Modification (serve static frontend)

Add to `server.js` before the error handler:

```javascript
// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));
  // SPA fallback — serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}
```

### 4.3 GitHub Actions CI/CD Workflow

See `.github/workflows/deploy-aca.yml`.

---

## 5. Benefits & Trade-offs

### Benefits
| Benefit | Impact |
|---------|--------|
| Simplified deployment | 1 container, 1 pipeline, 1 URL |
| No CORS issues | Frontend and API same origin |
| Lower cost | Single Container App, scale-to-zero capable |
| Simpler networking | No cross-service communication |
| Faster CI/CD | One build, one deploy |
| WebSocket just works | Same origin, no proxy config needed |

### Trade-offs
| Trade-off | Mitigation |
|-----------|-----------|
| Frontend + backend coupled deploys | Acceptable at current scale; split later if needed |
| No CDN edge caching for static assets | Add Azure Front Door / CDN later if latency matters |
| Scale-to-zero cold starts (~2-5s) | Set minimum replicas to 1 for production |
| Socket.io with multiple replicas | Add Redis adapter if scaling beyond 1 replica |
| Larger container image | Multi-stage build keeps it under 200MB |

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| WebSocket disconnects during scaling | Medium | Medium | Enable session affinity; add Redis adapter |
| Cold start latency | Low | Low | Min replicas = 1 in prod |
| Database connection pool exhaustion | Low | High | Use `pg` pool with max 20 connections; use Azure PG connection pooler |
| Secrets leakage in CI | Low | Critical | Use GitHub environment secrets + Azure Key Vault references |
| Image size bloat | Low | Low | Multi-stage Docker build; `.dockerignore` |

---

## 7. Recommended Approach

### Repository Structure: Keep Mono-repo ✅
The current mono-repo structure is ideal:
- Both apps share the same repo — simplifies CI/CD
- Single PR for coordinated changes
- Easy to add a root `Dockerfile` that builds both

### Versioning & Rollback
- **Tagging**: Every deploy creates an image tagged with git SHA
- **Rollback**: `az containerapp update --image shuraacr.azurecr.io/shura-app:<previous-sha>`
- **Revision management**: Container Apps keeps previous revisions; instant traffic split possible

### Environment Separation
```
shura-env (Container App Environment)
├── shura-app-staging   (staging revision, separate secrets)
└── shura-app           (production revision, separate secrets)
```

---

## 8. Azure Resources Required

| Resource | SKU/Tier | Estimated Monthly Cost |
|----------|----------|----------------------|
| Container Apps Environment | Consumption | ~$0 (scale to zero) |
| Container App (prod) | 0.5 vCPU / 1 GiB | ~$15-30/mo |
| Container App (staging) | 0.25 vCPU / 0.5 GiB | ~$5-10/mo |
| Azure Container Registry | Basic | ~$5/mo |
| Azure Database for PostgreSQL | Burstable B1ms | ~$13/mo |
| Azure Cache for Redis (optional) | Basic C0 | ~$16/mo |
| **Total** | | **~$38-74/mo** |

---

## 9. Next Steps (Implementation Order)

1. **Create Dockerfile** at repo root (provided above)
2. **Modify `server.js`** to serve static files in production
3. **Add `.dockerignore`** to exclude `node_modules`, `.env`, etc.
4. **Provision Azure resources** (ACR, Container Apps Environment, PostgreSQL)
5. **Configure GitHub secrets** (AZURE_CREDENTIALS, ACR credentials, DB secrets)
6. **Add GitHub Actions workflow** (provided above)
7. **Test locally** with `docker build -t shura-app . && docker run -p 5001:5001 shura-app`
8. **Deploy to staging** → verify → promote to production
9. **Add custom domain + TLS** via Container Apps ingress
10. **Optional**: Add Azure Front Door for CDN/WAF if needed later
