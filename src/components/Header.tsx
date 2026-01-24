import { Job } from '../types/job';

interface HeaderProps {
  jobs: Job[];
  onAddClick: () => void;
  onImportClick: () => void;
}

export default function Header({ jobs, onAddClick, onImportClick }: HeaderProps) {
  const total = jobs.length;
  const newCount = jobs.filter(j => j.status === 'new').length;
  const awaitingCount = jobs.filter(j => j.status === 'awaiting').length;
  const interviewCount = jobs.filter(j => j.status === 'interview').length;
  const offerCount = jobs.filter(j => j.status === 'offer').length;

  return (
    <header className="border-b border-[#D4D4D4] bg-[#F5F5F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Job Hunt Assistant</h1>
          <div className="flex gap-3">
            <button
              onClick={onImportClick}
              className="px-4 py-2 text-sm font-medium text-[#1A1A1A] bg-[#FAFAFA] border border-[#D4D4D4] hover:bg-[#E5E5E5] transition-all duration-150 rounded-lg"
            >
              Import
            </button>
            <button
              onClick={onAddClick}
              className="px-4 py-2 text-sm font-medium text-[#FAFAFA] bg-teal hover:bg-teal-dark transition-all duration-150 rounded-lg"
            >
              + Add Job
            </button>
          </div>
        </div>
        <div className="text-sm text-[#4A4A4A] font-mono">
          {total} roles · {newCount} new · {awaitingCount} awaiting · {interviewCount} interview · {offerCount} offers
        </div>
      </div>
    </header>
  );
}
