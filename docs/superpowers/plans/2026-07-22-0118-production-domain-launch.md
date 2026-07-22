# WORK ORDER 0118 Production Domain Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the approved Lazy A experience at `https://www.lazyaproductions.com/` without changing any visitor-facing pixels or behavior.

**Architecture:** Keep GitHub Actions and GitHub Pages as the hosting path. Make the static-export base path an explicit deployment input, build the production artifact at the origin root, attach `www.lazyaproductions.com` to the existing Pages site, then migrate the GoDaddy DNS records with a recorded rollback snapshot. The apex domain redirects to `www`; HTTPS is mandatory.

**Tech Stack:** Next.js static export, GitHub Actions, GitHub Pages REST API, GoDaddy DNS, Playwright verification.

## Global Constraints

- No room, camera, composition, media, copy, timing, navigation, or interaction changes.
- The approved R5 experience must remain behaviorally identical.
- The production origin is exactly `https://www.lazyaproductions.com/`.
- `https://lazyaproductions.com/` must redirect to the `www` origin.
- HTTPS must be provisioned and enforced before launch completion.
- Preserve a complete pre-cutover DNS snapshot and a tested rollback path.
- Do not claim completion until the actual custom domain passes the live browser battery.

---

### Task 1: Root-Path Static Export Contract

**Files:**
- Modify: `next.config.ts`
- Modify: `.github/workflows/studio-pages.yml`
- Create: `scripts/verify-production-origin.mjs`

**Interfaces:**
- Consumes: `STATIC_EXPORT=1` and `PAGES_BASE_PATH` from the deployment environment.
- Produces: a root-hosted `out/` artifact whose HTML and public-asset URLs contain no `/lazy-a` prefix.

- [ ] **Step 1: Add a failing generated-artifact verifier**

The verifier must recursively inspect exported HTML, CSS, JavaScript, and JSON text assets; reject `/lazy-a/_next`, `/lazy-a/room`, `/lazy-a/studio`, and `NEXT_PUBLIC_BASE_PATH:"/lazy-a"`; require root `/_next/` and `/room/` references in the generated artifact.

- [ ] **Step 2: Prove the current production-shaped export fails**

Run:

```bash
STATIC_EXPORT=1 npm run build
node scripts/verify-production-origin.mjs out
```

Expected: verifier exits non-zero because the current export contains `/lazy-a` URLs.

- [ ] **Step 3: Parameterize the static export base path**

`next.config.ts` must normalize `PAGES_BASE_PATH`, reject malformed values, omit `basePath` for the empty production-root value, and expose the same value as `NEXT_PUBLIC_BASE_PATH` for raw media URLs.

- [ ] **Step 4: Make Pages build the production-root artifact**

Set `PAGES_BASE_PATH: ""` in the workflow's static-export step. Do not add a repository `CNAME` file; GitHub Actions Pages deployments store the custom domain in repository Pages settings.

- [ ] **Step 5: Prove the root artifact passes**

Run:

```bash
STATIC_EXPORT=1 PAGES_BASE_PATH="" npm run build
node scripts/verify-production-origin.mjs out
```

Expected: build and verifier exit zero.

### Task 2: Local Root-Origin Regression Battery

**Files:**
- Modify: `tasks/todo.md`

**Interfaces:**
- Consumes: the production-root `out/` artifact from Task 1.
- Produces: behavioral proof that changing the origin path did not change the experience.

- [ ] **Step 1: Serve the exact static artifact at an unused local port**

Run a static server from `out/`; do not verify against the development server.

- [ ] **Step 2: Run source and build gates**

Run TypeScript, targeted ESLint, deployment-origin verification, atomic compositor source verification, and `git diff --check`.

- [ ] **Step 3: Run the visitor battery**

Run arrival continuity, hero lifecycle, camera states, physical navigation, dwell, CONTACT reveal, compositor resilience, fallbacks, clock, and performance against the root-hosted artifact.

- [ ] **Step 4: Capture a launch-candidate still**

Save a settled custom-origin candidate capture under `docs/progress/0118-*` for the audit trail.

### Task 3: GitHub Pages Custom-Domain Attachment

**Files:**
- No source files.

**Interfaces:**
- Consumes: pushed root-origin artifact and repository admin access.
- Produces: GitHub Pages custom-domain state for `www.lazyaproductions.com`.

- [ ] **Step 1: Commit and push the root-origin build contract**

Stage only Task 1, Task 2, and standard audit files; leave unrelated untracked captures untouched.

- [ ] **Step 2: Wait for the Pages workflow**

Require successful build and deploy jobs for the launch commit.

- [ ] **Step 3: Verify domain ownership where available**

Use GitHub account domain verification or add the requested TXT record before the traffic records when GitHub exposes a verification challenge.

- [ ] **Step 4: Attach the custom domain before DNS migration**

Set repository Pages `cname` to `www.lazyaproductions.com` and confirm GitHub reports the intended custom domain.

### Task 4: GoDaddy DNS Cutover

**Files:**
- Create: `docs/progress/0118-dns-before.txt`
- Create: `docs/progress/0118-dns-after.txt`

**Interfaces:**
- Consumes: authenticated GoDaddy DNS access and GitHub's configured custom domain.
- Produces: `www` CNAME to `jla22492.github.io` and apex GitHub Pages records.

- [ ] **Step 1: Record the complete pre-cutover DNS state**

Capture the current apex, `www`, TXT, MX, CAA, and nameserver answers. Do not alter mail records.

- [ ] **Step 2: Replace only website-routing records**

Set `www` CNAME directly to `jla22492.github.io`. Replace the existing GoDaddy apex website records with GitHub Pages' four documented A records. Preserve unrelated DNS records.

- [ ] **Step 3: Record and verify post-cutover DNS**

Require public resolvers to return GitHub's intended answers. If propagation or configuration fails, restore the recorded GoDaddy website records.

### Task 5: HTTPS And Production-Domain Acceptance

**Files:**
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/BUILD_REPORT.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `tasks/todo.md`
- Modify: `tasks/lessons.md`
- Create: `docs/progress/0118-production-live.jpg`

**Interfaces:**
- Consumes: propagated DNS, Pages custom-domain state, and the exact launch commit.
- Produces: the audited public production site and completion record.

- [ ] **Step 1: Wait for certificate provisioning and enforce HTTPS**

Require the Pages API to report `https_enforced: true` and the browser to receive a valid certificate without mixed content.

- [ ] **Step 2: Verify canonical redirects and root assets**

Require HTTP to redirect to HTTPS, apex to redirect to `www`, `/studio/` to load, and all application/media requests to remain on the production origin without `/lazy-a` path leakage.

- [ ] **Step 3: Run the complete public battery**

Run the same arrival, hero, CONTACT, camera, navigation, dwell, fallback, resilience, clock, and performance gates against `https://www.lazyaproductions.com/`.

- [ ] **Step 4: Visually inspect desktop and phone production captures**

Compare the real-domain frames with the approved R5 evidence. Any visible difference blocks completion.

- [ ] **Step 5: Close the standard artifacts**

Record the launch commit, Pages workflow, DNS before/after evidence, HTTPS state, public metrics, enumerated acceptance audit, rollback path, and exact production URL. Commit and push the final audit.

## Self-Review

- Spec coverage: root-path build, DNS safety, custom-domain ordering, HTTPS, apex redirect, full live verification, rollback, and standard artifacts are all assigned to explicit tasks.
- Placeholder scan: no deferred implementation placeholders or unowned follow-ups.
- Type consistency: `PAGES_BASE_PATH` is the sole deployment input and `NEXT_PUBLIC_BASE_PATH` remains the runtime asset-path output.
