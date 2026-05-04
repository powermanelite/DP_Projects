import { useCallback, useEffect, useRef, useState } from 'react';
import './AssistMe.css';

const API_BASE = 'http://127.0.0.1:8000';
const CHECKIN_INTERVAL_MS = 60 * 60 * 1000;

type TaskStatus = 'pending' | 'in_progress' | 'done';

interface Task {
  id: string;
  description: string;
  status: TaskStatus;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

const COMMANDS = [
  { label: '/start', description: 'Start a new conversation', endpoint: 'GET /chat/start', behavior: 'Resets the chat and clears all tasks' },
  { label: '/chat', description: 'Send a message to the assistant', endpoint: 'POST /chat', behavior: 'Triggered by typing in the input box' },
  { label: '/end', description: 'End the current session', endpoint: 'GET /chat/end', behavior: 'Posts a farewell message from the assistant' },
  { label: '/health', description: 'Check if the server is running', endpoint: 'GET /health', behavior: 'Posts the server status as an assistant message' },
];

export default function AssistMe() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef(tasks);
  const messagesRef = useRef(messages);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const callChat = useCallback(async (msgs: Message[], currentTasks: Task[]) => {
    const apiMessages = msgs
      .filter(m => !m.hidden)
      .map(({ role, content }) => ({ role, content }));

    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages, tasks: currentTasks }),
    });
    return res.json() as Promise<{ reply: string; tasks: Task[] }>;
  }, []);

  // Opening message on mount
  useEffect(() => {
    fetch(`${API_BASE}/chat/start`)
      .then(r => r.json())
      .then((data: { reply: string }) => {
        setMessages([{ role: 'assistant', content: data.reply }]);
      })
      .catch(() => {
        setMessages([{ role: 'assistant', content: 'Could not connect to the server. Make sure the backend is running at ' + API_BASE }]);
      });
  }, []);

  // Hourly check-in
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return;
      const trigger: Message = {
        role: 'user',
        content: "It's been an hour. Please check in on my progress.",
        hidden: true,
      };
      const next = [...messagesRef.current, trigger];
      setMessages(next);
      setLoading(true);
      try {
        const data = await callChat(next, tasksRef.current);
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        setTasks(data.tasks);
      } finally {
        setLoading(false);
      }
    }, CHECKIN_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [callChat]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg: Message = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    try {
      const data = await callChat(next, tasks);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      setTasks(data.tasks);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleEnd() {
    const res = await fetch(`${API_BASE}/chat/end`);
    const data: { reply: string } = await res.json();
    setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
  }

  async function handleNewChat() {
    const res = await fetch(`${API_BASE}/chat/start`);
    const data: { reply: string } = await res.json();
    setMessages([{ role: 'assistant', content: data.reply }]);
    setTasks([]);
  }

  async function handleHealth() {
    const res = await fetch(`${API_BASE}/health`);
    const data: { status: string } = await res.json();
    setMessages(prev => [...prev, { role: 'assistant', content: `Server status: ${data.status}` }]);
  }

  return (
    <div className="assist-layout">
      <div className="assist-chat">
        <div className="assist-messages">
          {messages.filter(m => !m.hidden).map((msg, i) => (
            <div key={i} className={`assist-bubble assist-bubble--${msg.role}`}>
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="assist-bubble assist-bubble--assistant assist-bubble--typing">
              <span /><span /><span />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="assist-input-row">
          <textarea
            className="assist-input"
            placeholder="Type a message... (Enter to send)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button
            className="assist-send"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>

      <div className="assist-sidebar">
        <div className="assist-postit">
          <div className="postit-header">Today's Tasks</div>
          {tasks.length === 0 ? (
            <p className="postit-empty">No tasks yet — tell me your plan!</p>
          ) : (
            <ul className="postit-list">
              {tasks.map(task => (
                <li key={task.id} className={`postit-item postit-item--${task.status}`}>
                  <span className="postit-status">{STATUS_LABEL[task.status]}</span>
                  <span className="postit-desc">{task.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="assist-commands">
          <div className="commands-header">Commands</div>
          <ul className="commands-list">
            {COMMANDS.map(cmd => (
              <li key={cmd.label} className="commands-item">
                <button
                  className="commands-btn"
                  onClick={
                    cmd.label === '/end' ? handleEnd :
                    cmd.label === '/start' ? handleNewChat :
                    cmd.label === '/health' ? handleHealth :
                    undefined
                  }
                  disabled={cmd.label === '/chat'}
                >
                  <span className="commands-label">{cmd.label}</span>
                  <span className="commands-endpoint">{cmd.endpoint}</span>
                </button>
                <span className="commands-desc">{cmd.description}</span>
                <span className="commands-behavior">{cmd.behavior}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
