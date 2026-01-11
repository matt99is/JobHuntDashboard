import { Job, RedFlagType, RedFlagSeverity, Status, STATUS_META } from '../types/job';

interface JobCardProps {
  job: Job;
  onStatusChange: (id: string, status: string | null, extras?: { interview_date?: string; outcome_notes?: string }) => void;
  onDelete: (id: string) => void;
}

// Status badge component
function StatusBadge({ status }: { status: Status }) {
  if (!status || status === 'new') return null;
  const meta = STATUS_META[status];
  return (
    <span className={`text-xs px-2 py-1 rounded-md ${meta.color} ${meta.textColor}`}>
      {meta.label}
    </span>
  );
}

// Timeline info component
function TimelineInfo({ job }: { job: Job }) {
  const items: string[] = [];

  if (job.applied_at) {
    const daysAgo = Math.floor((Date.now() - new Date(job.applied_at).getTime()) / 86400000);
    items.push(`Applied ${daysAgo}d ago`);
  }

  if (job.interview_date) {
    const interviewDate = new Date(job.interview_date);
    const isPast = interviewDate < new Date();
    items.push(`${isPast ? 'Interviewed' : 'Interview'} ${interviewDate.toLocaleDateString()}`);
  }

  if (items.length === 0) return null;

  return (
    <div className="text-xs text-[#6B6B6B] mt-2 font-mono">
      {items.join(' · ')}
    </div>
  );
}

// Red flag styling helpers
const getFlagStyle = (severity: RedFlagSeverity): string => {
  switch (severity) {
    case 'high':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'medium':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'low':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const getFlagIcon = (type: RedFlagType): string => {
  const icons: Record<RedFlagType, string> = {
    layoffs: '\u26A0\uFE0F',
    glassdoor_low: '\u2B50',
    glassdoor_culture: '\u{1F614}',
    financial: '\u{1F4C9}',
    turnover: '\u{1F6AA}',
    news_negative: '\u{1F4F0}',
  };
  return icons[type] || '\u26A0\uFE0F';
};

export default function JobCard({ job, onStatusChange, onDelete }: JobCardProps) {
  const getSuitabilityColor = (score: number) => {
    if (score >= 15) return 'bg-green-500 text-white';
    if (score >= 10) return 'bg-yellow-500 text-white';
    if (score >= 6) return 'bg-orange-500 text-white';
    return 'bg-red-500 text-white';
  };

  const getSuitabilityLabel = (score: number) => {
    if (score >= 15) return 'Excellent';
    if (score >= 10) return 'Good';
    if (score >= 6) return 'Fair';
    return 'Low';
  };

  const status = job.status;
  const isTerminal = status && STATUS_META[status]?.isTerminal;

  // Red flags
  const hasRedFlags = job.red_flags && job.red_flags.length > 0;
  const hasHighSeverity = job.red_flags?.some(f => f.severity === 'high') || false;
  const borderColor = hasHighSeverity ? 'border-l-red-500' : 'border-l-teal';

  const handleApply = () => {
    if (confirm('Mark this job as applied?')) {
      onStatusChange(job.id, 'applied');
    }
  };

  const handleInterview = () => {
    const date = prompt('Enter interview date (YYYY-MM-DD):');
    if (date) {
      onStatusChange(job.id, 'interview', { interview_date: date });
    }
  };

  const handleOutcome = (newStatus: 'offer' | 'rejected') => {
    const notes = prompt(`Any notes about the ${newStatus}?`) || undefined;
    onStatusChange(job.id, newStatus, { outcome_notes: notes });
  };

  return (
    <div className={`bg-[#F5F5F5] border border-[#D4D4D4] p-6 rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 border-l-4 ${borderColor} ${isTerminal ? 'opacity-60' : ''}`}>
      {/* Red Flags Row */}
      {hasRedFlags && (
        <div className="flex flex-wrap gap-2 mb-3">
          {job.red_flags!.map((flag, idx) => (
            <span
              key={idx}
              className={`text-xs px-2 py-1 rounded-md border ${getFlagStyle(flag.severity)}`}
              title={flag.details || `${flag.summary} (${flag.source || 'Unknown source'})`}
            >
              {getFlagIcon(flag.type)} {flag.summary}
            </span>
          ))}
        </div>
      )}

      {/* Row 1: Title + Status + Badges */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-[#1A1A1A]">{job.title}</h3>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {job.remote && (
              <span className="text-xs px-2 py-1 bg-[#E5E5E5] text-[#4A4A4A] border border-[#D4D4D4] rounded-md">
                Remote
              </span>
            )}
            {job.salary && (
              <span className="text-xs px-2 py-1 bg-[#E5E5E5] text-[#4A4A4A] border border-[#D4D4D4] rounded-md">
                {job.salary}
              </span>
            )}
            {(job.seniority === 'senior' || job.seniority === 'lead') && (
              <span className="text-xs px-2 py-1 bg-[#E5E5E5] text-[#4A4A4A] border border-[#D4D4D4] rounded-md">
                {job.seniority}
              </span>
            )}
          </div>
          <TimelineInfo job={job} />
        </div>
      </div>

      {/* Row 2: Company · Location · Career Page */}
      <div className="text-sm text-[#4A4A4A] mb-3">
        {job.company}
        {job.location && ` · ${job.location}`}
        {job.career_page_url && (
          <a
            href={job.career_page_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-teal hover:text-teal-dark text-xs font-medium"
            title="View company careers page"
          >
            [Careers]
          </a>
        )}
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
      <div className="flex items-center gap-4 pt-3 border-t border-[#D4D4D4]">
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-teal hover:text-teal-dark font-medium transition-colors underline underline-offset-2"
          >
            View
          </a>
        )}

        {/* Status-aware action buttons */}
        {status === 'new' && (
          <button
            onClick={handleApply}
            className="text-sm text-teal hover:text-teal-dark font-medium transition-colors underline underline-offset-2"
          >
            Mark Applied
          </button>
        )}

        {status === 'awaiting' && (
          <>
            <button
              onClick={handleInterview}
              className="text-sm text-teal hover:text-teal-dark font-medium transition-colors underline underline-offset-2"
            >
              Interview
            </button>
            <button
              onClick={() => handleOutcome('rejected')}
              className="text-sm text-[#6B6B6B] hover:text-red-600 transition-colors underline underline-offset-2"
            >
              Rejected
            </button>
          </>
        )}

        {status === 'interview' && (
          <>
            <button
              onClick={() => handleOutcome('offer')}
              className="text-sm text-green-600 hover:text-green-700 font-medium transition-colors underline underline-offset-2"
            >
              Got Offer
            </button>
            <button
              onClick={() => handleOutcome('rejected')}
              className="text-sm text-[#6B6B6B] hover:text-red-600 transition-colors underline underline-offset-2"
            >
              Rejected
            </button>
          </>
        )}

        {/* Dismiss button - available for non-terminal states */}
        {!isTerminal && (
          <button
            onClick={() => {
              if (confirm('Dismiss this job? It won\'t appear again in future searches.')) {
                onDelete(job.id);
              }
            }}
            className="text-sm text-[#6B6B6B] hover:text-red-600 transition-colors ml-auto underline underline-offset-2"
          >
            Dismiss
          </button>
        )}

        {/* Show outcome notes for terminal states */}
        {isTerminal && job.outcome_notes && (
          <span className="text-xs text-[#6B6B6B] ml-auto" title={job.outcome_notes}>
            Notes: {job.outcome_notes.slice(0, 30)}...
          </span>
        )}
      </div>
    </div>
  );
}
