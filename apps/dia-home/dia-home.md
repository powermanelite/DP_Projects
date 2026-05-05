# dia-home

## Overview

The Home tab is a personal portfolio landing page. It presents Diamond Phu's professional bio, work experience at NAVAIR, education at UC Santa Cruz, programming languages and technology skills, and links to LinkedIn, GitHub, and a downloadable resume PDF. It is a fully static, read-only component with no user interaction beyond link clicks.

## Architecture

`dia-home` is a React 19 library package (`@dia/home`) consumed by the `dia-website` shell. It has no router of its own — the shell mounts it as a tab by importing and rendering the default export.

```
DP_Projects/
└── apps/
    ├── dia-home/               ← this package
    │   ├── src/
    │   │   ├── Home.tsx        ← single component, entire feature
    │   │   ├── Home.css        ← scoped styles
    │   │   ├── index.ts        ← re-exports Home as default
    │   │   └── main.tsx        ← standalone dev entry (not used in prod)
    │   └── public/
    │       └── Diamond_Phu_Resume.pdf
    └── dia-website/
        └── src/App.tsx         ← imports @dia/home and renders <Home />
```

Package alias: `@dia/home` → `apps/dia-home/src` (resolved via `dia-website/vite.config.js`).

## Key files

| File | Purpose |
|---|---|
| `src/Home.tsx` | The entire feature in one component. All content (experience, education, skills) is hardcoded as JS constants at the top of the file. |
| `src/index.ts` | `export { default } from './Home.tsx'` — the package boundary. |
| `src/Home.css` | Layout and visual styles for hero, experience cards, skill badges, and the CTA section. |
| `public/Diamond_Phu_Resume.pdf` | Served as a static asset. Referenced via `RESUME_URL = '/Dia_serve/Diamond_Phu_Resume.pdf'` for the standalone dev server; the shell's `public/Diamond_Phu_Resume.pdf` is used in production. |

## Data flow

`Home` takes **no props and emits no events**. It is entirely self-contained:

```
dia-website App.tsx
  └── {activeTab === 'home' && <Home />}
        └── renders static content; links open in new tabs
```

No state is lifted to the shell. No cross-tab communication.

## State shape

No component state. No types from `@dia/shared` are consumed. All content is module-level constants:

```ts
const experiences = [{ role, company, period, description }]
const education   = { school, degree, period }
const languages   = string[]
const technologies = string[]
```

To update resume content, edit these constants directly in `src/Home.tsx`.

## External services / dependencies

| Dependency | Use |
|---|---|
| `react` / `react-dom` | UI rendering only |
| LinkedIn URL | External link (`https://www.linkedin.com/in/diamond-phu/`) |
| GitHub URL | External link (`https://github.com/powermanelite`) |
| Resume PDF | Static file — no external service |

No API calls. No authentication. No environment variables.

## Running locally

**Standalone** (within `dia-home` itself):

```bash
cd apps/dia-home
npm run dev        # Vite dev server at http://localhost:5173
```

**Within the full website** (recommended):

```bash
cd apps/dia-website
npm run dev        # Home tab available at http://localhost:5173
```

No `.env` file required.

## Deployment notes

- `Home` is included in every build unconditionally — there is no feature flag.
- The resume PDF must exist at `apps/dia-website/public/Diamond_Phu_Resume.pdf` for it to be served by GitHub Pages.
- To update the resume: replace both `apps/dia-home/public/Diamond_Phu_Resume.pdf` (for standalone dev) and `apps/dia-website/public/Diamond_Phu_Resume.pdf` (for production), keeping the filename identical.
- The `RESUME_URL` constant in `Home.tsx` uses a path that works in the standalone dev context; the shell's Vite `base: '/DP_Projects/'` ensures the correct path in production.
