# Launchpad

Self-service internal developer platform (golden paths) — interactive demo.

**Live:** https://alexdelgadillosan.github.io/launchpad/

**Problem:** Creating a new service should not mean hand-writing CI, Docker, Helm, and deploy wiring every time.

**Stack (target):** Developer portal · templates · CI · Helm · ArgoCD · Kubernetes

## What this demo shows

1. Portal home with **Create Service**
2. Wizard: service name + template (FastAPI / Node / optional .NET)
3. Animated provisioning pipeline (~10s):
   - Create repo → Dockerfile → CI (tests) → Helm chart → ArgoCD sync → Running on Kubernetes
4. Fake stage logs
5. Service card with mock URL, **Rollback**, and **Open Observability** (SLO panel)
6. Golden path explanation sidebar

This is a client-side simulation of the golden path UX for portfolio demos. A full Kind/Backstage stack is optional for deeper labs.

## Architecture

```
Developer portal → “Create service”
  → repo + Dockerfile + CI + Helm
  → ArgoCD sync
  → Kubernetes
```

## Run locally

```bash
npm install
npm run dev
```

Build for GitHub Pages (`base: /launchpad/`):

```bash
npm install
npm run build
npm run preview
```

## Deploy

Pushes to `main` build and publish via [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml).

Enable **Settings → Pages → Source: GitHub Actions** on the repo.

## Attribution

Portfolio demo of an IDP golden-path portal. Stages and logs are simulated; production wiring would call GitHub, a container registry, Helm, and ArgoCD against a real cluster.
