import { Job } from '../types/job';
import JobCard from './JobCard';

interface JobListProps {
  jobs: Job[];
  onStatusChange: (id: string, status: string | null) => void;
  onDelete: (id: string) => void;
}

export default function JobList({ jobs, onStatusChange, onDelete }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="text-[#6B6B6B]">No jobs found. Import some jobs or add one manually.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
