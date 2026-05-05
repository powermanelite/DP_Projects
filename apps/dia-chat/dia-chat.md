# dia-chat

## Overview

The Assist Me tab is a personal productivity chatbot powered by OpenAI. Users can share their daily task plan and the assistant tracks task status (pending, in progress, done) across the conversation. The assistant checks in automatically every hour to ask about progress. The feature is split into two parts: a React frontend (`frontend/`) and a FastAPI Python backend (`backend/`).

## Architecture

```
DP_Projects/
└── apps/
    └── dia-chat/
        ├── frontend/                        ← React 19 Vite app (@dia/chat)
        │   └── src/
        │       ├── components/
        │       │   ├── AssistMe.tsx         ← entire chat UI
        │       │   └── AssistMe.css
        │       ├── index.ts                 ← re-exports AssistMe as default
        │       └── main.tsx                 ← standalone dev entry
        └── backend/                         ← FastAPI Python service
            ├── main.py                      ← app + 4 endpoints
            ├── schemas.py                   ← Pydantic request/response models
            └── agents/
                └── chat.py                  ← OpenAI integration
```

The frontend is consumed by `dia-website` via the `@dia/chat` alias (→ `frontend/src`). The backend runs as a separate process (locally: `uvicorn`; in production: Render).

Cross-origin requests from the browser to the backend are handled via CORS middleware in `backend/main.py`.

## Key files

### Frontend

| File | Purpose |
|---|---|
| `frontend/src/components/AssistMe.tsx` | Single component. Manages the full chat UI: message history, task list, input handling, auto check-in timer, and all fetch calls to the backend. |
| `frontend/src/index.ts` | `export { default } from './components/AssistMe'` — the package boundary for `dia-website`. |
| `frontend/src/components/AssistMe.css` | Layout for the two-column chat + sidebar (tasks panel and commands panel). |

### Backend

| File | Purpose |
|---|---|
| `backend/main.py` | FastAPI app. Defines 4 endpoints. Wires CORS. |
| `backend/schemas.py` | Pydantic models: `Task`, `Message`, `ChatRequest`, `ChatResponse`, `StartResponse`. |
| `backend/agents/chat.py` | Loads env vars via `python-dotenv`, instantiates the OpenAI client, defines the `RESPOND_TOOL` function schema, and implements `respond()` which calls the OpenAI Chat Completions API with function calling enforced. |

## Data flow

```
dia-website App.tsx
  └── {ENABLE_CHAT && activeTab === 'chat' && <ChatPage />}
        └── AssistMe (no props, no callbacks)
              ├── on mount  → GET /chat/start         → sets initial assistant message
              ├── on send   → POST /chat               → sends messages + tasks, gets reply + updated tasks
              ├── /end btn  → GET /chat/end            → appends farewell message
              ├── /health   → GET /health              → appends status message
              └── every 60m → POST /chat (hidden msg)  → auto check-in
```

`AssistMe` takes **no props** and emits **no events** to the shell. All state is local to the component.

## State shape

### Frontend (component state)

```ts
type TaskStatus = 'pending' | 'in_progress' | 'done';

interface Task {
  id: string;
  description: string;
  status: TaskStatus;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;   // true for auto check-in triggers — not rendered in the UI
}
```

`messages` and `tasks` are the two primary state arrays. Both are sent to the backend on every POST /chat call so the AI has full context.

### Backend (Pydantic)

```python
class Task(BaseModel):
    id: str
    description: str
    status: Literal["pending", "in_progress", "done"]

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]
    tasks: list[Task] = []

class ChatResponse(BaseModel):
    reply: str
    tasks: list[Task]
```

The backend is stateless — the frontend sends the full conversation history and task list on every request.

## Backend API

| Method | Path | Request | Response | Description |
|---|---|---|---|---|
| GET | `/health` | — | `{"status": "ok"}` | Liveness check |
| GET | `/chat/start` | — | `StartResponse` | Returns a fixed greeting, resets the session on the client |
| POST | `/chat` | `ChatRequest` | `ChatResponse` | Main chat turn — calls OpenAI and returns reply + updated tasks |
| GET | `/chat/end` | — | `StartResponse` | Returns a fixed farewell message |

### OpenAI integration (`agents/chat.py`)

- **Model:** `gpt-4o-mini`
- **Technique:** enforced function calling (`tool_choice: {"type": "function", "function": {"name": "respond"}}`) with a single tool `RESPOND_TOOL` that requires the model to always output a structured `{ reply: string, tasks: Task[] }`. This prevents free-form text and guarantees parseable JSON.
- **Context:** current task list is appended to the system prompt on every call so the model knows the state without it being part of the visible chat history.

## External services / dependencies

### Frontend

| Dependency | Use |
|---|---|
| `react` / `react-dom` | UI |
| `VITE_CHAT_API_BASE` env var | Backend URL (`http://127.0.0.1:8000` fallback for local dev) |

### Backend

| Dependency | Use |
|---|---|
| `fastapi` + `uvicorn` | HTTP server |
| `openai` SDK | GPT-4o-mini via Chat Completions API |
| `python-dotenv` | Loads `backend/.env` for local dev |
| `OPENAI_API_KEY` env var | Required at runtime |

## Running locally

### Backend

```bash
cd apps/dia-chat
pip install -r requirements.txt

# Create backend/.env with your OpenAI key:
# OPENAI_API_KEY=sk-...

uvicorn backend.main:app --reload
# Runs at http://127.0.0.1:8000
```

### Frontend (standalone)

```bash
cd apps/dia-chat/frontend
npm install
npm run dev
# Runs at http://localhost:5174 (or next available port)
```

### Within the full website

```bash
cd apps/dia-website
# Ensure VITE_ENABLE_CHAT=true in apps/dia-website/.env
npm run dev
# Assist Me tab visible at http://localhost:5173
```

## Deployment notes

### Feature flag

The Assist Me tab is gated by `VITE_ENABLE_CHAT` in the `dia-website` build:

- **Local `.env`:** `VITE_ENABLE_CHAT=true` — tab visible in dev
- **GitHub Actions workflow:** set to `'true'` once backend is live; leave unset to hide the tab without removing the code

### Backend — Render (free tier)

The backend is deployed on Render at `https://dia-chat-backend.onrender.com`.

- **Cold starts:** Render's free tier spins down after 15 minutes of inactivity. The first request after idle may take ~30 seconds.
- **Mitigation:** use [UptimeRobot](https://uptimerobot.com) to ping `/health` every 5 minutes to keep the service warm.
- **Redeployment:** pushing to `master` triggers an automatic Render redeploy (Render watches the repo branch).
- **Secrets on Render:** `OPENAI_API_KEY` is set as an environment variable in the Render dashboard — never committed to the repo.

### CORS

`backend/main.py` restricts origins to:
- `https://powermanelite.github.io` (production)
- `http://localhost:5173` and `http://127.0.0.1:5173` (local dev)

### Re-enabling later checklist

1. Ensure Render service is running (`/health` returns `{"status":"ok"}`)
2. Set `VITE_ENABLE_CHAT: 'true'` in `.github/workflows/deploy.yml` build env
3. Confirm `VITE_CHAT_API_BASE: 'https://dia-chat-backend.onrender.com'` is set in the workflow
4. Push to `master`
