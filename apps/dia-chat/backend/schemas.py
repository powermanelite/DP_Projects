from typing import Literal

from pydantic import BaseModel


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


class StartResponse(BaseModel):
    reply: str
