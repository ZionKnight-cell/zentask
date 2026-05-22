import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, CheckCircle2, Circle, ListTodo, Filter, Check, X, Bell, Clock, AlertCircle } from 'lucide-react';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  reminderTime?: number; // timestamp
  reminderDismissed?: boolean;
}

type FilterType = 'active' | 'all' | 'completed';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('zentask_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [inputValue, setInputValue] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [filter, setFilter] = useState<FilterType>('active');
  const [activeAlarm, setActiveAlarm] = useState<Task | null>(null);
  
  // Ref to track which reminders have already triggered to avoid duplicate alerts in a single session
  const triggeredIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem('zentask_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Alarm checking interval
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const triggered = tasks.find(t => 
        !t.completed && 
        t.reminderTime && 
        t.reminderTime <= now && 
        !t.reminderDismissed && 
        !triggeredIds.current.has(t.id)
      );

      if (triggered) {
        setActiveAlarm(triggered);
        triggeredIds.current.add(triggered.id);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tasks]);

  const addTask = () => {
    if (!inputValue.trim()) return;
    
    let reminderTimestamp: number | undefined;
    if (reminderAt) {
      const date = new Date();
      const [hours, minutes] = reminderAt.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
      
      // If time is in the past, assume it's for tomorrow
      if (date.getTime() < Date.now()) {
        date.setDate(date.getDate() + 1);
      }
      reminderTimestamp = date.getTime();
    }

    const newTask: Task = {
      id: crypto.randomUUID(),
      text: inputValue.trim(),
      completed: false,
      createdAt: Date.now(),
      reminderTime: reminderTimestamp,
      reminderDismissed: false,
    };
    setTasks([newTask, ...tasks]);
    setInputValue('');
    setReminderAt('');
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed, reminderDismissed: t.completed ? t.reminderDismissed : true } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
    if (activeAlarm?.id === id) setActiveAlarm(null);
  };

  const clearCompleted = () => {
    setTasks(tasks.filter(t => !t.completed));
  };

  const dismissAlarm = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, reminderDismissed: true } : t));
    setActiveAlarm(null);
  };

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case 'active': return tasks.filter(t => !t.completed);
      case 'completed': return tasks.filter(t => t.completed);
      default: return tasks;
    }
  }, [tasks, filter]);

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.completed).length,
    active: tasks.filter(t => !t.completed).length,
    progress: tasks.length === 0 ? 0 : Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100),
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-500">
      <div className="max-w-xl mx-auto relative">
        {/* Alarm Display */}
        <AnimatePresence>
          {activeAlarm && (
            <motion.div
              initial={{ opacity: 0, y: -100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -100, scale: 0.9 }}
              className="fixed inset-x-4 top-8 z-50 flex justify-center pointer-events-none"
            >
              <div className="bg-black text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border border-white/20 pointer-events-auto max-w-md w-full animate-pulse-subtle">
                <div className="bg-red-500 p-2 rounded-full">
                  <Bell className="animate-bounce" size={24} />
                </div>
                <div className="flex-grow">
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-0.5">Reminder</p>
                  <p className="text-sm font-medium leading-tight">{activeAlarm.text}</p>
                </div>
                <button 
                  onClick={() => dismissAlarm(activeAlarm.id)}
                  className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-black text-white mb-4 shadow-lg"
          >
            <ListTodo size={24} />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-semibold tracking-tight text-gray-900"
          >
            ZenTask
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-500 mt-2 font-light"
          >
            Focus on what matters, one step at a time.
          </motion.p>
        </header>

        {/* Progress Bar */}
        {tasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            className="mb-8"
          >
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Progress</span>
              <span className="text-xs font-semibold text-gray-900">{stats.progress}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.progress}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                className="h-full bg-black rounded-full"
              />
            </div>
          </motion.div>
        )}

        {/* Input Area */}
        <div className="space-y-4 mb-10">
          <div className="relative group">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder="What needs to be done?"
              className="w-full pl-5 pr-14 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all shadow-sm placeholder:text-gray-400 text-gray-900"
            />
            <button
              onClick={addTask}
              disabled={!inputValue.trim()}
              className="absolute right-2 top-2 bottom-2 px-4 bg-black text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>
          
          <div className="flex items-center gap-3 px-1">
            <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wider">
              <Clock size={14} />
              Set Reminder:
            </div>
            <input 
              type="time" 
              value={reminderAt}
              onChange={(e) => setReminderAt(e.target.value)}
              className="bg-white border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-medium focus:border-black focus:outline-none transition-all cursor-pointer"
            />
            {reminderAt && (
              <button 
                onClick={() => setReminderAt('')}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Clear reminder"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {tasks.length > 0 && (
          <div className="flex items-center justify-between mb-6 px-1">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {(['active', 'all', 'completed'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    filter === f
                      ? 'bg-white text-black shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {stats.completed > 0 && (
              <button
                onClick={clearCompleted}
                className="text-xs font-medium text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                Clear completed
              </button>
            )}
          </div>
        )}

        {/* Task List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  task.completed
                    ? 'bg-gray-50/50 border-gray-100'
                    : 'bg-white border-gray-200 shadow-sm hover:border-gray-300'
                }`}
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`flex-shrink-0 transition-colors ${
                    task.completed ? 'text-green-500' : 'text-gray-300 hover:text-gray-400'
                  }`}
                >
                  {task.completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                </button>
                <div 
                  onClick={() => toggleTask(task.id)}
                  className="flex-grow flex flex-col cursor-pointer"
                >
                  <span
                    className={`text-[15px] transition-all leading-tight ${
                      task.completed ? 'text-gray-400 line-through' : 'text-gray-700'
                    }`}
                  >
                    {task.text}
                  </span>
                  {task.reminderTime && !task.completed && (
                    <div className={`flex items-center gap-1 mt-1.5 text-[10px] uppercase tracking-wider font-bold ${
                      task.reminderTime <= Date.now() && !task.reminderDismissed ? 'text-red-500' : 'text-gray-400'
                    }`}>
                      <Bell size={10} />
                      {formatTime(task.reminderTime)}
                      {task.reminderTime <= Date.now() && !task.reminderDismissed && " • Triggered"}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty States */}
          {filteredTasks.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-20 text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 text-gray-300 mb-4">
                {filter === 'completed' ? <Check size={32} /> : <Filter size={32} />}
              </div>
              <p className="text-gray-400 font-light">
                {filter === 'all'
                  ? "Your list is empty. Time to start something new."
                  : filter === 'active'
                  ? "All caught up! Nothing left to do."
                  : "No completed tasks yet."}
              </p>
            </motion.div>
          )}
        </div>

        {/* Footer Stats */}
        {tasks.length > 0 && (
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12 pt-8 border-t border-gray-100 flex justify-between items-center text-[11px] uppercase tracking-widest text-gray-400 font-medium"
          >
            <div>{stats.active} items left</div>
            <div className="flex gap-4">
              <span>{stats.completed} completed</span>
              <span className="text-gray-200">|</span>
              <span>{stats.total} total</span>
            </div>
          </motion.footer>
        )}
      </div>
    </div>
  );
}
