export type Seniority = 'junior' | 'mid' | 'senior' | 'lead';
export type RoleType = 'ux' | 'product';
export type ApplicationType = 'direct' | 'recruiter';
export type Freshness = 'fresh' | 'recent' | 'stale' | 'unknown';
export type Status = 'new' | 'interested' | 'applied' | 'rejected' | null;

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
}

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
