const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8788').replace(/\/$/, '');

async function apiRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const json = await response.json();
      if (json?.error) {
        message = json.error;
      }
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function getJobs() {
  return apiRequest('/api/jobs');
}

export async function getArchivedJobs() {
  return apiRequest('/api/jobs/archived');
}

export async function updateJobStatus(
  id: string,
  status: string | null,
  extras?: { interview_date?: string; outcome_notes?: string }
) {
  await apiRequest(`/api/jobs/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, extras }),
  });
}

export async function deleteJob(id: string) {
  await apiRequest(`/api/jobs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function upsertJobs(jobs: any[]) {
  await apiRequest('/api/jobs/upsert', {
    method: 'POST',
    body: JSON.stringify({ jobs }),
  });
}

export function generateJobId(job: { source?: string; company: string; title: string }): string {
  const normalise = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30);

  return `${normalise(job.source || 'manual')}-${normalise(job.company)}-${normalise(job.title)}`;
}
