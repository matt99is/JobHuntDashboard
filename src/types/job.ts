export type Seniority = 'junior' | 'mid' | 'senior' | 'lead';
export type RoleType = 'ux' | 'product';
export type ApplicationType = 'direct' | 'recruiter';
export type Freshness = 'fresh' | 'recent' | 'stale' | 'unknown';
export type Status = 'new' | 'interested' | 'applied' | 'awaiting' | 'interview' | 'offer' | 'rejected' | 'ghosted' | null;
export type ResearchStatus = 'pending' | 'researching' | 'complete' | 'skipped' | 'failed';

export type RedFlagType = 'layoffs' | 'glassdoor_low' | 'glassdoor_culture' | 'financial' | 'turnover' | 'news_negative';
export type RedFlagSeverity = 'high' | 'medium' | 'low';

export interface RedFlag {
  type: RedFlagType;
  severity: RedFlagSeverity;
  summary: string;
  source?: string;
  details?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location?: string;
  url?: string;
  salary?: string;
  remote: boolean;
  seniority?: Seniority;
  role_type?: RoleType;
  application_type?: ApplicationType;
  freshness?: Freshness;
  description?: string;
  source?: string;
  status: Status;
  suitability: number;
  created_at: string;
  updated_at: string;
  // Research fields
  career_page_url?: string;
  red_flags?: RedFlag[];
  research_status?: ResearchStatus;
  researched_at?: string;
  // Application tracking fields
  applied_at?: string;
  interview_date?: string;
  outcome_at?: string;
  outcome_notes?: string;
}

// Status display metadata
export interface StatusMeta {
  label: string;
  color: string;
  textColor: string;
  isTerminal: boolean;
}

export const STATUS_META: Record<NonNullable<Status>, StatusMeta> = {
  new: { label: 'New', color: 'bg-gray-100', textColor: 'text-gray-700', isTerminal: false },
  interested: { label: 'Saved', color: 'bg-blue-100', textColor: 'text-blue-700', isTerminal: false },
  applied: { label: 'Applied', color: 'bg-amber-100', textColor: 'text-amber-700', isTerminal: false },
  awaiting: { label: 'Awaiting', color: 'bg-yellow-100', textColor: 'text-yellow-700', isTerminal: false },
  interview: { label: 'Interview', color: 'bg-purple-100', textColor: 'text-purple-700', isTerminal: false },
  offer: { label: 'Offer', color: 'bg-green-100', textColor: 'text-green-700', isTerminal: true },
  rejected: { label: 'Rejected', color: 'bg-red-100', textColor: 'text-red-700', isTerminal: true },
  ghosted: { label: 'Ghosted', color: 'bg-gray-200', textColor: 'text-gray-500', isTerminal: true },
};

export interface JobImport {
  title: string;
  company: string;
  location?: string;
  url?: string;
  salary?: string;
  remote?: boolean;
  seniority?: Seniority;
  roleType?: RoleType;
  type?: ApplicationType;
  freshness?: Freshness;
  description?: string;
  source?: string;
  suitability?: number;
}
