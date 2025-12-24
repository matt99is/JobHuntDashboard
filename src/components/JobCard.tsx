import { Job } from '../types/job';

interface JobCardProps {
  job: Job;
  onStatusChange: (id: string, status: string | null) => void;
  onDelete: (id: string) => void;
}

export default function JobCard({ job, onStatusChange, onDelete }: JobCardProps) {
  const getSuitabilityColor = (score: number) => {
    if (score >= 15) return 'bg-terracotta text-white';
    if (score >= 10) return 'bg-blue-500 text-white';
    if (score >= 6) return 'bg-yellow-500 text-white';
    return 'bg-gray-400 text-white';
  };

  const getSuitabilityLabel = (score: number) => {
    if (score >= 15) return 'Excellent';
    if (score >= 10) return 'Good';
    if (score >= 6) return 'Fair';
    return 'Low';
  };

  const isApplied = job.status === 'applied';
  const isSaved = job.status === 'interested';

  const handleApply = () => {
    if (confirm('Mark this job as applied? This cannot be undone.')) {
      onStatusChange(job.id, 'applied');
    }
  };

  return (
    <div className={`bg-[#F8F5F0] border border-[#E5DED3] p-6 rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 border-l-4 border-l-terracotta ${isApplied ? 'opacity-60' : ''}`}>
      {/* Row 1: Title + Badges */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-1">{job.title}</h3>
          <div className="flex flex-wrap gap-2">
            {job.remote && (
              <span className="text-xs px-2 py-1 bg-[#F0EBE3] text-[#4A4A4A] border border-[#E5DED3] rounded-md">
                🏠 Remote
              </span>
            )}
            {job.salary && (
              <span className="text-xs px-2 py-1 bg-[#F0EBE3] text-[#4A4A4A] border border-[#E5DED3] rounded-md">
                💰 {job.salary}
              </span>
            )}
            {(job.seniority === 'senior' || job.seniority === 'lead') && (
              <span className="text-xs px-2 py-1 bg-[#F0EBE3] text-[#4A4A4A] border border-[#E5DED3] rounded-md">
                📈 {job.seniority}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Company · Location */}
      <div className="text-sm text-[#4A4A4A] mb-3">
        {job.company}
        {job.location && ` · ${job.location}`}
      </div>

      {/* Row 3: Metadata */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B6B6B] mb-4 font-mono">
        <span className={`px-2 py-1 rounded-md ${getSuitabilityColor(job.suitability)}`}>
          {job.suitability}/25 {getSuitabilityLabel(job.suitability)}
        </span>
        {job.freshness && (
          <span className="capitalize">{job.freshness}</span>
        )}
        {job.application_type && (
          <span className="capitalize">{job.application_type}</span>
        )}
        {job.role_type && (
          <span className="uppercase">{job.role_type}</span>
        )}
        {job.source && (
          <span className="text-[#8A8A8A]">via {job.source}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-3 border-t border-[#E5DED3]">
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-terracotta hover:text-terracotta-dark font-medium transition-colors underline underline-offset-2"
          >
            View
          </a>
        )}

        {isApplied ? (
          <span className="text-sm text-[#6B6B6B]">Applied</span>
        ) : (
          <>
            <button
              onClick={() => onStatusChange(job.id, isSaved ? null : 'interested')}
              className="text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors underline underline-offset-2"
              title={isSaved ? 'Unsave' : 'Save'}
            >
              {isSaved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={handleApply}
              className="text-sm text-terracotta hover:text-terracotta-dark font-medium transition-colors underline underline-offset-2"
              title="Mark as applied"
            >
              Apply
            </button>
          </>
        )}

        <button
          onClick={() => {
            if (confirm('Delete this job?')) {
              onDelete(job.id);
            }
          }}
          className="text-sm text-[#6B6B6B] hover:text-red-600 transition-colors ml-auto underline underline-offset-2"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
