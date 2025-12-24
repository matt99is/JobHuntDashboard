import { useState } from 'react';
import { Seniority, RoleType, ApplicationType, Freshness } from '../types/job';
import { generateJobId, upsertJobs } from '../lib/supabase';

interface AddJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddComplete: () => void;
}

export default function AddJobModal({ isOpen, onClose, onAddComplete }: AddJobModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    url: '',
    salary: '',
    remote: false,
    seniority: '' as Seniority | '',
    role_type: '' as RoleType | '',
    application_type: '' as ApplicationType | '',
    freshness: '' as Freshness | '',
    description: '',
    source: 'manual',
    suitability: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.company) {
      alert('Title and Company are required');
      return;
    }

    try {
      setIsSubmitting(true);

      const job = {
        id: generateJobId({ source: formData.source, company: formData.company, title: formData.title }),
        title: formData.title,
        company: formData.company,
        location: formData.location || undefined,
        url: formData.url || undefined,
        salary: formData.salary || undefined,
        remote: formData.remote,
        seniority: formData.seniority || undefined,
        role_type: formData.role_type || undefined,
        application_type: formData.application_type || undefined,
        freshness: formData.freshness || undefined,
        description: formData.description || undefined,
        source: formData.source,
        status: 'new',
        suitability: formData.suitability,
      };

      await upsertJobs([job]);

      // Reset form
      setFormData({
        title: '',
        company: '',
        location: '',
        url: '',
        salary: '',
        remote: false,
        seniority: '',
        role_type: '',
        application_type: '',
        freshness: '',
        description: '',
        source: 'manual',
        suitability: 0,
      });

      onAddComplete();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-[#D4CCC0] bg-[#FFFCF7] focus:outline-none focus:ring-2 focus:ring-terracotta text-sm rounded-lg";
  const labelClass = "block text-sm font-medium text-[#1A1A1A] mb-1";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-[#F8F5F0] max-w-2xl w-full p-6 border border-[#E5DED3] rounded-xl shadow-lg my-8">
        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">Add Job</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Company *</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Salary</label>
              <input
                type="text"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                className={inputClass}
                placeholder="£50k-60k"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>URL</label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Role Type</label>
              <select
                value={formData.role_type}
                onChange={(e) => setFormData({ ...formData, role_type: e.target.value as RoleType | '' })}
                className={inputClass}
              >
                <option value="">Select...</option>
                <option value="ux">UX</option>
                <option value="product">Product</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Seniority</label>
              <select
                value={formData.seniority}
                onChange={(e) => setFormData({ ...formData, seniority: e.target.value as Seniority | '' })}
                className={inputClass}
              >
                <option value="">Select...</option>
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Application Type</label>
              <select
                value={formData.application_type}
                onChange={(e) => setFormData({ ...formData, application_type: e.target.value as ApplicationType | '' })}
                className={inputClass}
              >
                <option value="">Select...</option>
                <option value="direct">Direct</option>
                <option value="recruiter">Recruiter</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Freshness</label>
              <select
                value={formData.freshness}
                onChange={(e) => setFormData({ ...formData, freshness: e.target.value as Freshness | '' })}
                className={inputClass}
              >
                <option value="">Select...</option>
                <option value="fresh">Fresh</option>
                <option value="recent">Recent</option>
                <option value="stale">Stale</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              <input
                type="checkbox"
                checked={formData.remote}
                onChange={(e) => setFormData({ ...formData, remote: e.target.checked })}
                className="mr-2"
              />
              Remote
            </label>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={inputClass}
              rows={3}
            />
          </div>

          <div>
            <label className={labelClass}>Suitability Score (0-25) *</label>
            <input
              type="number"
              min="0"
              max="25"
              value={formData.suitability}
              onChange={(e) => setFormData({ ...formData, suitability: parseInt(e.target.value) || 0 })}
              className={inputClass}
              required
            />
            <p className="text-xs text-[#6B6B6B] mt-1">
              Note: The dashboard does not calculate scores. Enter your own assessment or set to 0.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#E5DED3]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-[#1A1A1A] bg-[#FFFCF7] border border-[#E5DED3] hover:bg-[#F0EBE3] transition-all duration-150 disabled:opacity-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-[#FFFCF7] bg-terracotta hover:bg-terracotta-dark transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
            >
              {isSubmitting ? 'Adding...' : 'Add Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
