# Runestone Web UI Overhaul

This document describes the planned redesign of the Runestone web application UI layer. It is the source of truth for scope, constraints, and execution order. Update it as decisions are made (headless library, icon set, routing) and as phases complete.

## Goals

- **Desktop-first browser experience** — Optimize for an enjoyable, polished UI/UX in the browser. A separate native mobile app may come later; the web app is not responsible for mobile layouts.
- **Complete visual overhaul** — New look and feel, not a reskin of the current design. The ambient-star aesthetic and current component styling are not constraints.
- **Preserve the product core** — Crypto, sync, storage, search, graph, and editor behavior stay intact. Only the presentation layer and closely related orchestration in views/components are in scope.

## Non-goals (for this effort)

- Native or hybrid mobile app
- PWA installability, offline service workers, or app-manifest “add to home screen” flows
- Supporting viewports narrower than 1024px (see [Viewport policy](#viewport-policy))
- Rewriting `services/`, `stores/session.ts`, or backend APIs unless a UI need forces a small, justified API change

---

## Viewport policy

| Viewport | Behavior |
|----------|----------|
| **&lt; 1024px** | Application is **not usable**. Show a dedicated “unsupported viewport” screen (no auth, no codex, no editor). |
| **≥ 1024px** | Full application. Layouts, sidebars, and panels should be **responsive** within this range (e.g. 1024px laptop through ultrawide). |

Implementation notes:

- Remove the current mobile codex shell (`MobileCodex.vue`) and the `useIsMobile()` / `CodexWrapper` split.
- Replace `vmin`-based root scaling tuned for phones (`global.css` mobile `@media`) with a desktop-oriented typography and spacing system.
- Resize/collapse sidebars and panels at breakpoints **≥ 1024px only**; do not add sub-1024 layout variants.

---

## What stays vs. what changes

### Keep (do not rewrite unless required)

| Area | Location | Role |
|------|----------|------|
| Cryptography & workers | `src/services/cryptography/`, `src/workers/` | E2E encryption |
| Storage & sync | `src/services/l1-storage/`, `l2-storage/`, `file-io/`, orchestration | OPFS, remote blobs, sync |
| Database / FTS / graph | `src/services/database/`, `search/`, `graph/` | SQLite WASM, indexes |
| Session | `src/stores/session.ts` | Auth, codex lifecycle, settings |
| Data composables | `src/composables/useCodex.ts`, `useEditor.ts`, `useMediaUpload.ts`, `useSettings.ts`, `useTheme.ts` | Business logic API for UI |
| Router shape | `src/router/index.ts` | Routes and guards (components may change) |
| Build essentials | SQLite copy plugin, COOP/COEP headers in `vite.config.ts` | Required for WASM (not PWA-related) |

### Replace or heavily rework

| Area | Location | Notes |
|------|----------|--------|
| Views | `src/views/` | Auth, codex selection, main codex workspace |
| Components | `src/components/**` | Base, codex shell, editor chrome, form controls |
| Global styles | `src/global.css`, `App.vue`, `Wrapper.vue` | New design tokens and layout |
| PWA | `vite-plugin-pwa`, `index.html` meta, `dev-dist/` artifacts | Remove entirely |

Approximate current UI surface: **~17,500 lines** of `.vue` across views and components. The main codex view (`Codex.vue` ~2,100 lines) and the mobile duplicate (`MobileCodex.vue` ~3,800 lines) are the largest targets for decomposition, not copy-paste migration.

---

## Open decisions

Record choices here when made; link to PR or commit.

| Decision | Choice | Status |
|----------|--------|--------|
| **Headless UI library** | **[Reka UI](https://reka-ui.com/)** (`reka-ui`) | **Decided** — Modal, Dropdown, Context menu, Command palette, focus traps, a11y |
| **Icon set** | **[Lucide](https://lucide.dev/)** (`@lucide/vue`) | **Decided** — tree-shaken named icon imports; replace inline SVGs in shell and primitives |
| **Routing / `CodexWrapper`** | Direct route to `Codex.vue` | **Done (Phase 1)** — `/codex/*` routes to `Codex.vue` |
| **Visual direction** | Typography, color, density, motion | **TBD** — complete overhaul; no requirement to keep current dark + accent palette |

---

## Phased execution plan

Work proceeds in phases so the app remains buildable and reviewable. Each phase should land as one or more focused PRs.

### Phase 0 — Tracking and baseline

**Objective:** Everyone agrees on scope and order.

- [x] Add this `CHANGES.MD` document
- [ ] Optional: capture “before” screenshots or short screen recordings for Auth, Codex selection, Codex workspace (for comparison only)

**Exit criteria:** Document reviewed; Phase 1 can start without design blockers.

---

### Phase 1 — Remove PWA and mobile paths

**Objective:** Single desktop code path; no service worker or parallel mobile UI.

**Tasks:**

1. **PWA removal** ✓
   - [x] Remove `vite-plugin-pwa` from `services/web_app/package.json`
   - [x] Remove `VitePWA({ ... })` from `services/web_app/vite.config.ts`
   - [x] Strip PWA-related tags from `services/web_app/index.html` (`theme-color`, `mobile-web-app-capable`, Apple web app meta, `apple-touch-icon`)
   - [x] Delete or gitignore generated `services/web_app/dev-dist/` (service worker artifacts; already in root `.gitignore`)
   - [x] Run install/build to confirm no SW registration in production bundle

2. **Mobile UI removal** ✓
   - [x] Delete `src/views/MobileCodex.vue`
   - [x] Delete `src/composables/useMediaQuery.ts`
   - [x] Remove `CodexWrapper.vue`; route `/codex/*` directly to `Codex.vue`
   - [x] Remove mobile-specific branches in `src/components/editor/BubbleMenu.vue` (`detectMobile`, `visualViewport`, `is-mobile` class, etc.)

3. **Viewport gate** ✓
   - [x] Add an **unsupported viewport** view or layout guard: if `window.innerWidth < 1024`, show static message; do not mount main app routes
   - [x] Remove `global.css` rule that rescales root font for `max-width: 1023px`

4. **Cleanup** ✓
   - [x] Remove `@media` rules that only exist for sub-1024 layouts (`Toast.vue`, `CodexSelection.vue`, `AmbientBackground.vue`)
   - [x] Update README (desktop browser positioning; removed cross-platform / mobile framing)

**Exit criteria:** `npm run build` succeeds; no PWA plugin; no `MobileCodex`; narrow windows see unsupported screen only; desktop codex still works at ≥1024px with existing UI.

**Risk:** Low — mostly deletions.

---

### Phase 2 — Design system and primitives

**Objective:** New visual language and reusable building blocks before rewriting full screens.

**Tasks:**

1. **Design tokens**
   - Redefine CSS variables in `global.css` (color, type scale, spacing, radii, shadows, motion)
   - Align `useTheme.ts` and `utils/themePresets.ts` with new token set
   - Desktop-oriented sizing (no `vmin` phone scaling as primary rhythm)

2. **Headless library** — Reka UI (`reka-ui`)
   - Add dependency; wrap or compose Reka primitives in `components/ui/`
   - Implement: Button, Input, Dialog/Modal, Dropdown/Menu, Tooltip, Command palette shell

3. **Icon set** — Lucide (`@lucide/vue`)
   - Add dependency; establish import pattern (named icon components, tree-shaken)
   - Replace inline SVGs in new primitives first; migrate shell icons in Phase 3

4. **Layout shell**
   - New `Wrapper` / app chrome (replace or simplify `AmbientBackground` per new art direction)
   - Toast, loader, transitions consistent with new system
   - Optional: dev-only style guide route to preview tokens and primitives

5. **Unsupported viewport screen**
   - Final visual design for sub-1024 message (can ship minimal in Phase 1, polish here)

**Exit criteria:** Tokens documented; primitives usable in isolation; `reka-ui` + `@lucide/vue` integrated; visual direction decided or explicitly deferred with interim tokens; no requirement to migrate full Codex yet.

**Risk:** Medium — blocks Phase 3; **visual direction** is the remaining Phase 2 blocker.

---

### Phase 3 — Screen rewrite (views)

**Objective:** Rebuild user-facing flows on top of Phase 2 primitives and existing composables.

**Recommended order:**

1. **Auth** (`Auth.vue`) — Smallest surface; validates forms, loading, errors, motion
2. **Codex selection** (`CodexSelection.vue`) — List/create codex; navigation to workspace
3. **Codex workspace** — Largest effort; decompose current `Codex.vue` responsibilities:
   - **Layout:** ribbon, sidebars, top bar, tabs, editor area, status bar, right outline
   - **Composables (new or extracted):** tab state, tab history, rune tree, status bar, keyboard shortcuts wiring
   - **Keep calling:** `useCodex`, `useEditor`, `useMediaUpload`, `useSettings`
   - **Graph / search panels:** Rebuild UI; keep `useCodex` search hooks and graph services

**Routing (TBD):** When shell layout is fixed, either:

- Route directly to one `Codex.vue` (or renamed view), or
- Keep a thin wrapper only for layout providers — not for mobile/desktop switch

**Exit criteria:** All three flows match new design; feature parity with current desktop app (edit, save, sync, search, graph, settings, export, command palette, etc.); no dependency on deleted mobile code.

**Risk:** High — schedule incremental PRs per screen or per codex sub-area (e.g. sidebars first, then editor chrome).

---

### Phase 4 — Polish, accessibility, and cleanup

**Objective:** Production-quality desktop experience.

**Tasks:**

- Keyboard navigation and focus order across new shell
- Consistent empty/loading/error states
- Remove dead components and unused CSS
- Audit responsive behavior from 1024px to large monitors (sidebar collapse, panel widths)
- Performance pass (icon bundle size, code-splitting, graph panel)
- Update README banner/marketing copy if UI positioning changes

**Exit criteria:** No orphaned files from old UI; a11y spot-check on modals/menus; responsive desktop layouts verified.

---

## Suggested folder direction (after Phase 2)

Not final until visual direction and shell are settled:

```
services/web_app/src/
  components/
    ui/          # Primitives (buttons, inputs, dialogs) — Reka UI–backed
    icons/       # Optional thin wrappers; prefer direct `@lucide/vue` imports
    codex/       # Feature-specific codex shell pieces
    editor/      # Editor-adjacent UI (bubble menu, palettes)
  composables/   # Existing + extracted useTabs, useRuneTree, etc.
  views/         # Route-level pages only
```

---

## Dependency and config checklist (Phase 1)

| Item | Action |
|------|--------|
| `vite-plugin-pwa` | Remove |
| `VitePWA` in `vite.config.ts` | Remove |
| PWA meta in `index.html` | Remove |
| `dev-dist/` | Delete / ignore |
| `MobileCodex.vue` | Deleted |
| `useMediaQuery.ts` / `useIsMobile` | Deleted |
| `CodexWrapper.vue` | Deleted; routes use `Codex.vue` |
| COOP/COEP + SQLite plugins | **Keep** |

---

## How to use this document

1. Check off phase tasks in PR descriptions referencing `CHANGES.MD`.
2. When a TBD decision is made, update [Open decisions](#open-decisions-tbd) and note it at the top of the relevant phase.
3. If scope grows (e.g. new feature in UI only), add it under the appropriate phase or a new “Phase 5” section rather than ad hoc work.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-23 | Initial plan: desktop ≥1024px, PWA/mobile removal, visual overhaul, phased approach; headless library and icon set TBD |
| 2026-05-28 | Phase 1 part 1 (PWA removal) and part 2 (mobile UI removal) complete |
| 2026-05-29 | Phase 1 part 3 (viewport gate, unsupported screen, remove sub-1024 root font scaling) |
| 2026-05-29 | Phase 1 part 4 (sub-1024 CSS cleanup, README update); Phase 1 complete |
| 2026-05-29 | Pre–Phase 2 decisions: headless = Reka UI (`reka-ui`), icons = Lucide (`@lucide/vue`); visual direction still TBD |
