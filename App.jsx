import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BriefcaseBusiness,
  CalendarDays,
  Check,
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
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const blankTask = {
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
  source_id: '',
  source_label: '',
  project_ids: [],
  project_names: [],
  activity_count: 0,
};

const starterTasks = [
  {
    ...blankTask,
    id: crypto.randomUUID(),
    title: 'Plan today across personal and work',
    notes: 'Pick a few things that would make the day feel handled.',
    status: 'today',
    priority: 'high',
    due_date: today(),
    tags: ['planning'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  },
  {
    ...blankTask,
    id: crypto.randomUUID(),
    title: 'Review professional commitments',
    aspect: 'professional',
    status: 'scheduled',
    due_date: addDays(2),
    tags: ['review'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  },
];

const navItems = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'personal', label: 'Personal', icon: UserRound },
  { id: 'professional', label: 'Work', icon: BriefcaseBusiness },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarDays },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function normalizeTask(task) {
  return {
    ...blankTask,
    ...task,
    tags: Array.isArray(task.tags) ? task.tags : [],
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
  };
}

function isOverdue(task) {
  return task.status !== 'done' && task.due_date && task.due_date < today();
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [sources, setSources] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [activeView, setActiveView] = useState('today');
  const [search, setSearch] = useState('');
  const [aspectFilter, setAspectFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [editingTask, setEditingTask] = useState(null);
  const [message, setMessage] = useState('');
  const [dataMode, setDataMode] = useState('local');
  const [needsAccessCode, setNeedsAccessCode] = useState(false);
  const [accessCode, setAccessCode] = useState(
    () => localStorage.getItem(ACCESS_CODE_KEY) || '',
  );
  const [isLoading, setIsLoading] = useState(true);

  const isDemoMode = dataMode !== 'airtable';
  const taskSources = sources.filter((source) => source.role === 'tasks');

  const loadLocalTasks = useCallback((notice = '') => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setTasks(stored ? JSON.parse(stored).map(normalizeTask) : starterTasks);
    setDataMode('local');
    setNeedsAccessCode(false);
    setMessage(notice);
  }, []);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const payload = await fetchTasks(accessCode);
      setSources(payload.sources || []);
      setProjects(payload.projects || []);
      setActivities(payload.activities || []);
      setTasks(payload.tasks.map(normalizeTask));
      setDataMode('airtable');
      setNeedsAccessCode(false);
      if (accessCode) localStorage.setItem(ACCESS_CODE_KEY, accessCode);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setTasks([]);
        setDataMode('locked');
        setNeedsAccessCode(true);
        setMessage(error.message);
      } else {
        loadLocalTasks(
          error instanceof ApiError && error.status === 503
            ? error.message
            : 'Airtable is not connected here yet, so local demo storage is active.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessCode, loadLocalTasks]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const groups = useMemo(() => {
    const active = tasks.filter((task) => task.status !== 'done');
    return {
      today: active.filter((task) => task.status === 'today' || task.due_date === today()),
      personal: active.filter((task) => task.aspect === 'personal'),
      professional: active.filter((task) => task.aspect === 'professional'),
      upcoming: active.filter((task) => task.due_date && task.due_date > today()),
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
    const source = groups[activeView] || tasks;
    return source
      .filter((task) => {
        const text = `${task.title} ${task.notes} ${task.area}`.toLowerCase();
        return (
          text.includes(search.trim().toLowerCase()) &&
          (sourceFilter === 'all' || task.source_id === sourceFilter) &&
          (aspectFilter === 'all' || task.aspect === aspectFilter) &&
          (priorityFilter === 'all' || task.priority === priorityFilter) &&
          (tagFilter === 'all' || task.tags.includes(tagFilter))
        );
      })
      .sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [activeView, aspectFilter, groups, priorityFilter, search, sourceFilter, tagFilter, tasks]);

  function persistLocal(nextTasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
    setTasks(nextTasks);
  }

  function startNewTask(aspect = 'personal') {
    setEditingTask({
      ...blankTask,
      id: null,
      aspect,
      status: activeView === 'today' ? 'today' : 'inbox',
      due_date: activeView === 'today' ? today() : '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      source_id: sourceFilter === 'all' ? taskSources[0]?.id || '' : sourceFilter,
    });
  }

  async function saveTask(task) {
    const now = new Date().toISOString();
    const cleanTask = normalizeTask({
      ...task,
      title: task.title.trim(),
      notes: task.notes.trim(),
      area: task.area.trim(),
      updated_at: now,
      completed_at: task.status === 'done' ? task.completed_at || now : null,
    });

    if (!cleanTask.title) return;

    if (isDemoMode) {
      const exists = tasks.some((item) => item.id === cleanTask.id);
      const nextTasks = exists
        ? tasks.map((item) => (item.id === cleanTask.id ? cleanTask : item))
        : [{ ...cleanTask, id: crypto.randomUUID(), created_at: now }, ...tasks];
      persistLocal(nextTasks);
      setEditingTask(null);
      return;
    }

    try {
      const savedTask = normalizeTask(await saveRemoteTask(cleanTask, accessCode));
      setTasks((current) =>
        current.some((item) => item.id === savedTask.id)
          ? current.map((item) => (item.id === savedTask.id ? savedTask : item))
          : [savedTask, ...current],
      );
      setEditingTask(null);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function patchTask(taskId, patch) {
    const task = tasks.find((item) => item.id === taskId);
    if (task) await saveTask({ ...task, ...patch });
  }

  async function removeTask(taskId) {
    if (isDemoMode) {
      persistLocal(tasks.filter((task) => task.id !== taskId));
      setEditingTask(null);
      return;
    }

    try {
      const task = tasks.find((item) => item.id === taskId);
      await deleteRemoteTask(task || taskId, accessCode);
      setTasks((current) => current.filter((task) => task.id !== taskId));
      setEditingTask(null);
    } catch (error) {
      setMessage(error.message);
    }
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
        <SummaryCard label="Today" value={groups.today.length} icon={Star} />
        <SummaryCard label="Overdue" value={groups.overdue.length} icon={Clock3} tone="alert" />
        <SummaryCard label="Done" value={groups.completed.length} icon={Check} />
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
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks" />
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
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
            <option value="all">All sources</option>
            {taskSources.map((source) => (
              <option key={source.id} value={source.id}>{source.label}</option>
            ))}
          </select>
        </div>
      </section>

      <ViewTabs activeView={activeView} counts={groups} onChange={setActiveView} />

      <section className="task-list" aria-live="polite">
        {isLoading ? (
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
              onToday={() => patchTask(task.id, { status: 'today', due_date: today() })}
              onDefer={() => patchTask(task.id, { status: 'scheduled', due_date: addDays(1) })}
            />
          ))
        ) : (
          <EmptyState title="Nothing here yet" body="Capture a task or adjust your filters to bring items into view." />
        )}
      </section>

      {message && <p className="toast">{message}</p>}

      <BottomNav items={navItems} activeView={activeView} onChange={setActiveView} />

      {editingTask && (
        <TaskEditor
          task={editingTask}
          sources={taskSources}
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
          onUseLocal={() => loadLocalTasks('Local demo storage is active.')}
          onClose={() => setActiveView('today')}
          sources={sources}
          projects={projects}
          activities={activities}
        />
      )}
    </main>
  );
}

function SummaryCard({ label, value, icon: Icon, tone = '' }) {
  return (
    <article className={`summary-card ${tone}`}>
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
        <button key={id} type="button" className={activeView === id ? 'active' : ''} onClick={() => onChange(id)}>
          {label}<span>{count}</span>
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
          {task.source_label ? ` / ${task.source_label}` : ''}
          {task.project_names?.length ? ` / ${task.project_names.join(', ')}` : ''}
          {task.area ? ` / ${task.area}` : ''}
          {task.due_date ? ` / ${task.due_date}` : ''}
        </span>
        {task.activity_count > 0 && (
          <span className="task-meta">{task.activity_count} things done</span>
        )}
        {task.tags.length > 0 && (
          <span className="tag-list">
            {task.tags.map((tag) => (
              <span key={tag}><Tag size={12} /> {tag}</span>
            ))}
          </span>
        )}
      </button>
      <div className="task-actions">
        {!done && (
          <>
            <button type="button" onClick={onToday} title="Move to today"><Star size={17} /></button>
            <button type="button" onClick={onDefer} title="Defer to tomorrow"><RotateCcw size={17} /></button>
          </>
        )}
      </div>
    </article>
  );
}

function TaskEditor({ task, sources, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(normalizeTask(task));
  const setField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  return (
    <div className="drawer-backdrop">
      <form className="task-editor" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
        <header>
          <h2>{draft.id ? 'Edit task' : 'New task'}</h2>
          <button type="button" className="icon-button subtle" onClick={onClose}><X size={20} /></button>
        </header>
        <label>Title<input value={draft.title} onChange={(event) => setField('title', event.target.value)} required /></label>
        <label>Notes<textarea value={draft.notes} onChange={(event) => setField('notes', event.target.value)} /></label>
        <div className="two-column">
          <label>Aspect<select value={draft.aspect} onChange={(event) => setField('aspect', event.target.value)}><option value="personal">Personal</option><option value="professional">Professional</option></select></label>
          <label>Priority<select value={draft.priority} onChange={(event) => setField('priority', event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        </div>
        <div className="two-column">
          <label>Status<select value={draft.status} onChange={(event) => setField('status', event.target.value)}><option value="inbox">Inbox</option><option value="today">Today</option><option value="scheduled">Scheduled</option><option value="waiting">Waiting</option><option value="done">Done</option></select></label>
          <label>Due date<input type="date" value={draft.due_date || ''} onChange={(event) => setField('due_date', event.target.value)} /></label>
        </div>
        <label>Area or project<input value={draft.area} onChange={(event) => setField('area', event.target.value)} /></label>
        <label>Tags<input value={draft.tags.join(', ')} onChange={(event) => setField('tags', event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))} /></label>
        {sources.length > 1 && (
          <label>
            Airtable source
            <select value={draft.source_id || sources[0]?.id || ''} onChange={(event) => setField('source_id', event.target.value)}>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>{source.label}</option>
              ))}
            </select>
          </label>
        )}
        <label className="checkbox-label"><input type="checkbox" checked={draft.is_recurring} onChange={(event) => setField('is_recurring', event.target.checked)} />Recurring task</label>
        <footer>
          {draft.id && <button type="button" className="danger-button" onClick={() => onDelete(draft.id)}>Delete</button>}
          <button type="submit" className="primary-button">Save task</button>
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
          <button key={item.id} type="button" className={activeView === item.id ? 'active' : ''} onClick={() => onChange(item.id)}>
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
  sources,
  projects,
  activities,
}) {
  return (
    <div className="drawer-backdrop">
      <section className="task-editor settings-drawer">
        <header>
          <h2>Settings</h2>
          <button type="button" className="icon-button subtle" onClick={onClose}><X size={20} /></button>
        </header>
        <article className="settings-block">
          <Archive size={22} />
          <div>
            <h3>{isDemoMode ? 'Local demo storage' : 'Airtable sync active'}</h3>
            <p>{isDemoMode ? 'Add Airtable environment variables on Vercel to use your live Airtable base.' : 'Tasks are saved through a private API bridge, so the Airtable token stays off the browser.'}</p>
          </div>
        </article>
        {sources.length > 0 && (
          <article className="settings-block">
            <Archive size={22} />
            <div>
              <h3>Airtable sources</h3>
              <p>
                {sources.filter((source) => source.role === 'tasks').length} task source(s),{' '}
                {projects.length} project record(s), {activities.length} done record(s).
              </p>
            </div>
          </article>
        )}
        {(needsAccessCode || dataMode === 'locked') && (
          <form className="access-form" onSubmit={(event) => { event.preventDefault(); onRetry(); }}>
            <label>Private app code<input type="password" value={accessCode} onChange={(event) => onAccessCodeChange(event.target.value)} /></label>
            <button className="primary-button" type="submit">Unlock</button>
          </form>
        )}
        <button type="button" className="secondary-button" onClick={onRetry}><RotateCcw size={18} /> Retry Airtable sync</button>
        <button type="button" className="secondary-button" onClick={onUseLocal}><Archive size={18} /> Use local demo storage</button>
      </section>
    </div>
  );
}

export default App;
