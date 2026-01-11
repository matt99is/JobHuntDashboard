import { useState } from 'react';
import { JobImport } from '../types/job';
import { generateJobId, upsertJobs } from '../lib/supabase';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ImportModal({ isOpen, onClose, onImportComplete }: ImportModalProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleImport = async () => {
    setError('');

    try {
      const parsed = JSON.parse(jsonInput);
      const jobsArray = Array.isArray(parsed) ? parsed : [parsed];

      // Map from Claude's format to database format
      const dbJobs = jobsArray.map((job: JobImport) => ({
        id: generateJobId({ source: job.source, company: job.company, title: job.title }),
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        salary: job.salary,
        remote: job.remote || false,
        seniority: job.seniority,
        role_type: job.roleType, // Map roleType to role_type
        application_type: job.type, // Map type to application_type
        freshness: job.freshness,
        description: job.description,
        source: job.source,
        status: 'new', // Always set to new on import
        suitability: job.suitability || 0,
      }));

      setIsImporting(true);
      await upsertJobs(dbJobs);

      setJsonInput('');
      onImportComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON format');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#F5F5F5] max-w-2xl w-full p-6 border border-[#D4D4D4] rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">Import Jobs</h2>

        <p className="text-sm text-[#4A4A4A] mb-4">
          Paste the JSON array of jobs from Claude. Jobs with matching IDs will be updated, new jobs will be added.
        </p>

        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='[{"title": "...", "company": "...", ...}]'
          className="w-full h-64 p-3 border border-[#A3A3A3] bg-[#FAFAFA] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal resize-none rounded-lg"
        />

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 text-sm font-medium text-[#1A1A1A] bg-[#FAFAFA] border border-[#D4D4D4] hover:bg-[#E5E5E5] transition-all duration-150 disabled:opacity-50 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!jsonInput.trim() || isImporting}
            className="px-4 py-2 text-sm font-medium text-[#FAFAFA] bg-teal hover:bg-teal-dark transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
          >
            {isImporting ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
