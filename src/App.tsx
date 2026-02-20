import { useState, useEffect } from 'react';
import { Job } from './types/job';
import { getJobs, updateJobStatus, deleteJob } from './lib/api';
import Header from './components/Header';
import FilterBar, { FilterType } from './components/FilterBar';
import JobList from './components/JobList';
import ImportModal from './components/ImportModal';
import AddJobModal from './components/AddJobModal';
import Footer from './components/Footer';

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('new');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadJobs = async () => {
    try {
      setIsLoading(true);
      const data = await getJobs();
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    let filtered = [...jobs];

    switch (activeFilter) {
      case 'new':
        filtered = filtered.filter(j => j.status === 'new');
        break;
      case 'awaiting':
        filtered = filtered.filter(j => j.status === 'awaiting');
        break;
      case 'interview':
        filtered = filtered.filter(j => j.status === 'interview');
        break;
      case 'offer':
        filtered = filtered.filter(j => j.status === 'offer');
        break;
      case 'remote':
        filtered = filtered.filter(j => j.remote);
        break;
      case 'direct':
        filtered = filtered.filter(j => j.application_type === 'direct');
        break;
      case 'ux':
        filtered = filtered.filter(j => j.role_type === 'ux');
        break;
      case 'product':
        filtered = filtered.filter(j => j.role_type === 'product');
        break;
    }

    setFilteredJobs(filtered);
  }, [jobs, activeFilter]);

  const handleStatusChange = async (
    id: string,
    status: string | null,
    extras?: { interview_date?: string; outcome_notes?: string }
  ) => {
    try {
      await updateJobStatus(id, status, extras);
      // Determine the actual status (applied -> awaiting)
      const actualStatus = status === 'applied' ? 'awaiting' : status;
      setJobs(jobs.map(job =>
        job.id === id ? {
          ...job,
          status: actualStatus as any,
          applied_at: status === 'applied' ? new Date().toISOString() : job.applied_at,
          interview_date: extras?.interview_date || job.interview_date,
          outcome_at: ['offer', 'rejected', 'ghosted'].includes(status || '') ? new Date().toISOString() : job.outcome_at,
          outcome_notes: extras?.outcome_notes || job.outcome_notes,
        } : job
      ));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteJob(id);
      setJobs(jobs.filter(job => job.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete job');
    }
  };

  const handleImportComplete = () => {
    loadJobs();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-[#6B6B6B]">Loading jobs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Header
        jobs={jobs}
        onAddClick={() => setIsAddModalOpen(true)}
        onImportClick={() => setIsImportModalOpen(true)}
      />

      <FilterBar
        jobs={jobs}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <JobList
        jobs={filteredJobs}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
      />

      <AddJobModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddComplete={handleImportComplete}
      />

      <Footer />
    </div>
  );
}
