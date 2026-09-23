# Launchpad

Self-service internal developer platform (golden paths).

**Problem:** Creating a new service should not mean hand-writing CI, Docker, Helm, and deploy wiring every time.

**Stack (target):** Backstage (or equivalent portal) · templates · CI · Helm · ArgoCD · Kubernetes (Kind for local)

**Status:** Scaffold — implementation in progress.

## Architecture

Developer portal → “Create service” → repo + Dockerfile + CI + Helm → ArgoCD → cluster

## What this repo will demonstrate

- Golden path for FastAPI/Python (and optionally Node)
- Automated CI + container + deploy manifests
- Preview / rollback story (MVP scope)

## Demo

- Live: _coming soon_ (likely video — full cluster 24/7 is optional)
- Video: _coming soon_

## Run

```bash
# local Kind + portal  (coming soon)
```

## Attribution

Will use an IDP / Backstage lab starter as base; golden paths and docs call out what was added.
