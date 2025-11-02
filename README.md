# GitOps Deployment Pipeline with GitHub Actions + ArgoCD

A production-ready CI/CD pipeline implementing GitOps principles to deploy a containerized Node.js application to Azure Kubernetes Service. The pipeline uses GitHub Actions for continuous integration and ArgoCD for continuous deployment, with Git as the single source of truth.

## Overview

This project demonstrates a complete GitOps workflow where all infrastructure state is stored in Git, and ArgoCD continuously monitors the repository to keep the cluster in sync. The CI pipeline builds, tests, and scans container images, then updates Kubernetes manifests in Git. ArgoCD detects these changes and automatically deploys to AKS.

**Key Features:**
- Fully automated CI/CD pipeline
- Security scanning at multiple levels (code, dependencies, container)
- Container testing before deployment
- GitOps-based deployment with ArgoCD
- Security-hardened Kubernetes deployments
- Unique, traceable image tags
- Self-healing cluster state

## Architecture
```
┌──────────────────────────────────────────────────────────────────┐
│                    GitHub Repository                              │
│  ┌────────────────┐              ┌─────────────────┐            │
│  │  Application   │              │   Kubernetes    │            │
│  │     Code       │              │   Manifests     │            │
│  │                │              │                 │            │
│  │  src/          │              │  k8s/           │            │
│  │  Dockerfile    │              │  - deployment   │            │
│  │  tests/        │              │  - service      │            │
│  └────────┬───────┘              └────────┬────────┘            │
└───────────┼──────────────────────────────┼──────────────────────┘
            │                              │
    Push triggers                    ArgoCD watches
            │                              │
            ▼                              │
┌────────────────────────────┐             │
│   GitHub Actions (CI)      │             │
│                            │             │
│  1. Install dependencies   │             │
│  2. Run linting & tests    │             │
│  3. Security audit         │             │
│  4. Trivy filesystem scan  │             │
│  5. Build Docker image     │             │
│  6. Test container         │             │
│  7. Trivy image scan       │             │
│  8. Push to ACR            │             │
│  9. Update manifest in Git │◄────────┐   │
└────────────┬───────────────┘         │   │
             │                         │   │
             │  Commit manifest        │   │
             │  update back to Git     │   │
             └─────────────────────────┘   │
                                           │
                                           │
┌──────────────────────────────────────────┼──────────────────────┐
│              ArgoCD (CD)                 │                      │
│                                          │                      │
│  Continuously monitors Git repo          │                      │
│  Detects manifest changes               │                      │
│  Automatically syncs to AKS             │                      │
│  Self-heals drift                       │                      │
└──────────────────────────────────────────┼──────────────────────┘
                                           │
                                           ▼
                                 ┌─────────────────┐
                                 │   AKS Cluster   │
                                 │                 │
                                 │  Pods running   │
                                 │  Latest version │
                                 └─────────────────┘
```

## Tech Stack

**Application:**
- Node.js 18
- Express.js
- Simple REST API

**Infrastructure:**
- Azure Kubernetes Service (AKS)
- Azure Container Registry (ACR)
- GitHub Actions (CI)
- ArgoCD (CD)

**Tools:**
- Docker (containerization)
- Trivy (security scanning)
- kubectl (Kubernetes management)
- ArgoCD CLI

## How It Works

### The GitOps Flow

**Step 1: Developer pushes code**
```bash
git add .
git commit -m "Add new feature"
git push origin main
```

**Step 2: GitHub Actions CI pipeline runs**
- Installs dependencies
- Runs ESLint for code quality
- Executes unit tests with coverage
- Performs npm audit for vulnerable dependencies
- Scans filesystem with Trivy
- Builds Docker image with unique tag (SHA + timestamp)
- Tests the actual container
- Scans the Docker image with Trivy (fails on CRITICAL vulnerabilities)
- Pushes image to Azure Container Registry

**Step 3: GitHub Actions updates Kubernetes manifest**
- Updates `k8s/deployment.yaml` with new image tag
- Commits the change back to the Git repository
- Uses skip-ci logic to prevent infinite loops

**Step 4: ArgoCD detects and syncs**
- ArgoCD continuously watches the Git repository
- Detects the manifest change
- Automatically syncs the new deployment to AKS
- Kubernetes performs rolling update with zero downtime

**Result:** New version is live in production

### Why This Approach

**GitOps Benefits:**
- **Single source of truth:** Git contains both application code and deployment state
- **Audit trail:** Every deployment is a Git commit with full history
- **Easy rollbacks:** Just `git revert` and ArgoCD syncs the previous state
- **Drift prevention:** ArgoCD's self-heal ensures cluster matches Git
- **Security:** CI/CD pipeline doesn't need cluster credentials

**Separation of concerns:**
- GitHub Actions handles CI (build, test, package)
- ArgoCD handles CD (deploy, sync, heal)
- Clear boundary between "build quality" and "deployment"

## Prerequisites

- Azure subscription with:
  - AKS cluster running
  - Azure Container Registry created
  - Service principal or managed identity for GitHub Actions
- GitHub repository
- kubectl installed locally
- ArgoCD installed in your AKS cluster

## Setup Instructions

### 1. Install ArgoCD in AKS
```bash
# Create ArgoCD namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Access ArgoCD UI (port-forward method)
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Login to ArgoCD
argocd login localhost:8080
```

### 2. Configure GitHub Secrets

In your repository: **Settings → Secrets and variables → Actions**

Add these secrets:
```
ACR_LOGIN_SERVER: yourregistry.azurecr.io
ACR_USERNAME: <service-principal-id>
ACR_PASSWORD: <service-principal-password>
GIT_TOKEN: <github-personal-access-token>
```

**GitHub token needs these permissions:**
- `repo` (full control)
- `workflow` (update GitHub Actions)

### 3. Create ArgoCD Application

**Option A: Using ArgoCD CLI**
```bash
argocd app create mynodeapp \
  --repo https://github.com/YOUR_USERNAME/YOUR_REPO.git \
  --path k8s \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace default \
  --sync-policy automated \
  --auto-prune \
  --self-heal
```

**Option B: Using YAML manifest**
```bash
kubectl apply -f argocd/application.yaml
```

### 4. Verify Setup
```bash
# Check ArgoCD application status
argocd app get mynodeapp

# Check pods in cluster
kubectl get pods

# Check service
kubectl get svc

# Get external IP
kubectl get svc mynodeapp-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

## Project Structure
```
.
├── .github/
│   └── workflows/
│       └── ci-pipeline.yml       # GitHub Actions pipeline
├── argocd/
│   └── application.yaml          # ArgoCD Application manifest
├── k8s/
│   ├── deployment.yaml           # Kubernetes Deployment
│   ├── service.yaml              # Kubernetes Service
│   └── namespace.yaml            # Namespace definition
├── src/
│   ├── routes/
│   ├── app.js                    # Express application
│   ├── server.js                 # Server entry point
│   └── package.json
├── tests/
│   └── app.test.js               # Unit tests
├── Dockerfile                    # Multi-stage Docker build
├── .dockerignore
└── README.md
```

## Key Components

### GitHub Actions Pipeline

**Job 1: Build, Test & Security Scan**
- Installs Node.js dependencies
- Runs ESLint for code quality
- Executes unit tests with code coverage
- Performs npm security audit
- Scans filesystem with Trivy (fails on CRITICAL)
- Builds Docker image with caching
- Tests the running container
- Scans Docker image with Trivy
- Pushes to ACR with unique tag

**Job 2: Update Kubernetes Manifest**
- Updates `k8s/deployment.yaml` with new image tag
- Commits change back to repository
- Skip-ci logic prevents infinite loops

**Job 3: Deployment Notification**
- Generates GitHub Actions summary
- Shows deployment details (image, commit, deployer)

### Image Tagging Strategy

Images are tagged with: `<git-sha>-<timestamp>`

Example: `abc1234-20250102-143522`

**Why:**
- **Traceability:** Can map any deployed version to exact Git commit
- **Uniqueness:** No tag conflicts even with rapid deployments
- **Chronological ordering:** Timestamp shows deployment sequence
- **GitOps requirement:** Manifest must change for ArgoCD to detect updates

Using `:latest` would break GitOps since the manifest wouldn't change.

### Security Features

**Container Security Context:**
```yaml
securityContext:
  runAsNonRoot: true              # Prevents privilege escalation
  runAsUser: 1001                 # Specific non-root user
  readOnlyRootFilesystem: true    # Prevents malware installation
  allowPrivilegeEscalation: false # Blocks privilege escalation
  capabilities:
    drop:
      - ALL                       # Removes all Linux capabilities
```

**Why this matters:**
- Limits damage if container is compromised
- Prevents attackers from installing malicious code
- Restricts administrative operations
- Industry best practice for production workloads

**Scanning at Multiple Levels:**
- Code dependencies (npm audit)
- Filesystem (Trivy scan)
- Container image (Trivy scan)
- Critical vulnerabilities block deployment

### ArgoCD Configuration

**Sync Policy:**
```yaml
syncPolicy:
  automated:
    prune: true      # Removes resources deleted from Git
    selfHeal: true   # Reverts manual changes back to Git
  syncOptions:
    - CreateNamespace=true
  retry:
    limit: 5
    backoff:
      duration: 5s
      factor: 2
      maxDuration: 3m
```

**Self-Heal in Action:**
- Someone manually scales deployment: ArgoCD scales back to Git value
- Someone changes image tag: ArgoCD reverts to Git-specified image
- Someone deletes a service: ArgoCD recreates from Git
- Git is ALWAYS the source of truth

## Testing the Application

After deployment, get the external IP:
```bash
kubectl get svc mynodeapp-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

**Test the API:**
```bash
# Health check
curl http:///health

# Get data
curl http:///

# Check version info
curl http:///health | jq .
```

## Troubleshooting

### Pipeline keeps running in a loop

**Problem:** GitHub Actions triggers itself infinitely

**Cause:** Manifest update commits trigger new pipeline runs

**Solution:** The pipeline already has skip-ci logic. Verify:
```yaml
if: github.actor != 'github-actions[bot]' && !contains(github.event.head_commit.message, '[skip ci]')
```

### ArgoCD shows "OutOfSync"

**Problem:** Cluster state differs from Git

**Investigation:**
```bash
# Check the diff in ArgoCD UI or CLI
argocd app diff mynodeapp

# See what changed
kubectl get deployment mynodeapp -o yaml

# Check recent events
kubectl get events --sort-by='.lastTimestamp'
```

**Solution:**
- If drift was accidental: Click "Sync" in ArgoCD UI
- If change was intentional: Update Git to match
- Self-heal should have prevented this (check sync policy)

### Pods are crashlooping

**Investigation steps:**
```bash
# Check pod status
kubectl get pods

# Check application logs (MOST IMPORTANT)
kubectl logs 
kubectl logs  --previous  # If pod already restarted

# Check Kubernetes events
kubectl describe pod 

# Check ArgoCD UI
# Shows deployment status and recent sync activity
```

**Common causes:**
- Missing environment variable
- Database connection failure
- Port binding error
- Code error introduced in latest commit

**Quick rollback:**
```bash
git revert 
git push
# ArgoCD will sync to previous working state
```

### Image pull errors

**Problem:** `ImagePullBackOff` or `ErrImagePull`

**Check:**
```bash
# Verify image exists in ACR
az acr repository show-tags --name  --repository mynodeapp

# Check AKS has pull permissions
az aks check-acr --name  --resource-group  --acr 
```

**Solution:**
- Ensure service principal has AcrPull role
- Verify image tag in manifest matches pushed image

### GitHub Actions fails on Trivy scan

**Problem:** `exit code 1` on Trivy step

**Cause:** Critical vulnerability found in image

**Solution:**
1. Check Trivy output in GitHub Actions logs
2. Update vulnerable dependency in `package.json`
3. Rebuild and push
4. Or: Use `--severity HIGH,CRITICAL --exit-code 0` to warn but not fail

## Design Decisions

### Why GitHub Actions + ArgoCD (not just one tool)?

**Separation of concerns:**
- **GitHub Actions (CI):** Knows about code quality (tests, lints, scans)
- **ArgoCD (CD):** Knows about cluster state

**Benefits:**
- CI doesn't need cluster credentials (more secure)
- ArgoCD runs in-cluster (pull model, not push)
- Each tool does what it's best at

### Why update manifest in Git vs ArgoCD Image Updater?

**I chose CI-driven manifest updates because:**
- Deployment is gated by build quality (tests pass, scans pass)
- ArgoCD Image Updater just polls the registry without context
- Clear commit history showing what deployed when
- Developers cloning the repo see actual production state

**Trade-off:** Requires GitHub Actions to commit back to Git

### Why monorepo vs separate repos?

**Monorepo (what I used):**
- **Pros:** Simpler management, atomic changes (code + manifest in same commit), single PR
- **Cons:** Everyone with code access has manifest access

**For production at scale:**
- Separate repos gives better access control
- App developers can't accidentally modify prod manifests
- But for learning/small teams, monorepo is simpler

## What I Learned

Building this project taught me:

**GitOps is more than just "Git + Kubernetes"**
- It's a mindset where Git is the source of truth for everything
- Drift detection and self-healing are powerful
- Rollbacks become trivially easy (git revert)

**Security should be layered**
- Scan at multiple levels (code, dependencies, image)
- Runtime security (non-root, read-only filesystem, dropped capabilities)
- Each layer catches different issues

**CI/CD separation makes sense**
- CI focuses on build quality
- CD focuses on deployment correctness
- Clear boundary improves security and debugging

**The "infinite loop" problem is real**
- When your pipeline commits back to Git, it can trigger itself
- Need explicit skip-ci logic
- Easy to miss until it happens

## Future Improvements

Things I'd add with more time:

- [ ] Multiple environments (dev, staging, prod)
- [ ] Approval gates for production deployments
- [ ] Slack/Teams notifications for deployments
- [ ] Prometheus + Grafana for monitoring
- [ ] Helm charts instead of raw YAML
- [ ] Progressive delivery (canary deployments)
- [ ] Automated rollback on failed health checks
- [ ] Multi-region deployment with ApplicationSets

## Resources

- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [GitOps Principles](https://opengitops.dev/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Trivy Security Scanner](https://aquasecurity.github.io/trivy/)
- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/pod-security-standards/)

## License

MIT

---

**Built as part of my DevOps learning journey. This is a working, production-ready implementation of GitOps principles using modern tools.**