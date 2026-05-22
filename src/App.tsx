import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, CheckCircle2, Circle,
  Bell, BellOff, X, Clock, Download, Upload, Calendar, RotateCcw,
  Moon, Sun, Pencil, Copy, Clipboard, Search,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type TaskStage = 'now' | 'next' | 'later' | 'done';
type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

interface Task {
  id: string;
  text: string;
  stage: TaskStage;
  createdAt: number;
  completedAt?: number;
  dueDate?: string;
  reminderTime?: number;
  reminderDismissed?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'zentask_tasks';
const THEME_KEY = 'zentask_theme';
const NOTIFIED_KEY = 'zentask_notified_reminders';
const VALID_STAGES: TaskStage[] = ['now', 'next', 'later', 'done'];

const SECTIONS: { stage: Exclude<TaskStage, 'done'>; label: string; empty: string }[] = [
  { stage: 'now',   label: 'Now',   empty: 'Nothing urgent right now.' },
  { stage: 'next',  label: 'Next',  empty: 'Add what you want to handle soon.' },
  { stage: 'later', label: 'Later', empty: 'Park low-pressure tasks here.' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function migrateRaw(raw: any): Task {
  return {
    id: raw.id ?? crypto.randomUUID(),
    text: String(raw.text ?? ''),
    stage: VALID_STAGES.includes(raw.stage)
      ? (raw.stage as TaskStage)
      : raw.completed ? 'done' : 'next',
    createdAt: raw.createdAt ?? Date.now(),
    completedAt: raw.completedAt,
    dueDate: typeof raw.dueDate === 'string' ? raw.dueDate : undefined,
    reminderTime: typeof raw.reminderTime === 'number' ? raw.reminderTime : undefined,
    reminderDismissed: Boolean(raw.reminderDismissed),
  };
}

function formatDue(dateStr: string): { label: string; overdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { label: 'Overdue', overdue: true };
  if (diff === 0) return { label: 'Today', overdue: false };
  if (diff === 1) return { label: 'Tomorrow', overdue: false };
  return {
    label: due.toLocaleDateString([], { month: 'short', day: 'numeric' }),
    overdue: false,
  };
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function tsToTimeStr(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeStrToTs(str: string): number {
  const [h, m] = str.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function sortByOverdue(items: Task[]): Task[] {
  return [...items].sort((a, b) => {
    const aOver = a.dueDate ? formatDue(a.dueDate).overdue : false;
    const bOver = b.dueDate ? formatDue(b.dueDate).overdue : false;
    if (aOver === bOver) return 0;
    return aOver ? -1 : 1;
  });
}

// ── Notification helpers ──────────────────────────────────────────────────────

function getNotifPermission(): NotifPermission {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifPermission;
}

function formatReminderLabel(ts: number): string {
  const now = Date.now();
  if (ts <= now) return 'overdue';
  const d = new Date(ts);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - today.getTime()) / 86_400_000);
  const time = formatTime(ts);
  if (diffDays === 0) return `today ${time}`;
  if (diffDays === 1) return `tomorrow ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

function notifKey(taskId: string, reminderTime: number): string {
  return `${taskId}:${reminderTime}`;
}

function loadNotifiedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveNotifiedSet(set: Set<string>): void {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

function pruneNotifiedSet(): void {
  const cutoff = Date.now() - 2 * 86_400_000;
  const set = loadNotifiedSet();
  const pruned = new Set<string>();
  for (const key of set) {
    const ts = parseInt(key.slice(key.lastIndexOf(':') + 1), 10);
    if (!Number.isNaN(ts) && ts > cutoff) pruned.add(key);
  }
  saveNotifiedSet(pruned);
}

async function fireTaskNotification(task: Omit<Task, 'stage'> & { stage: TaskStage }): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const title = 'ZenTask reminder';
  const stageLabel = task.stage !== 'done'
    ? `[${task.stage.charAt(0).toUpperCase() + task.stage.slice(1)}] `
    : '';
  const options: NotificationOptions = {
    body: `${stageLabel}${task.text}`,
    icon: '/icon-192x192.png',
    badge: '/favicon-32x32.png',
    tag: task.id,
  };
  if (navigator.serviceWorker?.controller) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return;
    } catch { /* fall through */ }
  }
  try {
    const n = new Notification(title, options);
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* ignore */ }
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

interface RowProps {
  task: Task;
  notifPermission: NotifPermission;
  onMarkDone: (id: string) => void;
  onReopen: (id: string) => void;
  onSetStage: (id: string, stage: TaskStage) => void;
  onDelete: (id: string) => void;
  onUpdateTask: (id: string, patch: Partial<Task>) => void;
  onDuplicate: (id: string) => void;
}

function TaskRow({
  task, notifPermission,
  onMarkDone, onReopen, onSetStage, onDelete, onUpdateTask, onDuplicate,
}: RowProps) {
  const done = task.stage === 'done';
  const due = task.dueDate ? formatDue(task.dueDate) : null;
  const reminderPast = !done && !!task.reminderTime && task.reminderTime <= Date.now();

  const [showEdit, setShowEdit] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => { if (done) setShowEdit(false); }, [done]);

  const startEditTitle = () => { setEditTitle(task.text); setEditingTitle(true); };
  const saveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed) onUpdateTask(task.id, { text: trimmed });
    setEditingTitle(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
      className={`group rounded-2xl border transition-colors ${
        done
          ? 'bg-gray-50/50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-800'
          : due?.overdue
          ? 'bg-amber-50/40 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 shadow-sm'
          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-300 dark:hover:border-gray-700'
      }`}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 p-4">
        {/* Circle */}
        <button
          onClick={() => (done ? onReopen(task.id) : onMarkDone(task.id))}
          className={`flex-shrink-0 mt-0.5 transition-colors ${
            done
              ? 'text-green-400'
              : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'
          }`}
          title={done ? 'Reopen task' : 'Mark as done'}
        >
          {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </button>

        {/* Text + meta */}
        <div className="flex-grow min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              onBlur={saveTitle}
              className="w-full text-[15px] leading-snug bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-gray-500 dark:focus:border-gray-400 text-gray-900 dark:text-gray-100"
            />
          ) : (
            <span
              role={!done ? 'button' : undefined}
              tabIndex={!done ? 0 : undefined}
              onKeyDown={!done ? e => { if (e.key === 'Enter') startEditTitle(); } : undefined}
              onClick={() => !done && startEditTitle()}
              className={`text-[15px] leading-snug block ${
                done
                  ? 'text-gray-400 dark:text-gray-600 line-through cursor-default'
                  : 'text-gray-700 dark:text-gray-200 cursor-text hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {task.text}
            </span>
          )}

          {(due || (task.reminderTime && !done)) && (
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              {due && (
                <span className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${
                  due.overdue ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'
                }`}>
                  <Calendar size={9} />
                  {due.label}
                </span>
              )}
              {task.reminderTime && !done && (
                <span className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${
                  reminderPast ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'
                }`}>
                  <Bell size={9} />
                  {formatReminderLabel(task.reminderTime)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex-shrink-0 flex items-center gap-1 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {!done && (
            <button
              onClick={() => setShowEdit(v => !v)}
              title="Edit due date / reminder"
              className={`p-1.5 rounded-lg transition-colors ${
                showEdit
                  ? 'text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Pencil size={13} />
            </button>
          )}
          {done ? (
            <button
              onClick={() => onReopen(task.id)}
              title="Move back to Next"
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <RotateCcw size={13} />
            </button>
          ) : (
            <select
              value={task.stage}
              onChange={e => onSetStage(task.id, e.target.value as TaskStage)}
              className="text-[11px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-1.5 py-1 focus:outline-none hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer transition-colors"
              title="Move to stage"
            >
              <option value="now">Now</option>
              <option value="next">Next</option>
              <option value="later">Later</option>
            </select>
          )}
          <button
            onClick={() => onDuplicate(task.id)}
            title="Duplicate task"
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Copy size={13} />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            title="Delete task"
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Edit panel — due date & reminder */}
      <AnimatePresence>
        {showEdit && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5">
                  <Calendar size={11} className="text-gray-400 dark:text-gray-500 shrink-0" />
                  <input
                    type="date"
                    value={task.dueDate ?? ''}
                    onChange={e => onUpdateTask(task.id, { dueDate: e.target.value || undefined })}
                    className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors cursor-pointer"
                  />
                  {task.dueDate && (
                    <button
                      onClick={() => onUpdateTask(task.id, { dueDate: undefined })}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={11} className="text-gray-400 dark:text-gray-500 shrink-0" />
                  <input
                    type="time"
                    value={task.reminderTime ? tsToTimeStr(task.reminderTime) : ''}
                    onChange={e => {
                      if (!e.target.value) {
                        onUpdateTask(task.id, { reminderTime: undefined, reminderDismissed: false });
                        return;
                      }
                      onUpdateTask(task.id, {
                        reminderTime: timeStrToTs(e.target.value),
                        reminderDismissed: false,
                      });
                    }}
                    className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors cursor-pointer"
                  />
                  {task.reminderTime && (
                    <button
                      onClick={() => onUpdateTask(task.id, { reminderTime: undefined, reminderDismissed: false })}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>
              {/* Inline note when reminders aren't enabled */}
              {task.reminderTime && notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
                <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
                  {notifPermission === 'denied'
                    ? 'Reminder saved. Unblock notifications in browser settings to receive alerts.'
                    : 'Reminder saved. Enable notifications above to receive alerts.'}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as any[]).map(migrateRaw) : [];
    } catch {
      return [];
    }
  });

  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved !== null) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [notifPermission, setNotifPermission] = useState<NotifPermission>(getNotifPermission);

  const [input, setInput] = useState('');
  const [addStage, setAddStage] = useState<Exclude<TaskStage, 'done'>>('next');
  const [dueDate, setDueDate] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<Task | null>(null);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const triggeredIds = useRef(new Set<string>());
  const firingNotifs = useRef(new Set<string>());
  const tasksRef = useRef(tasks);
  const importRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep tasksRef current without triggering notification effect re-runs
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (tasks.length === 0) inputRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Prune stale notification history once on mount
  useEffect(() => { pruneNotifiedSet(); }, []);

  // Watch for external permission changes (e.g. user unblocks in browser settings)
  useEffect(() => {
    let status: PermissionStatus | null = null;
    const handler = () => setNotifPermission(getNotifPermission());
    navigator.permissions
      ?.query({ name: 'notifications' as PermissionName })
      .then(s => { status = s; s.addEventListener('change', handler); })
      .catch(() => {});
    return () => { status?.removeEventListener('change', handler); };
  }, []);

  // In-app alarm toast — 1s poll
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const hit = tasks.find(
        t =>
          t.stage !== 'done' &&
          t.reminderTime &&
          t.reminderTime <= now &&
          !t.reminderDismissed &&
          !triggeredIds.current.has(t.id),
      );
      if (hit) {
        setActiveAlarm(hit);
        triggeredIds.current.add(hit.id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [tasks]);

  // Browser notification checker — fires on load + every 60s
  useEffect(() => {
    if (notifPermission !== 'granted') return;

    const check = async () => {
      const now = Date.now();
      const notifiedSet = loadNotifiedSet();
      let changed = false;
      for (const task of tasksRef.current) {
        if (task.stage === 'done' || !task.reminderTime || task.reminderTime > now) continue;
        const key = notifKey(task.id, task.reminderTime);
        if (notifiedSet.has(key) || firingNotifs.current.has(key)) continue;
        firingNotifs.current.add(key);
        await fireTaskNotification(task);
        firingNotifs.current.delete(key);
        notifiedSet.add(key);
        changed = true;
      }
      if (changed) saveNotifiedSet(notifiedSet);
    };

    void check();
    const id = setInterval(() => void check(), 60_000);
    return () => clearInterval(id);
  }, [notifPermission]); // only restarts when permission changes

  // ── Task actions ──────────────────────────────────────────────────────────────

  const update = (fn: (prev: Task[]) => Task[]) => setTasks(prev => fn(prev));

  const addTask = () => {
    const text = input.trim();
    if (!text) return;
    let reminderTimestamp: number | undefined;
    if (reminderAt) {
      const d = new Date();
      const [h, m] = reminderAt.split(':').map(Number);
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      reminderTimestamp = d.getTime();
    }
    const task: Task = {
      id: crypto.randomUUID(),
      text,
      stage: addStage,
      createdAt: Date.now(),
      dueDate: dueDate || undefined,
      reminderTime: reminderTimestamp,
      reminderDismissed: false,
    };
    update(prev => [task, ...prev]);
    setInput('');
    setDueDate('');
    setReminderAt('');
  };

  const updateTask = (id: string, patch: Partial<Task>) =>
    update(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)));

  const markDone = (id: string) =>
    update(ts =>
      ts.map(t =>
        t.id === id ? { ...t, stage: 'done', completedAt: Date.now(), reminderDismissed: true } : t,
      ),
    );

  const reopen = (id: string) =>
    update(ts => ts.map(t => (t.id === id ? { ...t, stage: 'next', completedAt: undefined } : t)));

  const setStage = (id: string, stage: TaskStage) =>
    update(ts => ts.map(t => (t.id === id ? { ...t, stage } : t)));

  const deleteTask = (id: string) => {
    update(ts => ts.filter(t => t.id !== id));
    if (activeAlarm?.id === id) setActiveAlarm(null);
  };

  const duplicateTask = (id: string) => {
    const source = tasks.find(t => t.id === id);
    if (!source) return;
    update(prev => [{
      ...source,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      stage: 'next' as TaskStage,
      completedAt: undefined,
      reminderDismissed: false,
    }, ...prev]);
  };

  const clearDone = () => {
    if (!window.confirm('Clear all completed tasks?')) return;
    update(ts => ts.filter(t => t.stage !== 'done'));
  };

  const dismissAlarm = (id: string) => {
    update(ts => ts.map(t => (t.id === id ? { ...t, reminderDismissed: true } : t)));
    setActiveAlarm(null);
  };

  // ── Notification actions ──────────────────────────────────────────────────────

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result as NotifPermission);
  };

  const sendTestNotif = async () => {
    await fireTaskNotification({
      id: 'test-' + Date.now(),
      text: 'Reminders are working!',
      stage: 'next',
      createdAt: Date.now(),
      reminderTime: Date.now(),
    });
  };

  // ── Derived state ─────────────────────────────────────────────────────────────

  const byStage = (s: TaskStage) => tasks.filter(t => t.stage === s);
  const doneTasks = byStage('done');
  const activeTasks = tasks.filter(t => t.stage !== 'done');
  const progress = tasks.length === 0 ? 0 : Math.round((doneTasks.length / tasks.length) * 100);
  const searchQuery = search.trim().toLowerCase();
  const searchResults = searchQuery ? tasks.filter(t => t.text.toLowerCase().includes(searchQuery)) : [];

  // ── Export / Import ───────────────────────────────────────────────────────────

  const exportTasks = () => {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `zentask-${new Date().toISOString().slice(0, 10)}.json`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        const arr: any[] = Array.isArray(raw.tasks) ? raw.tasks : Array.isArray(raw) ? raw : null;
        if (!arr) throw new Error('Unrecognised format');
        update(() => arr.map(migrateRaw));
      } catch {
        alert('Could not import — please use a valid ZenTask backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const copyPlan = async () => {
    const date = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    const lines: string[] = [`My Plan — ${date}`, ''];
    for (const { stage, label } of SECTIONS) {
      const items = tasks.filter(t => t.stage === stage);
      if (items.length > 0) {
        lines.push(`▸ ${label.toUpperCase()}`);
        items.forEach(t => lines.push(`- ${t.text}`));
        lines.push('');
      }
    }
    const done = tasks.filter(t => t.stage === 'done');
    if (done.length > 0) {
      lines.push('✓ DONE');
      done.forEach(t => lines.push(`- ${t.text}`));
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  // ── Shared row props helper ───────────────────────────────────────────────────

  const rowProps = {
    notifPermission,
    onMarkDone: markDone,
    onReopen: reopen,
    onSetStage: setStage,
    onDelete: deleteTask,
    onUpdateTask: updateTask,
    onDuplicate: duplicateTask,
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-xl mx-auto">

        {/* ── Alarm toast ── */}
        <AnimatePresence>
          {activeAlarm && (
            <motion.div
              initial={{ opacity: 0, y: -70 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -70 }}
              className="fixed inset-x-4 top-6 z-50 flex justify-center pointer-events-none"
            >
              <div className="bg-black text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 max-w-md w-full pointer-events-auto border border-white/10">
                <div className="bg-amber-500 p-1.5 rounded-full shrink-0">
                  <Bell size={15} className="animate-bounce" />
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">Reminder</p>
                  <p className="text-sm font-medium truncate">{activeAlarm.text}</p>
                </div>
                <button
                  onClick={() => dismissAlarm(activeAlarm.id)}
                  className="p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0"
                >
                  <X size={15} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Header ── */}
        <header className="mb-8 text-center relative">
          <button
            onClick={() => setDark(v => !v)}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="absolute right-0 top-0 p-2 rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center mb-3">
            <img src="/icon-192x192.png" alt="ZenTask" className="w-12 h-12 rounded-2xl shadow-lg" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100"
          >
            ZenTask
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-gray-400 dark:text-gray-500 mt-1 text-sm font-light"
          >
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </motion.p>
        </header>

        {/* ── Progress bar ── */}
        {tasks.length > 0 && (
          <div className="mb-7">
            <div className="flex justify-between mb-1.5">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">Progress</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">{doneTasks.length} / {tasks.length}</span>
            </div>
            <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                className="h-full bg-gray-900 dark:bg-gray-100 rounded-full"
              />
            </div>
          </div>
        )}

        {/* ── Quick-add ── */}
        <div className="mb-5">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addTask();
                if (e.key === 'Escape') setInput('');
              }}
              placeholder="What needs doing?"
              className="w-full pl-5 pr-14 py-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 dark:focus:ring-white/5 focus:border-black dark:focus:border-gray-500 transition-all shadow-sm placeholder:text-gray-300 dark:placeholder:text-gray-600 text-gray-900 dark:text-gray-100"
            />
            <button
              onClick={addTask}
              disabled={!input.trim()}
              className="absolute right-2 top-2 bottom-2 px-3.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-200 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>

          <button
            onClick={() => setShowDetails(v => !v)}
            className="mt-2 ml-1 flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <motion.span animate={{ rotate: showDetails ? 90 : 0 }} className="inline-block leading-none">›</motion.span>
            {showDetails ? 'Hide options' : 'More options'}
          </button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 px-1 flex flex-wrap gap-x-5 gap-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Stage</span>
                    {(['now', 'next', 'later'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setAddStage(s)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                          addStage === s
                            ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-gray-400 dark:text-gray-500 shrink-0" />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-gray-400 dark:text-gray-500 shrink-0" />
                    <input
                      type="time"
                      value={reminderAt}
                      onChange={e => setReminderAt(e.target.value)}
                      className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors cursor-pointer"
                    />
                    {reminderAt && (
                      <button onClick={() => setReminderAt('')} className="text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Notification status ── */}
        <div className="mb-5 flex items-center gap-2 min-h-[24px]">
          {notifPermission === 'unsupported' ? (
            <>
              <BellOff size={12} className="text-gray-300 dark:text-gray-700 shrink-0" />
              <span className="text-[11px] text-gray-300 dark:text-gray-700">Notifications not available in this browser</span>
            </>
          ) : notifPermission === 'denied' ? (
            <>
              <BellOff size={12} className="text-amber-400 shrink-0" />
              <span className="text-[11px] text-amber-500 dark:text-amber-400">
                Reminders blocked — check browser settings to enable
              </span>
            </>
          ) : notifPermission === 'granted' ? (
            <>
              <Bell size={12} className="text-green-500 shrink-0" />
              <span className="text-[11px] text-gray-400 dark:text-gray-500">Reminders on</span>
              <span className="text-gray-200 dark:text-gray-700">·</span>
              <button
                onClick={sendTestNotif}
                className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Send test
              </button>
            </>
          ) : (
            <>
              <Bell size={12} className="text-gray-300 dark:text-gray-600 shrink-0" />
              <span className="text-[11px] text-gray-400 dark:text-gray-500">Reminders off</span>
              <button
                onClick={requestNotifPermission}
                className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Enable
              </button>
            </>
          )}
        </div>

        {/* ── Search ── */}
        <div className="mb-7 relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setSearch(''); }}
            placeholder="Search tasks…"
            className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-[13px] text-gray-700 dark:text-gray-300 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-gray-300 dark:focus:border-gray-700 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Search results OR normal sections ── */}
        {searchQuery ? (
          <div className="space-y-2 mb-8">
            <div className="flex items-center gap-2 mb-2.5">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Results</h2>
              {searchResults.length > 0 && (
                <span className="text-[10px] font-semibold text-gray-300 dark:text-gray-600">{searchResults.length}</span>
              )}
            </div>
            {searchResults.length === 0 ? (
              <p className="text-sm text-gray-300 dark:text-gray-600 font-light px-1 py-4 text-center">No matching tasks.</p>
            ) : (
              <AnimatePresence mode="popLayout">
                {searchResults.map(t => (
                  <TaskRow key={t.id} task={t} {...rowProps} />
                ))}
              </AnimatePresence>
            )}
          </div>
        ) : (
          <>
            {tasks.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8 mb-8">
                <p className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">Plan one small thing.</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 font-light leading-relaxed max-w-xs mx-auto">
                  Use <span className="font-medium">Now</span> for what's urgent,{' '}
                  <span className="font-medium">Next</span> for soon,{' '}
                  <span className="font-medium">Later</span> for someday.
                </p>
              </motion.div>
            )}

            <div className="space-y-8">
              {SECTIONS.map(({ stage, label, empty }) => {
                const items = sortByOverdue(byStage(stage));
                return (
                  <section key={stage}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</h2>
                      {items.length > 0 && (
                        <span className="text-[10px] font-semibold text-gray-300 dark:text-gray-600">{items.length}</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {items.length === 0 ? (
                        <p className="text-sm text-gray-300 dark:text-gray-600 font-light px-1 py-2">{empty}</p>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {items.map(t => <TaskRow key={t.id} task={t} {...rowProps} />)}
                        </AnimatePresence>
                      )}
                    </div>
                  </section>
                );
              })}

              {doneTasks.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-300 dark:text-gray-600">Done today</h2>
                      <span className="text-[10px] text-gray-200 dark:text-gray-700 font-semibold">{doneTasks.length}</span>
                    </div>
                    <button onClick={clearDone} className="text-[10px] text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors font-medium">
                      Clear
                    </button>
                  </div>
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {doneTasks.map(t => <TaskRow key={t.id} task={t} {...rowProps} />)}
                    </AnimatePresence>
                  </div>
                </section>
              )}
            </div>
          </>
        )}

        {/* ── Footer ── */}
        <footer className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-300 dark:text-gray-600 font-medium uppercase tracking-widest">
              {activeTasks.length} active
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={copyPlan}
                disabled={tasks.length === 0}
                className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Copy today's plan to clipboard"
              >
                <Clipboard size={12} />
                {copied ? 'Copied!' : 'Copy plan'}
              </button>
              <span className="text-gray-200 dark:text-gray-700">·</span>
              <button
                onClick={exportTasks}
                className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Download task backup"
              >
                <Download size={12} />
                Export
              </button>
              <span className="text-gray-200 dark:text-gray-700">·</span>
              <button
                onClick={() => importRef.current?.click()}
                className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Import task backup"
              >
                <Upload size={12} />
                Import
              </button>
              <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            </div>
          </div>
          <p className="mt-3 text-[10px] text-gray-300 dark:text-gray-700 text-center leading-relaxed">
            Reminder notifications work while ZenTask is open or when you reopen it.
            Exact background reminders depend on your browser and device.
          </p>
        </footer>

      </div>
    </div>
  );
}
