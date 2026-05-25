export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(payload.error || 'The task service is not available.', response.status);
  }

  return payload;
}

export async function fetchTasks(accessCode) {
  const response = await fetch('/api/tasks', {
    headers: accessCode ? { 'x-app-code': accessCode } : {},
  });
  const payload = await parseResponse(response);
  return {
    tasks: payload.tasks || [],
    sources: payload.sources || [],
  };
}

export async function saveRemoteTask(task, accessCode) {
  const response = await fetch('/api/tasks', {
    method: task.id ? 'PATCH' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessCode ? { 'x-app-code': accessCode } : {}),
    },
    body: JSON.stringify(task),
  });
  const payload = await parseResponse(response);
  return payload.task;
}

export async function deleteRemoteTask(taskId, accessCode) {
  const id = typeof taskId === 'string' ? taskId : taskId.id;
  const sourceId = typeof taskId === 'string' ? '' : taskId.source_id;
  const sourceQuery = sourceId ? `&source_id=${encodeURIComponent(sourceId)}` : '';
  const response = await fetch(`/api/tasks?id=${encodeURIComponent(id)}${sourceQuery}`, {
    method: 'DELETE',
    headers: accessCode ? { 'x-app-code': accessCode } : {},
  });
  await parseResponse(response);
}
