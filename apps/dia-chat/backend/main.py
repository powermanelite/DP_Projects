from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.agents import chat as chat_agent
from backend.schemas import ChatRequest, ChatResponse, StartResponse

app = FastAPI(title="dia-chat", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/chat/start", response_model=StartResponse)
def chat_start() -> StartResponse:
    return StartResponse(reply="Hey! What's on your plate today? Share your work plan and I'll keep track of it for you.")


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    reply, tasks = chat_agent.respond(req.messages, req.tasks)
    return ChatResponse(reply=reply, tasks=tasks)


@app.get("/chat/end", response_model=StartResponse)
def chat_end() -> StartResponse:
    return StartResponse(reply="Good luck with your tasks! See you next time.")
