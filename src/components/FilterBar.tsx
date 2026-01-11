import { Job } from '../types/job';

export type FilterType = 'all' | 'new' | 'awaiting' | 'interview' | 'offer' | 'remote' | 'direct' | 'ux' | 'product';

interface FilterBarProps {
  jobs: Job[];
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export default function FilterBar({ jobs, activeFilter, onFilterChange }: FilterBarProps) {
  const newCount = jobs.filter(j => j.status === 'new').length;
  const awaitingCount = jobs.filter(j => j.status === 'awaiting').length;
  const interviewCount = jobs.filter(j => j.status === 'interview').length;
  const offerCount = jobs.filter(j => j.status === 'offer').length;

  const filters: { id: FilterType; label: string; count?: number }[] = [
    { id: 'all', label: 'All' },
    { id: 'new', label: 'New', count: newCount },
    { id: 'awaiting', label: 'Awaiting', count: awaitingCount },
    { id: 'interview', label: 'Interview', count: interviewCount },
    { id: 'offer', label: 'Offers', count: offerCount },
    { id: 'remote', label: 'Remote' },
    { id: 'direct', label: 'Direct' },
    { id: 'ux', label: 'UX' },
    { id: 'product', label: 'Product' },
  ];

  return (
    <div className="border-b border-[#D4D4D4] bg-[#E5E5E5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-wrap gap-2">
          {filters.map(filter => {
            const isActive = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => onFilterChange(filter.id)}
                className={`
                  px-4 py-2 text-sm font-medium transition-all duration-150 rounded-lg
                  ${isActive
                    ? 'bg-teal text-[#FAFAFA] shadow-sm'
                    : 'bg-[#F5F5F5] text-[#1A1A1A] border border-[#D4D4D4] hover:bg-[#FAFAFA] hover:shadow-sm'
                  }
                `}
              >
                {filter.label}
                {filter.count !== undefined && ` (${filter.count})`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
