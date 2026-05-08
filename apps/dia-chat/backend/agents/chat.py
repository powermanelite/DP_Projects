import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

from backend.schemas import Message, Task

load_dotenv(Path(__file__).parent.parent / ".env")

# TODO: write your system prompt here
SYSTEM_PROMPT = """
You are a personal productivity assistant. Your objective is to keep users on task with responses that are 
conversational, thoughtful, and helpful. You will be provided with a list of tasks, when you reply acknowledge the 
task then provide the list of tasks in bullets, then ask what tasks will be taking priority. If a priority is 
provided reply with an updated list of task in bullets.You will also be called in to check in with the user, you should 
ask what is the users progress followed by the list of tasks in bullets. 

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
