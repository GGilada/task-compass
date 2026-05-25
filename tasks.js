const AIRTABLE_API_URL = 'https://api.airtable.com/v0';
const AIRTABLE_META_URL = 'https://api.airtable.com/v0/meta';
const FIELD_ALIASES = {
  title: ['Title', 'Name', 'Task', 'Task Name', 'Summary'],
  notes: ['Notes', 'Description', 'Details', 'Context'],
  aspect: ['Aspect', 'Category', 'Type', 'Domain'],
  area: ['Area', 'Area or Project', 'Project Name'],
  project: ['Project', 'Projects'],
  task: ['Task', 'Tasks'],
  status: ['Status', 'State', 'Stage'],
  priority: ['Priority', 'Importance'],
  due_date: ['Due Date', 'Due', 'Deadline', 'Date'],
  tags: ['Tags', 'Tag', 'Labels'],
  subtasks: ['Subtasks', 'Sub Tasks', 'Checklist'],
  is_recurring: ['Recurring', 'Repeating', 'Repeat'],
  created_at: [],
  updated_at: [],
  completed_at: ['Completed At', 'Completed', 'Done At'],
};

function requireConfig() {
  const token = process.env.AIRTABLE_TOKEN;
  const sources = parseSources(process.env.AIRTABLE_SOURCES);

  if (!sources.length && process.env.AIRTABLE_BASE_ID) {
    sources.push({
      id: 'primary',
      label: process.env.AIRTABLE_TABLE_NAME || 'Tasks',
      baseId: process.env.AIRTABLE_BASE_ID,
      tableName: process.env.AIRTABLE_TABLE_NAME || 'Tasks',
    });
  }

  if (!token || !sources.length) {
    throw new Error('Airtable is not configured. Add AIRTABLE_TOKEN and AIRTABLE_SOURCES.');
  }

  return { token, sources };
}

function parseSources(rawSources) {
  if (!rawSources) return [];

  return rawSources
    .split(';')
    .map((source, index) => {
      const [label, baseId, tableName, role = 'tasks'] = source
        .split('|')
        .map((part) => part?.trim());
      if (!baseId || !tableName) return null;

      return {
        id: sourceId(baseId, tableName, index),
        label: label || tableName,
        baseId,
        tableName,
        role: normalizeRole(role),
      };
    })
    .filter(Boolean);
}

function normalizeRole(role) {
  const normalized = String(role || 'tasks').trim().toLowerCase();
  if (['project', 'projects'].includes(normalized)) return 'projects';
  if (['done', 'activity', 'activities', 'things done', 'things'].includes(normalized)) {
    return 'activity';
  }
  return 'tasks';
}

function sourceId(baseId, tableName, index = 0) {
  return `${baseId}:${tableName}:${index}`;
}

function getSource(config, sourceIdToFind) {
  if (!sourceIdToFind) return config.sources[0];
  return config.sources.find((source) => source.id === sourceIdToFind) || config.sources[0];
}

function checkAccessCode(req) {
  const requiredCode = process.env.APP_ACCESS_CODE;
  if (!requiredCode) return true;

  return req.headers['x-app-code'] === requiredCode;
}

function airtableUrl(config, recordId = '') {
  const table = encodeURIComponent(config.tableName);
  const suffix = recordId ? `/${recordId}` : '';
  return `${AIRTABLE_API_URL}/${config.baseId}/${table}${suffix}`;
}

function metadataUrl(config) {
  return `${AIRTABLE_META_URL}/bases/${config.baseId}/tables`;
}

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeOption(value, fallback, allowed) {
  if (!value) return fallback;
  const normalized = String(value).trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function getField(fields, fieldMap, key) {
  const fieldName = fieldMap[key];
  return fieldName ? fields[fieldName] : undefined;
}

function setField(fields, fieldMap, key, value) {
  const fieldName = fieldMap[key];
  if (fieldName) fields[fieldName] = value;
}

function recordToTask(record, fieldMap) {
  const fields = record.fields || {};
  const now = new Date().toISOString();

  const projectValue = getField(fields, fieldMap, 'project');
  const projectIds = Array.isArray(projectValue) ? projectValue : [];

  return {
    id: record.id,
    title: getField(fields, fieldMap, 'title') || '',
    notes: getField(fields, fieldMap, 'notes') || '',
    aspect: normalizeOption(getField(fields, fieldMap, 'aspect'), 'personal', [
      'personal',
      'professional',
    ]),
    area: getField(fields, fieldMap, 'area') || '',
    project_ids: projectIds,
    project_names: [],
    activity_count: 0,
    status: normalizeOption(getField(fields, fieldMap, 'status'), 'inbox', [
      'inbox',
      'today',
      'scheduled',
      'waiting',
      'done',
    ]),
    priority: normalizeOption(getField(fields, fieldMap, 'priority'), 'medium', [
      'low',
      'medium',
      'high',
    ]),
    due_date: getField(fields, fieldMap, 'due_date') || '',
    tags: parseList(getField(fields, fieldMap, 'tags')),
    subtasks: parseJson(getField(fields, fieldMap, 'subtasks'), []),
    is_recurring: Boolean(getField(fields, fieldMap, 'is_recurring')),
    created_at: getField(fields, fieldMap, 'created_at') || now,
    updated_at: getField(fields, fieldMap, 'updated_at') || now,
    completed_at: getField(fields, fieldMap, 'completed_at') || null,
  };
}

function recordToProject(record, fieldMap, source) {
  const fields = record.fields || {};

  return {
    id: record.id,
    title: getField(fields, fieldMap, 'title') || '',
    notes: getField(fields, fieldMap, 'notes') || '',
    source_id: source.id,
    source_label: source.label,
  };
}

function recordToActivity(record, fieldMap, source) {
  const fields = record.fields || {};
  const taskValue = getField(fields, fieldMap, 'task');

  return {
    id: record.id,
    title: getField(fields, fieldMap, 'title') || '',
    notes: getField(fields, fieldMap, 'notes') || '',
    task_ids: Array.isArray(taskValue) ? taskValue : [],
    created_at: getField(fields, fieldMap, 'created_at') || new Date().toISOString(),
    source_id: source.id,
    source_label: source.label,
  };
}

function taskToFields(task, fieldMap) {
  const fields = {};
  setField(fields, fieldMap, 'title', task.title);
  setField(fields, fieldMap, 'notes', task.notes || '');
  setField(fields, fieldMap, 'aspect', task.aspect || 'personal');
  setField(fields, fieldMap, 'area', task.area || '');
  setField(fields, fieldMap, 'status', task.status || 'inbox');
  setField(fields, fieldMap, 'priority', task.priority || 'medium');
  setField(fields, fieldMap, 'due_date', task.due_date || null);
  setField(fields, fieldMap, 'tags', (task.tags || []).join(', '));
  setField(fields, fieldMap, 'subtasks', JSON.stringify(task.subtasks || []));
  setField(fields, fieldMap, 'is_recurring', Boolean(task.is_recurring));
  setField(fields, fieldMap, 'created_at', task.created_at || new Date().toISOString());
  setField(fields, fieldMap, 'updated_at', task.updated_at || new Date().toISOString());
  setField(fields, fieldMap, 'completed_at', task.completed_at || null);
  return fields;
}

async function callAirtable(token, path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || payload.error || 'Airtable request failed.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function getFieldMap(token, source) {
  const payload = await callAirtable(token, metadataUrl(source));
  const table = (payload.tables || []).find((item) => item.name === source.tableName);

  if (!table) {
    throw new Error(`Airtable table "${source.tableName}" was not found.`);
  }

  const names = new Set(table.fields.map((field) => field.name));
  const fieldMap = {};

  for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
    const envName = process.env[`AIRTABLE_FIELD_${key.toUpperCase()}`];
    if (envName && names.has(envName)) {
      fieldMap[key] = envName;
      continue;
    }

    const matched = aliases.find((alias) => names.has(alias));
    if (matched) fieldMap[key] = matched;
  }

  const primaryField = table.fields.find((field) => field.id === table.primaryFieldId);
  if (!fieldMap.title && primaryField) {
    fieldMap.title = primaryField.name;
  }

  if (!fieldMap.title) {
    throw new Error('Could not find a title/name field in your Airtable table.');
  }

  return fieldMap;
}

async function listTasks(config, source, fieldMap) {
  const tasks = [];
  let offset = '';

  do {
    const url = new URL(airtableUrl(source));
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);

    const payload = await callAirtable(config.token, url.toString());
    tasks.push(
      ...(payload.records || []).map((record) => ({
        ...recordToTask(record, fieldMap),
        source_id: source.id,
        source_label: source.label,
      })),
    );
    offset = payload.offset;
  } while (offset);

  return tasks;
}

async function listProjects(config, source, fieldMap) {
  const projects = [];
  let offset = '';

  do {
    const url = new URL(airtableUrl(source));
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);

    const payload = await callAirtable(config.token, url.toString());
    projects.push(
      ...(payload.records || []).map((record) => recordToProject(record, fieldMap, source)),
    );
    offset = payload.offset;
  } while (offset);

  return projects;
}

async function listActivities(config, source, fieldMap) {
  const activities = [];
  let offset = '';

  do {
    const url = new URL(airtableUrl(source));
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);

    const payload = await callAirtable(config.token, url.toString());
    activities.push(
      ...(payload.records || []).map((record) => recordToActivity(record, fieldMap, source)),
    );
    offset = payload.offset;
  } while (offset);

  return activities;
}

function enrichTasks(tasks, projects, activities) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const activityCounts = new Map();

  for (const activity of activities) {
    for (const taskId of activity.task_ids) {
      activityCounts.set(taskId, (activityCounts.get(taskId) || 0) + 1);
    }
  }

  return tasks.map((task) => ({
    ...task,
    project_names: (task.project_ids || [])
      .map((projectId) => projectById.get(projectId)?.title)
      .filter(Boolean),
    activity_count: activityCounts.get(task.id) || 0,
  }));
}

function send(res, status, payload) {
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (!checkAccessCode(req)) {
    send(res, 401, { error: 'Enter the private app access code.' });
    return;
  }

  let config;
  try {
    config = requireConfig();
  } catch (error) {
    send(res, 503, { error: error.message });
    return;
  }

  try {
    if (req.method === 'GET') {
      const taskSources = config.sources.filter((source) => source.role === 'tasks');
      const projectSources = config.sources.filter((source) => source.role === 'projects');
      const activitySources = config.sources.filter((source) => source.role === 'activity');

      const taskResults = await Promise.all(
        taskSources.map(async (source) => {
          const fieldMap = await getFieldMap(config.token, source);
          return listTasks(config, source, fieldMap);
        }),
      );
      const projectResults = await Promise.all(
        projectSources.map(async (source) => {
          const fieldMap = await getFieldMap(config.token, source);
          return listProjects(config, source, fieldMap);
        }),
      );
      const activityResults = await Promise.all(
        activitySources.map(async (source) => {
          const fieldMap = await getFieldMap(config.token, source);
          return listActivities(config, source, fieldMap);
        }),
      );

      const tasks = taskResults.flat();
      const projects = projectResults.flat();
      const activities = activityResults.flat();

      send(res, 200, {
        sources: config.sources.map(({ id, label, baseId, tableName, role }) => ({
          id,
          label,
          baseId,
          tableName,
          role,
        })),
        tasks: enrichTasks(tasks, projects, activities),
        projects,
        activities,
      });
      return;
    }

    const source = getSource(config, req.body?.source_id || req.query.source_id);
    if (source.role !== 'tasks') {
      send(res, 400, { error: 'Tasks can only be saved to sources marked as tasks.' });
      return;
    }
    const fieldMap = await getFieldMap(config.token, source);

    if (req.method === 'POST') {
      const now = new Date().toISOString();
      const task = { ...req.body, created_at: now, updated_at: now };
      const payload = await callAirtable(config.token, airtableUrl(source), {
        method: 'POST',
        body: JSON.stringify({ fields: taskToFields(task, fieldMap), typecast: true }),
      });
      send(res, 200, {
        task: {
          ...recordToTask(payload, fieldMap),
          source_id: source.id,
          source_label: source.label,
        },
      });
      return;
    }

    if (req.method === 'PATCH') {
      const task = { ...req.body, updated_at: new Date().toISOString() };
      const payload = await callAirtable(config.token, airtableUrl(source, task.id), {
        method: 'PATCH',
        body: JSON.stringify({ fields: taskToFields(task, fieldMap), typecast: true }),
      });
      send(res, 200, {
        task: {
          ...recordToTask(payload, fieldMap),
          source_id: source.id,
          source_label: source.label,
        },
      });
      return;
    }

    if (req.method === 'DELETE') {
      const taskId = req.query.id;
      if (!taskId) {
        send(res, 400, { error: 'Missing task id.' });
        return;
      }

      await callAirtable(config.token, airtableUrl(source, taskId), { method: 'DELETE' });
      send(res, 200, { ok: true });
      return;
    }

    send(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    send(res, error.status || 500, { error: error.message });
  }
}
