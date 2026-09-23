import './style.css';

type Template = 'fastapi' | 'node' | 'dotnet';
type View = 'home' | 'wizard' | 'pipeline' | 'service';
type StageState = 'pending' | 'active' | 'done';

interface Stage {
  id: string;
  title: string;
  logs: string[];
}

interface ServiceState {
  name: string;
  template: Template;
  url: string;
  cluster: string;
  namespace: string;
  revision: string;
}

const STAGES: Stage[] = [
  {
    id: 'repo',
    title: 'Create repository',
    logs: [
      '$ gh repo create org/{name} --private --template launchpad-{tpl}',
      '<span class="info">→</span> Cloning skeleton…',
      '<span class="ok">✓</span> Repository created: github.com/org/{name}',
      '<span class="ok">✓</span> Default branch: main · CODEOWNERS applied',
    ],
  },
  {
    id: 'docker',
    title: 'Generate Dockerfile',
    logs: [
      '$ launchpad scaffold dockerfile --runtime {tpl}',
      'FROM {base}',
      'WORKDIR /app && COPY . . && {build}',
      '<span class="ok">✓</span> Multi-stage Dockerfile written · .dockerignore synced',
    ],
  },
  {
    id: 'ci',
    title: 'CI pipeline (tests)',
    logs: [
      '$ gh workflow run ci.yml --ref main',
      'jobs: lint → unit → integration → build',
      '<span class="info">→</span> Running 24 tests…',
      '<span class="ok">✓</span> All checks passed · image pushed :sha-a1b2c3d',
    ],
  },
  {
    id: 'helm',
    title: 'Helm chart',
    logs: [
      '$ helm create charts/{name}',
      'values.yaml ← replicas=2, resources, probes, HPA',
      '<span class="ok">✓</span> Chart packaged · values-prod.yaml committed',
    ],
  },
  {
    id: 'argo',
    title: 'ArgoCD sync',
    logs: [
      '$ argocd app create {name} --repo … --path charts/{name}',
      '<span class="info">→</span> Syncing ApplicationSet…',
      'Health: Progressing → Healthy',
      '<span class="ok">✓</span> Synced to cluster · revision {rev}',
    ],
  },
  {
    id: 'k8s',
    title: 'Running on Kubernetes',
    logs: [
      '$ kubectl -n {ns} get pods -l app={name}',
      'NAME                    READY   STATUS    RESTARTS',
      '{name}-7d9f4c-xk2m1     1/1     Running   0',
      '{name}-7d9f4c-p9q3w     1/1     Running   0',
      '<span class="ok">✓</span> Service exposed · Ingress ready',
    ],
  },
];

const TEMPLATE_META: Record<
  Template,
  { label: string; base: string; build: string; desc: string }
> = {
  fastapi: {
    label: 'FastAPI / Python',
    base: 'python:3.12-slim',
    build: 'pip install -r requirements.txt',
    desc: 'ASGI API with uvicorn, pytest, and OpenAPI.',
  },
  node: {
    label: 'Node.js',
    base: 'node:22-alpine',
    build: 'npm ci && npm run build',
    desc: 'Express/Fastify service with TypeScript CI.',
  },
  dotnet: {
    label: '.NET',
    base: 'mcr.microsoft.com/dotnet/aspnet:8.0',
    build: 'dotnet publish -c Release',
    desc: 'ASP.NET Core template (lab label — optional path).',
  },
};

const STAGE_MS = 1600; // ~9.6s for 6 stages

let view: View = 'home';
let serviceName = '';
let template: Template = 'fastapi';
let stageStates: StageState[] = STAGES.map(() => 'pending');
let pipelineTimers: number[] = [];
let showObs = false;
let service: ServiceState | null = null;

const app = document.querySelector<HTMLDivElement>('#app')!;

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'my-service';
}

function fillLogs(stage: Stage, s: ServiceState): string {
  const meta = TEMPLATE_META[s.template];
  return stage.logs
    .map((line) =>
      line
        .replaceAll('{name}', s.name)
        .replaceAll('{tpl}', s.template)
        .replaceAll('{base}', meta.base)
        .replaceAll('{build}', meta.build)
        .replaceAll('{ns}', s.namespace)
        .replaceAll('{rev}', s.revision),
    )
    .join('\n');
}

function clearPipelineTimers(): void {
  pipelineTimers.forEach((id) => window.clearTimeout(id));
  pipelineTimers = [];
}

function toast(msg: string, kind: '' | 'rollback' = ''): void {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  window.setTimeout(() => {
    el.classList.remove('show');
    window.setTimeout(() => el.remove(), 300);
  }, 2800);
}

function renderSidebar(): string {
  return `
    <aside class="sidebar">
      <h2>Golden path</h2>
      <p>
        Launchpad turns “I need a new service” into a single guided flow —
        no copy-paste of Dockerfiles, CI YAML, or Helm charts.
      </p>
      <ol>
        <li>Pick a name and runtime template</li>
        <li>Portal scaffolds repo, container, and CI</li>
        <li>Helm chart + ArgoCD Application are wired automatically</li>
        <li>Cluster sync lands a running workload with rollback</li>
      </ol>
      <p>
        This demo simulates the portal UX end-to-end. In production the same
        stages call GitHub, your registry, and the cluster.
      </p>
      <div class="callout">
        portal → create service<br/>
        → repo + Dockerfile + CI<br/>
        → Helm → ArgoCD → K8s
      </div>
    </aside>
  `;
}

function renderHome(): string {
  return `
    <div class="page-title">Developer portal</div>
    <p class="page-sub">
      Self-service golden paths for shipping services to Kubernetes —
      templates, CI, Helm, and ArgoCD in one flow.
    </p>
    <div class="hero-actions">
      <button type="button" class="btn btn-primary" data-action="create">
        Create Service →
      </button>
      <button type="button" class="btn btn-ghost" data-action="docs">
        View golden path
      </button>
    </div>
    <div class="feature-grid">
      <div class="feature">
        <h3>Templates</h3>
        <p>FastAPI, Node, and optional .NET scaffolds with sane defaults.</p>
      </div>
      <div class="feature">
        <h3>CI + containers</h3>
        <p>Lint, test, build, and push images without hand-written pipelines.</p>
      </div>
      <div class="feature">
        <h3>GitOps deploy</h3>
        <p>Helm charts synced via ArgoCD with preview and rollback.</p>
      </div>
      <div class="feature">
        <h3>Observability</h3>
        <p>SLO-ready wiring so new services land with metrics and alerts.</p>
      </div>
    </div>
  `;
}

function renderWizard(): string {
  const options = (Object.keys(TEMPLATE_META) as Template[])
    .map((key) => {
      const m = TEMPLATE_META[key];
      const optional = key === 'dotnet' ? ' optional' : '';
      const badge = key === 'dotnet' ? '<span class="badge">optional</span>' : '';
      return `
        <label class="template-option${template === key ? ' selected' : ''}${optional}">
          <input type="radio" name="template" value="${key}" ${template === key ? 'checked' : ''} />
          <div class="meta">
            <strong>${m.label}${badge}</strong>
            <span>${m.desc}</span>
          </div>
        </label>
      `;
    })
    .join('');

  return `
    <div class="page-title">Create service</div>
    <p class="page-sub">Name your service and choose a golden-path template.</p>
    <form class="wizard" id="wizard-form">
      <div class="form-group">
        <label for="svc-name">Service name</label>
        <input
          id="svc-name"
          type="text"
          name="name"
          placeholder="payments-api"
          value="${serviceName}"
          autocomplete="off"
          required
          pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]|[a-z0-9]{1,40}"
        />
        <div class="hint">lowercase · hyphens · max 40 chars</div>
      </div>
      <div class="form-group">
        <label>Template</label>
        <div class="template-options">${options}</div>
      </div>
      <div class="wizard-actions">
        <button type="button" class="btn btn-ghost" data-action="home">Cancel</button>
        <button type="submit" class="btn btn-primary">Launch pipeline →</button>
      </div>
    </form>
  `;
}

function renderPipeline(): string {
  const doneCount = stageStates.filter((s) => s === 'done').length;
  const pct = Math.round((doneCount / STAGES.length) * 100);
  const stagesHtml = STAGES.map((stage, i) => {
    const state = stageStates[i];
    const icon =
      state === 'done' ? '✓' : state === 'active' ? '…' : String(i + 1);
    const statusLabel =
      state === 'done' ? 'completed' : state === 'active' ? 'running…' : 'queued';
    const logs =
      service && (state === 'active' || state === 'done')
        ? fillLogs(stage, service)
        : '';
    return `
      <div class="stage ${state}">
        <div class="stage-icon">${icon}</div>
        <div class="stage-body">
          <h3>${stage.title}</h3>
          <div class="stage-status">${statusLabel}</div>
          <div class="log-panel">${logs}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="pipeline-header">
      <div>
        <div class="page-title">Provisioning</div>
        <div class="service-name">${service?.name ?? ''} · ${TEMPLATE_META[template].label}</div>
      </div>
    </div>
    <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
    <div class="stages">${stagesHtml}</div>
  `;
}

function renderObs(): string {
  if (!showObs || !service) return '';
  const bars = Array.from({ length: 24 }, (_, i) => {
    const h = 20 + ((i * 17 + service!.name.length * 3) % 70);
    return `<div class="bar ok" style="height:${h}%"></div>`;
  }).join('');

  return `
    <div class="obs-panel" id="obs-panel">
      <h3>Observability · ${service.name}</h3>
      <p class="obs-sub">Simulated SLO dashboard (Prometheus / Grafana wiring in full stack).</p>
      <div class="slo-grid">
        <div class="slo-card">
          <div class="label">Availability</div>
          <div class="value">99.95%</div>
          <div class="target">SLO ≥ 99.9%</div>
        </div>
        <div class="slo-card">
          <div class="label">Latency p99</div>
          <div class="value">42ms</div>
          <div class="target">SLO ≤ 200ms</div>
        </div>
        <div class="slo-card">
          <div class="label">Error budget</div>
          <div class="value">87%</div>
          <div class="target">remaining this window</div>
        </div>
      </div>
      <div class="label" style="font-family:var(--font-mono);font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-dim);margin-bottom:0.35rem">
        Request rate (1h)
      </div>
      <div class="burn-chart">${bars}</div>
    </div>
  `;
}

function renderService(): string {
  if (!service) return '';
  return `
    <div class="page-title">Service ready</div>
    <p class="page-sub">Golden path complete. Your service is live on the demo cluster.</p>
    <div class="service-card">
      <div class="badge-live">Running</div>
      <h2>${service.name}</h2>
      <div class="url">${service.url}</div>
      <dl class="service-meta">
        <div>
          <dt>Template</dt>
          <dd>${TEMPLATE_META[service.template].label}</dd>
        </div>
        <div>
          <dt>Cluster</dt>
          <dd>${service.cluster}</dd>
        </div>
        <div>
          <dt>Namespace</dt>
          <dd>${service.namespace}</dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>${service.revision}</dd>
        </div>
      </dl>
      <div class="service-actions">
        <button type="button" class="btn btn-danger" data-action="rollback">Rollback</button>
        <button type="button" class="btn btn-primary" data-action="obs">
          ${showObs ? 'Hide Observability' : 'Open Observability'}
        </button>
        <button type="button" class="btn btn-ghost" data-action="create-another">Create another</button>
      </div>
    </div>
    ${renderObs()}
  `;
}

function render(): void {
  let main = '';
  if (view === 'home') main = renderHome();
  else if (view === 'wizard') main = renderWizard();
  else if (view === 'pipeline') main = renderPipeline();
  else main = renderService();

  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <button type="button" class="brand" data-action="home" aria-label="Launchpad home">
          <span class="brand-mark">LP</span>
          Launchpad
          <span class="tag">demo</span>
        </button>
        <div class="topbar-meta">
          <span class="status-pill">cluster healthy</span>
          <span class="hide-sm">org / platform-team</span>
        </div>
      </header>
      <div class="layout">
        <main class="main">${main}</main>
        ${renderSidebar()}
      </div>
    </div>
  `;

  bindEvents();
}

function bindEvents(): void {
  app.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const action = (e.currentTarget as HTMLElement).dataset.action;
      if (action === 'home') {
        clearPipelineTimers();
        view = 'home';
        showObs = false;
        render();
      } else if (action === 'create' || action === 'create-another') {
        clearPipelineTimers();
        view = 'wizard';
        showObs = false;
        service = null;
        stageStates = STAGES.map(() => 'pending');
        render();
      } else if (action === 'docs') {
        document.querySelector('.sidebar')?.scrollIntoView({ behavior: 'smooth' });
      } else if (action === 'rollback') {
        toast('Rollback initiated → previous revision synced via ArgoCD', 'rollback');
      } else if (action === 'obs') {
        showObs = !showObs;
        render();
        if (showObs) {
          window.setTimeout(() => {
            document.getElementById('obs-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 50);
        }
      }
    });
  });

  const form = document.getElementById('wizard-form') as HTMLFormElement | null;
  if (form) {
    form.querySelectorAll<HTMLInputElement>('input[name="template"]').forEach((input) => {
      input.addEventListener('change', () => {
        template = input.value as Template;
        form.querySelectorAll('.template-option').forEach((opt) => {
          opt.classList.toggle(
            'selected',
            (opt.querySelector('input') as HTMLInputElement).value === template,
          );
        });
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = (form.elements.namedItem('name') as HTMLInputElement).value;
      serviceName = slugify(raw);
      const selected = form.querySelector<HTMLInputElement>('input[name="template"]:checked');
      template = (selected?.value as Template) || 'fastapi';

      const rev = `a1b2c3d`;
      service = {
        name: serviceName,
        template,
        url: `https://${serviceName}.apps.launchpad.demo`,
        cluster: 'kind-launchpad',
        namespace: 'apps',
        revision: rev,
      };

      stageStates = STAGES.map(() => 'pending');
      view = 'pipeline';
      showObs = false;
      render();
      runPipeline();
    });
  }
}

function runPipeline(): void {
  clearPipelineTimers();
  let i = 0;

  const advance = () => {
    if (i > 0) {
      stageStates[i - 1] = 'done';
    }
    if (i >= STAGES.length) {
      render();
      window.setTimeout(() => {
        view = 'service';
        render();
      }, 450);
      return;
    }
    stageStates[i] = 'active';
    render();
    i += 1;
    pipelineTimers.push(window.setTimeout(advance, STAGE_MS));
  };

  pipelineTimers.push(window.setTimeout(advance, 200));
}

render();
