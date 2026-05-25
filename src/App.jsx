import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  Home,
  Inbox,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Star,
  Tag,
  UserRound,
  X,
} from 'lucide-react';
import { ApiError, deleteRemoteTask, fetchTasks, saveRemoteTask } from './lib/tasksApi';

const STORAGE_KEY = 'task-compass-demo-data';
const ACCESS_CODE_KEY = 'task-compass-access-code';
const navItems = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'personal', label: 'Personal', icon: UserRound },
  { id: 'professional', label: 'Work', icon: BriefcaseBusiness },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarDays },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const emptyTask = {
  title: '',
  notes: '',
  aspect: 'personal',
  area: '',
  status: 'inbox',
  priority: 'medium',
  due_date: '',
  tags: [],
  subtasks: [],
  is_recurring: false,
};

const starterTasks = [
  {
    ...emptyTask,
    id: crypto.randomUUID(),
    title: 'Plan today across personal and work',
    notes: 'Pick the few tasks that would make the day feel handled.',
    aspect: 'personal',
    status: 'today',
    priority: 'high',
    due_date: todayKey(),
    tags: ['planning'],
    subtasks: [
      { id: crypto.randomUUID(), title: 'Choose personal focus', is_done: false },
      { id: crypto.randomUUID(), title: 'Choose work focus', is_done: false },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  },
  {
    ...emptyTask,
    id: crypto.randomUUID(),
    title: 'Review professional commitments',
    aspect: 'professional',
    status: 'scheduled',
    priority: 'medium',
    due_date: addDays(2),
    tags: ['review'],
    subtasks: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function isOverdue(task) {
  return task.status !== 'done' && task.due_date && task.due_date < todayKey();
}

function isDueToday(task) {
  return task.status !== 'done' && task.due_date === todayKey();
}

function normalizeTask(task) {
  return {
    ...emptyTask,
    ...task,
    tags: Array.isArray(task.tags) ? task.tags : [],
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
  };
}

function App() {
  const [appMessage, setAppMessage] = useState('');
  const [accessCode, setAccessCode] = useState(
    () => localStorage.getItem(ACCESS_CODE_KEY) || '',
  );
  const [needsAccessCode, setNeedsAccessCode] = useState(false);
  const [dataMode, setDataMode] = useState('local');
  const [tasks, setTasks] = useState([]);
  const [activeView, setActiveView] = useState('today');
  const [search, setSearch] = useState('');
  const [aspectFilter, setAspectFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [editingTask, setEditingTask] = useState(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  const isDemoMode = dataMode !== 'airtable';

  const taskGroups = useMemo(() => {
    const active = tasks.filter((task) => task.status !== 'done');
    return {
      today: active.filter((task) => task.status === 'today' || isDueToday(task)),
      personal: active.filter((task) => task.aspect === 'personal'),
      professional: active.filter((task) => task.aspect === 'professional'),
      upcoming: active.filter((task) => task.due_date && task.due_date > todayKey()),
      overdue: active.filter(isOverdue),
      completed: tasks.filter((task) => task.status === 'done'),
      inbox: active.filter((task) => task.status === 'inbox'),
      waiting: active.filter((task) => task.status === 'waiting'),
    };
  }, [tasks]);

  const allTags = useMemo(
    () => [...new Set(tasks.flatMap((task) => task.tags || []))].sort(),
    [tasks],
  );

  const visibleTasks = useMemo(() => {
    const source = taskGroups[activeView] || tasks;
    return source
      .filter((task) => {
        const text = `${task.title} ${task.notes} ${task.area}`.toLowerCase();
        const matchesSearch = text.includes(search.trim().toLowerCase());
        const matchesAspect = aspectFilter === 'all' || task.aspect === aspectFilter;
        const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
        const matchesTag = tagFilter === 'all' || task.tags?.includes(tagFilter);
        return matchesSearch && matchesAspect && matchesPriority && matchesTag;
      })
      .sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (a.status !== 'done' && b.status === 'done') return -1;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [activeView, aspectFilter, priorityFilter, search, tagFilter, taskGroups, tasks]);

  const loadTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    setAppMessage('');

    try {
      const remoteTasks = await fetchTasks(accessCode);
      setTasks(remoteTasks.map(normalizeTask));
      setDataMode('airtable');
      setNeedsAccessCode(false);
      if (accessCode) {
        localStorage.setItem(ACCESS_CODE_KEY, accessCode);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setNeedsAccessCode(true);
        setDataMode('locked');
        setTasks([]);
        setAppMessage(error.message);
      } else {
        setDataMode('local');
        setNeedsAccessCode(false);
        setAppMessage(
          error instanceof ApiError && error.status === 503
            ? error.message
            : 'Airtable is not connected here yet, so local demo storage is active.',
        );
        const stored = localStorage.getItem(STORAGE_KEY);
        setTasks(stored ? JSON.parse(stored).map(normalizeTask) : starterTasks);
      }
    } finally {
      setIsLoadingTasks(false);
    }
  }, [accessCode]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  function loadLocalTasks() {
    const stored = localStorage.getItem(STORAGE_KEY);
    setTasks(stored ? JSON.parse(stored).map(normalizeTask) : starterTasks);
    setDataMode('local');
    setNeedsAccessCode(false);
    setAppMessage('Local demo storage is active.');
  }

  function persistDemo(nextTasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
    setTasks(nextTasks);
  }

  async function saveTask(formTask) {
    const now = new Date().toISOString();
    const cleanTask = normalizeTask({
      ...formTask,
      title: formTask.title.trim(),
      notes: formTask.notes.trim(),
      area: formTask.area.trim(),
      updated_at: now,
      completed_at: formTask.status === 'done' ? formTask.completed_at || now : null,
    });

    if (!cleanTask.title) return;

    if (isDemoMode) {
      const exists = tasks.some((task) => task.id === cleanTask.id);
      const nextTasks = exists
        ? tasks.map((task) => (task.id === cleanTask.id ? cleanTask : task))
        : [
            {
              ...cleanTask,
              id: crypto.randomUUID(),
              created_at: now,
              updated_at: now,
            },
            ...tasks,
          ];
      persistDemo(nextTasks);
      setEditingTask(null);
      return;
    }

    try {
      const savedTask = await saveRemoteTask(cleanTask, accessCode);
      const exists = tasks.some((task) => task.id === savedTask.id);
      setTasks((currentTasks) =>
        exists
          ? currentTasks.map((task) => (task.id === savedTask.id ? normalizeTask(savedTask) : task))
          : [normalizeTask(savedTask), ...currentTasks],
      );
      setEditingTask(null);
    } catch (error) {
      setAppMessage(error.message);
    }
  }

  async function patchTask(taskId, patch) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    await saveTask({ ...task, ...patch });
  }

  async function removeTask(taskId) {
    if (isDemoMode) {
      persistDemo(tasks.filter((task) => task.id !== taskId));
      setEditingTask(null);
      return;
    }

    try {
      await deleteRemoteTask(taskId, accessCode);
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
      setEditingTask(null);
    } catch (error) {
      setAppMessage(error.message);
    }
  }

  function startNewTask(aspect = 'personal') {
    setEditingTask({
      ...emptyTask,
      id: null,
      aspect,
      status: activeView === 'today' ? 'today' : 'inbox',
      due_date: activeView === 'today' ? todayKey() : '',
      tags: [],
      subtasks: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    });
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">{isDemoMode ? 'Local demo mode' : 'Synced with Airtable'}</p>
          <h1>Task Compass</h1>
        </div>
        <button className="icon-button" type="button" onClick={() => startNewTask()}>
          <Plus size={22} />
          <span className="sr-only">Add task</span>
        </button>
      </section>

      <section className="focus-strip" aria-label="Daily task summary">
        <SummaryCard label="Today" value={taskGroups.today.length} icon={Star} />
        <SummaryCard label="Overdue" value={taskGroups.overdue.length} icon={Clock3} tone="alert" />
        <SummaryCard label="Done" value={taskGroups.completed.length} icon={Check} />
      </section>

      <section className="quick-add">
        <button type="button" onClick={() => startNewTask('personal')}>
          <UserRound size={18} /> Personal
        </button>
        <button type="button" onClick={() => startNewTask('professional')}>
          <BriefcaseBusiness size={18} /> Professional
        </button>
      </section>

      <section className="filters" aria-label="Task filters">
        <label className="search-field">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks"
          />
        </label>
        <div className="filter-row">
          <select value={aspectFilter} onChange={(event) => setAspectFilter(event.target.value)}>
            <option value="all">All aspects</option>
            <option value="personal">Personal</option>
            <option value="professional">Professional</option>
          </select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="all">All tags</option>
            {allTags.map((tag) => (
              <option value={tag} key={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </section>

      <ViewTabs activeView={activeView} counts={taskGroups} onChange={setActiveView} />

      <section className="task-list" aria-live="polite">
        {isLoadingTasks ? (
          <EmptyState title="Loading tasks" body="Gathering the latest version of your list." />
        ) : visibleTasks.length ? (
          visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={() => setEditingTask(task)}
              onComplete={() =>
                patchTask(task.id, {
                  status: task.status === 'done' ? 'inbox' : 'done',
                  completed_at: task.status === 'done' ? null : new Date().toISOString(),
                })
              }
              onToday={() => patchTask(task.id, { status: 'today', due_date: todayKey() })}
              onDefer={() => patchTask(task.id, { status: 'scheduled', due_date: addDays(1) })}
            />
          ))
        ) : (
          <EmptyState
            title="Nothing here yet"
            body="Capture a task or adjust your filters to bring items into view."
          />
        )}
      </section>

      {appMessage && <p className="toast">{appMessage}</p>}

      <BottomNav items={navItems} activeView={activeView} onChange={setActiveView} />

      {editingTask && (
        <TaskEditor
          task={editingTask}
          onSave={saveTask}
          onDelete={removeTask}
          onClose={() => setEditingTask(null)}
        />
      )}

      {activeView === 'settings' && (
        <SettingsPanel
          dataMode={dataMode}
          isDemoMode={isDemoMode}
          accessCode={accessCode}
          needsAccessCode={needsAccessCode}
          onAccessCodeChange={setAccessCode}
          onRetry={loadTasks}
          onUseLocal={loadLocalTasks}
          onClose={() => setActiveView('today')}
        />
      )}
    </main>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }) {
  return (
    <article className={`summary-card ${tone || ''}`}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ViewTabs({ activeView, counts, onChange }) {
  const tabs = [
    ['today', 'Today', counts.today.length],
    ['personal', 'Personal', counts.personal.length],
    ['professional', 'Work', counts.professional.length],
    ['upcoming', 'Upcoming', counts.upcoming.length],
    ['overdue', 'Overdue', counts.overdue.length],
    ['completed', 'Done', counts.completed.length],
    ['inbox', 'Inbox', counts.inbox.length],
    ['waiting', 'Waiting', counts.waiting.length],
  ];

  return (
    <section className="view-tabs" aria-label="Task views">
      {tabs.map(([id, label, count]) => (
        <button
          key={id}
          type="button"
          className={activeView === id ? 'active' : ''}
          onClick={() => onChange(id)}
        >
          {label}
          <span>{count}</span>
        </button>
      ))}
    </section>
  );
}

function TaskCard({ task, onOpen, onComplete, onToday, onDefer }) {
  const done = task.status === 'done';
  return (
    <article className={`task-card priority-${task.priority} ${done ? 'done' : ''}`}>
      <button className="complete-button" type="button" onClick={onComplete}>
        {done ? <Check size={18} /> : <Circle size={18} />}
        <span className="sr-only">{done ? 'Reopen task' : 'Complete task'}</span>
      </button>
      <button className="task-body" type="button" onClick={onOpen}>
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          {task.aspect}
          {task.area ? ` / ${task.area}` : ''}
          {task.due_date ? ` / ${task.due_date}` : ''}
        </span>
        {task.tags?.length > 0 && (
          <span className="tag-list">
            {task.tags.map((tag) => (
              <span key={tag}>
                <Tag size={12} /> {tag}
              </span>
            ))}
          </span>
        )}
      </button>
      <div className="task-actions">
        {!done && (
          <>
            <button type="button" onClick={onToday} title="Move to today">
              <Star size={17} />
            </button>
            <button type="button" onClick={onDefer} title="Defer to tomorrow">
              <RotateCcw size={17} />
            </button>
          </>
        )}
        <button type="button" onClick={onOpen} title="Edit task">
          <ChevronRight size={18} />
        </button>
      </div>
    </article>
  );
}

function TaskEditor({ task, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(normalizeTask(task));
  const tagText = draft.tags.join(', ');

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateSubtask(id, patch) {
    setDraft((current) => ({
      ...current,
      subtasks: current.subtasks.map((subtask) =>
        subtask.id === id ? { ...subtask, ...patch } : subtask,
      ),
    }));
  }

  function addSubtask() {
    setDraft((current) => ({
      ...current,
      subtasks: [
        ...current.subtasks,
        { id: crypto.randomUUID(), title: '', is_done: false },
      ],
    }));
  }

  return (
    <div className="drawer-backdrop">
      <form
        className="task-editor"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <header>
          <h2>{draft.id ? 'Edit task' : 'New task'}</h2>
          <button type="button" className="icon-button subtle" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <label>
          Title
          <input
            value={draft.title}
            onChange={(event) => setField('title', event.target.value)}
            placeholder="What needs attention?"
            required
          />
        </label>

        <label>
          Notes
          <textarea
            value={draft.notes}
            onChange={(event) => setField('notes', event.target.value)}
            placeholder="Context, links, decisions, or next step"
          />
        </label>

        <div className="two-column">
          <label>
            Aspect
            <select value={draft.aspect} onChange={(event) => setField('aspect', event.target.value)}>
              <option value="personal">Personal</option>
              <option value="professional">Professional</option>
            </select>
          </label>
          <label>
            Priority
            <select
              value={draft.priority}
              onChange={(event) => setField('priority', event.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <div className="two-column">
          <label>
            Status
            <select value={draft.status} onChange={(event) => setField('status', event.target.value)}>
              <option value="inbox">Inbox</option>
              <option value="today">Today</option>
              <option value="scheduled">Scheduled</option>
              <option value="waiting">Waiting</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label>
            Due date
            <input
              type="date"
              value={draft.due_date || ''}
              onChange={(event) => setField('due_date', event.target.value)}
            />
          </label>
        </div>

        <label>
          Area or project
          <input
            value={draft.area}
            onChange={(event) => setField('area', event.target.value)}
            placeholder="Home, health, client, admin..."
          />
        </label>

        <label>
          Tags
          <input
            value={tagText}
            onChange={(event) =>
              setField(
                'tags',
                event.target.value
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              )
            }
            placeholder="planning, errands, deep-work"
          />
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.is_recurring}
            onChange={(event) => setField('is_recurring', event.target.checked)}
          />
          Recurring task
        </label>

        <section className="subtasks">
          <div>
            <h3>Subtasks</h3>
            <button type="button" onClick={addSubtask}>
              <Plus size={16} /> Add
            </button>
          </div>
          {draft.subtasks.map((subtask) => (
            <label key={subtask.id} className="subtask-row">
              <input
                type="checkbox"
                checked={subtask.is_done}
                onChange={(event) => updateSubtask(subtask.id, { is_done: event.target.checked })}
              />
              <input
                value={subtask.title}
                onChange={(event) => updateSubtask(subtask.id, { title: event.target.value })}
                placeholder="Small next step"
              />
            </label>
          ))}
        </section>

        <footer>
          {draft.id && (
            <button type="button" className="danger-button" onClick={() => onDelete(draft.id)}>
              Delete
            </button>
          )}
          <button type="submit" className="primary-button">
            Save task
          </button>
        </footer>
      </form>
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <article className="empty-state">
      <Inbox size={28} />
      <h2>{title}</h2>
      <p>{body}</p>
    </article>
  );
}

function BottomNav({ items, activeView, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={activeView === item.id ? 'active' : ''}
            onClick={() => onChange(item.id)}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function SettingsPanel({
  dataMode,
  isDemoMode,
  accessCode,
  needsAccessCode,
  onAccessCodeChange,
  onRetry,
  onUseLocal,
  onClose,
}) {
  return (
    <div className="drawer-backdrop">
      <section className="task-editor settings-drawer">
        <header>
          <h2>Settings</h2>
          <button type="button" className="icon-button subtle" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <article className="settings-block">
          <Archive size={22} />
          <div>
            <h3>{isDemoMode ? 'Local demo storage' : 'Airtable sync active'}</h3>
            <p>
              {isDemoMode
                ? 'Add Airtable environment variables on Vercel to use your live Airtable base.'
                : 'Tasks are saved through a private API bridge, so the Airtable token stays off the browser.'}
            </p>
          </div>
        </article>
        {(needsAccessCode || dataMode === 'locked') && (
          <form
            className="access-form"
            onSubmit={(event) => {
              event.preventDefault();
              onRetry();
            }}
          >
            <label>
              Private app code
              <input
                type="password"
                value={accessCode}
                onChange={(event) => onAccessCodeChange(event.target.value)}
                placeholder="Enter your access code"
              />
            </label>
            <button className="primary-button" type="submit">
              Unlock
            </button>
          </form>
        )}
        <button type="button" className="secondary-button" onClick={onRetry}>
          <RotateCcw size={18} /> Retry Airtable sync
        </button>
        <button type="button" className="secondary-button" onClick={onUseLocal}>
          <Archive size={18} /> Use local demo storage
        </button>
      </section>
    </div>
  );
}

export default App;
