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
    </div>
  );
}
