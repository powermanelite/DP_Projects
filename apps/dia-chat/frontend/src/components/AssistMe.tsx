import { useCallback, useEffect, useRef, useState } from 'react';
import './AssistMe.css';

const API_BASE = import.meta.env.VITE_CHAT_API_BASE ?? 'http://127.0.0.1:8000';
// const CHECKIN_INTERVAL_MS = 60 * 60 * 1000; // prod: 1 hour
// const IDLE_TIMEOUT_MS = 15 * 60 * 1000;      // prod: 15 minutes
const CHECKIN_INTERVAL_MS = 3 * 60 * 1000; // test: 3 min
const IDLE_TIMEOUT_MS = 2 * 60 * 1000;     // test: 2 min
const STORAGE_KEY_MESSAGES = 'assistMe.messages';
const STORAGE_KEY_TASKS = 'assistMe.tasks';

function loadFromSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

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

/* const COMMANDS = [
  { label: '/start', description: 'Start a new conversation', endpoint: 'GET /chat/start', behavior: 'Resets the chat and clears all tasks' },
  { label: '/chat', description: 'Send a message to the assistant', endpoint: 'POST /chat', behavior: 'Triggered by typing in the input box' },
  { label: '/end', description: 'End the current session', endpoint: 'GET /chat/end', behavior: 'Posts a farewell message from the assistant' },
  { label: '/health', description: 'Check if the server is running', endpoint: 'GET /health', behavior: 'Posts the server status as an assistant message' },
]; */

export default function AssistMe() {
  const [messages, setMessages] = useState<Message[]>(() => loadFromSession<Message[]>(STORAGE_KEY_MESSAGES) ?? []);
  const [tasks, setTasks] = useState<Task[]>(() => loadFromSession<Task[]>(STORAGE_KEY_TASKS) ?? []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleDeadlineRef = useRef<number | null>(null);
  const idleRemainingRef = useRef<number | null>(null);
  const checkinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tasksRef = useRef(tasks);
  const messagesRef = useRef(messages);

  const cancelCheckin = useCallback(() => {
    if (checkinTimerRef.current) clearTimeout(checkinTimerRef.current);
    checkinTimerRef.current = null;
  }, []);

  const armIdleTimer = useCallback((ms = IDLE_TIMEOUT_MS) => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleDeadlineRef.current = Date.now() + ms;
    idleRemainingRef.current = null;
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      idleDeadlineRef.current = null;
      // No more automatic check-ins until the user sends another message.
      cancelCheckin();
    }, ms);
  }, [cancelCheckin]);

  const pauseIdleTimer = useCallback(() => {
    if (!idleTimerRef.current || idleDeadlineRef.current === null) return;
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    idleRemainingRef.current = Math.max(0, idleDeadlineRef.current - Date.now());
    idleDeadlineRef.current = null;
  }, []);

  const resumeIdleTimer = useCallback(() => {
    if (idleTimerRef.current || idleRemainingRef.current === null) return;
    armIdleTimer(idleRemainingRef.current);
    idleRemainingRef.current = null;
  }, [armIdleTimer]);

  const cancelIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    idleDeadlineRef.current = null;
    idleRemainingRef.current = null;
  }, []);

  useEffect(() => () => cancelIdleTimer(), [cancelIdleTimer]);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    const focus = () => {
      if (!document.hidden) inputRef.current?.focus();
    };
    document.addEventListener('visibilitychange', focus);
    window.addEventListener('focus', focus);
    return () => {
      document.removeEventListener('visibilitychange', focus);
      window.removeEventListener('focus', focus);
    };
  }, []);

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

  // Opening message on mount — only if no prior session history exists
  useEffect(() => {
    if (messagesRef.current.length > 0) return;
    fetch(`${API_BASE}/chat/start`)
      .then(r => r.json())
      .then((data: { reply: string }) => {
        setMessages([{ role: 'assistant', content: data.reply }]);
      })
      .catch(() => {
        setMessages([{ role: 'assistant', content: 'Could not connect to the server. Make sure the backend is running at ' + API_BASE }]);
      });
  }, []);

  // Persist messages and tasks for the browser session (cleared on tab close)
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  }, [messages]);
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
  }, [tasks]);

  // Check-in — resets on every send so it only fires after a full quiet period
  const armCheckin = useCallback(() => {
    if (checkinTimerRef.current) clearTimeout(checkinTimerRef.current);
    checkinTimerRef.current = setTimeout(async () => {
      checkinTimerRef.current = null;
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
        armIdleTimer();
        armCheckin();
      } finally {
        setLoading(false);
      }
    }, CHECKIN_INTERVAL_MS);
  }, [callChat, armIdleTimer]);

  useEffect(() => () => {
    if (checkinTimerRef.current) clearTimeout(checkinTimerRef.current);
  }, []);

  // Pause idle while user is drafting; resume when input is cleared
  useEffect(() => {
    if (input.length > 0) pauseIdleTimer();
    else resumeIdleTimer();
  }, [input, pauseIdleTimer, resumeIdleTimer]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    cancelIdleTimer();
    armCheckin();
    setInput('');
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    if (text === '/start')  { await handleNewChat(); return; }
    if (text === '/end')    { await handleEnd();     return; }
    if (text === '/health') { await handleHealth();  return; }
    if (text === '/chat')   { return; }

    const next = [...messages, userMsg];
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
    cancelIdleTimer();
    cancelCheckin();
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
            ref={inputRef}
            className="assist-input"
            placeholder="Type a message... (Enter to send)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
            autoFocus
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
                  <label className="postit-task-label">
                    <input
                      type="checkbox"
                      className="postit-checkbox"
                      checked={task.status === 'done'}
                      onChange={() =>
                        setTasks(prev => prev.map(t =>
                          t.id === task.id
                            ? { ...t, status: t.status === 'done' ? 'pending' : 'done' }
                            : t
                        ))
                      }
                    />
                    <span className="postit-desc">{task.description}</span>
                  </label>
                  {task.status !== 'pending' && <span className="postit-status">{STATUS_LABEL[task.status]}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* <div className="assist-commands">
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
        </div> */}
      </div>
    </div>
  );
}
