import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, CheckCircle2, Circle, ListTodo,
  Bell, X, Clock, Download, Upload, Calendar, RotateCcw,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type TaskStage = 'now' | 'next' | 'later' | 'done';

interface Task {
  id: string;
  text: string;
  stage: TaskStage;
  createdAt: number;
  completedAt?: number;
  dueDate?: string;          // 'YYYY-MM-DD'
  reminderTime?: number;     // unix timestamp
  reminderDismissed?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_STAGES: TaskStage[] = ['now', 'next', 'later', 'done'];

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

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const STORAGE_KEY = 'zentask_tasks';

const SECTIONS: { stage: Exclude<TaskStage, 'done'>; label: string; empty: string }[] = [
  { stage: 'now',  label: 'Now',  empty: 'Nothing urgent right now.' },
  { stage: 'next', label: 'Next', empty: 'Add what you want to handle soon.' },
  { stage: 'later',label: 'Later',empty: 'Park low-pressure tasks here.' },
];

// ── TaskRow ───────────────────────────────────────────────────────────────────

interface RowProps {
  task: Task;
  onMarkDone: (id: string) => void;
  onReopen: (id: string) => void;
  onSetStage: (id: string, stage: TaskStage) => void;
  onDelete: (id: string) => void;
}

function TaskRow({ task, onMarkDone, onReopen, onSetStage, onDelete }: RowProps) {
  const done = task.stage === 'done';
  const due = task.dueDate ? formatDue(task.dueDate) : null;
  const reminderPast =
    !done && task.reminderTime && task.reminderTime <= Date.now() && !task.reminderDismissed;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
      className={`group flex items-start gap-3 p-4 rounded-2xl border transition-colors ${
        done
          ? 'bg-gray-50/50 border-gray-100'
          : 'bg-white border-gray-200 shadow-sm hover:border-gray-300'
      }`}
    >
      {/* Circle */}
      <button
        onClick={() => (done ? onReopen(task.id) : onMarkDone(task.id))}
        className={`flex-shrink-0 mt-0.5 transition-colors ${
          done ? 'text-green-400' : 'text-gray-300 hover:text-gray-500'
        }`}
        title={done ? 'Reopen task' : 'Mark as done'}
      >
        {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>

      {/* Text + meta */}
      <div className="flex-grow min-w-0">
        <span
          className={`text-[15px] leading-snug ${
            done ? 'text-gray-400 line-through' : 'text-gray-700'
          }`}
        >
          {task.text}
        </span>

        {(due || (task.reminderTime && !done)) && (
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            {due && (
              <span
                className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${
                  due.overdue ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                <Calendar size={9} />
                {due.label}
              </span>
            )}
            {task.reminderTime && !done && (
              <span
                className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${
                  reminderPast ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                <Bell size={9} />
                {formatTime(task.reminderTime)}
                {reminderPast && ' · Now'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Controls — visible at low opacity, full on hover/focus */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {done ? (
          <button
            onClick={() => onReopen(task.id)}
            title="Move back to Next"
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RotateCcw size={13} />
          </button>
        ) : (
          <select
            value={task.stage}
            onChange={e => onSetStage(task.id, e.target.value as TaskStage)}
            className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-1.5 py-1 focus:outline-none hover:border-gray-300 cursor-pointer transition-colors"
            title="Move to stage"
          >
            <option value="now">Now</option>
            <option value="next">Next</option>
            <option value="later">Later</option>
          </select>
        )}
        <button
          onClick={() => onDelete(task.id)}
          title="Delete task"
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
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

  const [input, setInput] = useState('');
  const [addStage, setAddStage] = useState<Exclude<TaskStage, 'done'>>('next');
  const [dueDate, setDueDate] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<Task | null>(null);

  const triggeredIds = useRef(new Set<string>());
  const importRef = useRef<HTMLInputElement>(null);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // Reminder alarm polling
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

  // ── Task actions ────────────────────────────────────────────────────────────

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

  const markDone = (id: string) =>
    update(ts =>
      ts.map(t =>
        t.id === id
          ? { ...t, stage: 'done', completedAt: Date.now(), reminderDismissed: true }
          : t,
      ),
    );

  const reopen = (id: string) =>
    update(ts =>
      ts.map(t => (t.id === id ? { ...t, stage: 'next', completedAt: undefined } : t)),
    );

  const setStage = (id: string, stage: TaskStage) =>
    update(ts => ts.map(t => (t.id === id ? { ...t, stage } : t)));

  const deleteTask = (id: string) => {
    update(ts => ts.filter(t => t.id !== id));
    if (activeAlarm?.id === id) setActiveAlarm(null);
  };

  const clearDone = () => update(ts => ts.filter(t => t.stage !== 'done'));

  const dismissAlarm = (id: string) => {
    update(ts => ts.map(t => (t.id === id ? { ...t, reminderDismissed: true } : t)));
    setActiveAlarm(null);
  };

  // ── Export / Import ─────────────────────────────────────────────────────────

  const exportTasks = () => {
    const payload = JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), tasks },
      null,
      2,
    );
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
        const arr: any[] = Array.isArray(raw.tasks)
          ? raw.tasks
          : Array.isArray(raw)
          ? raw
          : null;
        if (!arr) throw new Error('Unrecognised format');
        update(() => arr.map(migrateRaw));
      } catch {
        alert('Could not import — please use a valid ZenTask backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Derived state ───────────────────────────────────────────────────────────

  const byStage = (s: TaskStage) => tasks.filter(t => t.stage === s);
  const doneTasks = byStage('done');
  const activeTasks = tasks.filter(t => t.stage !== 'done');
  const progress =
    tasks.length === 0 ? 0 : Math.round((doneTasks.length / tasks.length) * 100);


  // ── Render ──────────────────────────────────────────────────────────────────

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
                <div className="bg-red-500 p-1.5 rounded-full shrink-0">
                  <Bell size={15} className="animate-bounce" />
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest">
                    Reminder
                  </p>
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
        <header className="mb-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-black text-white mb-3 shadow-lg"
          >
            <ListTodo size={22} />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-semibold tracking-tight text-gray-900"
          >
            ZenTask
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-gray-400 mt-1 text-sm font-light"
          >
            {new Date().toLocaleDateString([], {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </motion.p>
        </header>

        {/* ── Progress bar ── */}
        {tasks.length > 0 && (
          <div className="mb-7">
            <div className="flex justify-between mb-1.5">
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                Progress
              </span>
              <span className="text-[10px] text-gray-500 font-semibold">
                {doneTasks.length} / {tasks.length}
              </span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                className="h-full bg-black rounded-full"
              />
            </div>
          </div>
        )}

        {/* ── Quick-add ── */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addTask();
                if (e.key === 'Escape') setInput('');
              }}
              placeholder="What needs doing?"
              className="w-full pl-5 pr-14 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all shadow-sm placeholder:text-gray-300 text-gray-900"
            />
            <button
              onClick={addTask}
              disabled={!input.trim()}
              className="absolute right-2 top-2 bottom-2 px-3.5 bg-black text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Collapsible options */}
          <button
            onClick={() => setShowDetails(v => !v)}
            className="mt-2 ml-1 flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            <motion.span
              animate={{ rotate: showDetails ? 90 : 0 }}
              className="inline-block leading-none"
            >
              ›
            </motion.span>
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
                  {/* Stage */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                      Stage
                    </span>
                    {(['now', 'next', 'later'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setAddStage(s)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                          addStage === s
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Due date */}
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-gray-400 shrink-0" />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 transition-colors cursor-pointer"
                    />
                  </div>

                  {/* Reminder */}
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-gray-400 shrink-0" />
                    <input
                      type="time"
                      value={reminderAt}
                      onChange={e => setReminderAt(e.target.value)}
                      className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 transition-colors cursor-pointer"
                    />
                    {reminderAt && (
                      <button
                        onClick={() => setReminderAt('')}
                        className="text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Task sections ── */}
        <div className="space-y-8">
          {SECTIONS.map(({ stage, label, empty }) => {
            const items = byStage(stage);
            return (
              <section key={stage}>
                <div className="flex items-center gap-2 mb-2.5">
                  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    {label}
                  </h2>
                  {items.length > 0 && (
                    <span className="text-[10px] font-semibold text-gray-300">{items.length}</span>
                  )}
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="text-sm text-gray-300 font-light px-1 py-2">{empty}</p>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {items.map(t => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          onMarkDone={markDone}
                          onReopen={reopen}
                          onSetStage={setStage}
                          onDelete={deleteTask}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </section>
            );
          })}

          {/* Done today */}
          {doneTasks.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-300">
                    Done today
                  </h2>
                  <span className="text-[10px] text-gray-200 font-semibold">
                    {doneTasks.length}
                  </span>
                </div>
                <button
                  onClick={clearDone}
                  className="text-[10px] text-gray-300 hover:text-red-400 transition-colors font-medium"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {doneTasks.map(t => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onMarkDone={markDone}
                      onReopen={reopen}
                      onSetStage={setStage}
                      onDelete={deleteTask}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="mt-12 pt-6 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] text-gray-300 font-medium uppercase tracking-widest">
            {activeTasks.length} active
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={exportTasks}
              className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-700 transition-colors"
              title="Download task backup"
            >
              <Download size={12} />
              Export
            </button>
            <span className="text-gray-200">·</span>
            <button
              onClick={() => importRef.current?.click()}
              className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-700 transition-colors"
              title="Import task backup"
            >
              <Upload size={12} />
              Import
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </footer>

      </div>
    </div>
  );
}
