import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions
export async function getJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .not('status', 'in', '("rejected","ghosted")')  // Hide rejected/dismissed and ghosted jobs
    .order('suitability', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getArchivedJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .in('status', ['offer', 'rejected', 'ghosted'])
    .order('outcome_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data;
}

export async function updateJobStatus(
  id: string,
  status: string | null,
  extras?: { interview_date?: string; outcome_notes?: string }
) {
  const updates: Record<string, unknown> = { status };

  // Auto-set timeline fields based on status transition
  if (status === 'applied') {
    updates.applied_at = new Date().toISOString();
    updates.status = 'awaiting';  // Immediately transition to awaiting
  }

  if (status === 'interview' && extras?.interview_date) {
    updates.interview_date = extras.interview_date;
  }

  if (['offer', 'rejected', 'ghosted'].includes(status || '')) {
    updates.outcome_at = new Date().toISOString();
    if (extras?.outcome_notes) {
      updates.outcome_notes = extras.outcome_notes;
    }
  }

  const { error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteJob(id: string) {
  // Soft delete - mark as rejected so it won't resurface in future searches
  const { error } = await supabase
    .from('jobs')
    .update({ status: 'rejected' })
    .eq('id', id);

  if (error) throw error;
}

export async function upsertJobs(jobs: any[]) {
  const { error } = await supabase
    .from('jobs')
    .upsert(jobs, {
      onConflict: 'id',
      ignoreDuplicates: false
    });

  if (error) throw error;
}

export function generateJobId(job: { source?: string; company: string; title: string }): string {
  const normalise = (str: string) =>
    str.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30);

  return `${normalise(job.source || 'manual')}-${normalise(job.company)}-${normalise(job.title)}`;
}
