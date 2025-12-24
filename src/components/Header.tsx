import { Job } from '../types/job';

interface HeaderProps {
  jobs: Job[];
  onAddClick: () => void;
  onImportClick: () => void;
}

export default function Header({ jobs, onAddClick, onImportClick }: HeaderProps) {
  const total = jobs.length;
  const newCount = jobs.filter(j => j.status === 'new').length;
  const savedCount = jobs.filter(j => j.status === 'interested').length;
  const appliedCount = jobs.filter(j => j.status === 'applied').length;

  return (
    <header className="border-b border-[#E5DED3] bg-[#F8F5F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Job Hunt</h1>
          <div className="flex gap-3">
            <button
              onClick={onImportClick}
              className="px-4 py-2 text-sm font-medium text-[#1A1A1A] bg-[#FFFCF7] border border-[#E5DED3] hover:bg-[#F0EBE3] transition-all duration-150 rounded-lg"
            >
              Import
            </button>
            <button
              onClick={onAddClick}
              className="px-4 py-2 text-sm font-medium text-[#FFFCF7] bg-terracotta hover:bg-terracotta-dark transition-all duration-150 rounded-lg"
            >
              + Add Job
            </button>
          </div>
        </div>
        <div className="text-sm text-[#4A4A4A] font-mono">
          {total} roles · {newCount} new · {savedCount} saved · {appliedCount} applied
        </div>
      </div>
    </header>
  );
}
