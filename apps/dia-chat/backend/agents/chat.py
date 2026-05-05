import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

from backend.schemas import Message, Task

load_dotenv(Path(__file__).parent.parent / ".env")

# TODO: write your system prompt here
SYSTEM_PROMPT = """
You are a personal productivity assistant. Keep all responses short and direct — 1 to 2 sentences max.
Ask what their tasks are for the day. Check in hourly, briefly ask about each task's progress.
If a task isn't done, ask why in one sentence. Be motivational but concise.
Occasionally remind them to take a snack break in one short line.

Here is an example of how to list out tasks when a list of tasks is provided, updated, and asked for:

    These are your tasks:

        - Finish Code review
        - finish important feature
        - attend this specific meeting.
"""

RESPOND_TOOL = {
    "type": "function",
    "function": {
        "name": "respond",
        "description": "Reply to the user and return the current task list.",
        "parameters": {
            "type": "object",
            "properties": {
                "reply": {
                    "type": "string",
                    "description": "Your conversational response to the user.",
                },
                "tasks": {
                    "type": "array",
                    "description": "The full, up-to-date task list after this turn.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "description": {"type": "string"},
                            "status": {
                                "type": "string",
                                "enum": ["pending", "in_progress", "done"],
                            },
                        },
                        "required": ["id", "description", "status"],
                    },
                },
            },
            "required": ["reply", "tasks"],
        },
    },
}

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def respond(messages: list[Message], tasks: list[Task]) -> tuple[str, list[Task]]:
    task_context = (
        f"\n\nCurrent task list:\n{json.dumps([t.model_dump() for t in tasks], indent=2)}"
        if tasks
        else ""
    )

    api_messages = [{"role": "system", "content": SYSTEM_PROMPT + task_context}]
    api_messages += [{"role": m.role, "content": m.content} for m in messages]

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=api_messages,
        tools=[RESPOND_TOOL],
        tool_choice={"type": "function", "function": {"name": "respond"}},
    )

    tool_call = response.choices[0].message.tool_calls[0]
    result = json.loads(tool_call.function.arguments)

    return result["reply"], [Task(**t) for t in result["tasks"]]
