import { useState } from 'react';
import { useLeadContext } from '../context/LeadContext';
import { discoverCompanies } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

export default function SearchForm() {
  const { state, dispatch, notify } = useLeadContext();
  const [form, setForm] = useState(state.searchParams);
  const [loading, setLoading] = useState(false);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!form.companyType.trim() || !form.region.trim()) {
      notify('Please fill in Company Type and Region', 'warning');
      return;
    }
    setLoading(true);
    dispatch({ type: 'SET_SEARCH_PARAMS', payload: form });
    try {
      const data = await discoverCompanies(form);
      dispatch({ type: 'SET_DISCOVERED', payload: data.companies || [] });
      notify(`Found ${data.companies?.length || 0} companies`, 'success');
      dispatch({ type: 'SET_STEP', payload: 1 });
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Discovering companies with AI..." />;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl bg-white dark:bg-[#111827] p-6 shadow-sm ring-1 ring-slate-200 dark:ring-gray-800">
        <h2 className="mb-1 text-lg font-semibold text-[#1a1a2e] dark:text-white">Discover Companies</h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Use AI to find real companies matching your criteria.
        </p>

        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Company Type *</label>
            <input
              type="text"
              value={form.companyType}
              onChange={(e) => update('companyType', e.target.value)}
              placeholder="e.g., SaaS startups, marketing agencies, law firms"
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Region *</label>
            <input
              type="text"
              value={form.region}
              onChange={(e) => update('region', e.target.value)}
              placeholder="e.g., Winnipeg, Manitoba"
              className={inputCls}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Company Size</label>
              <select
                value={form.companySize}
                onChange={(e) => update('companySize', e.target.value)}
                className={inputCls}
              >
                <option value="">Any size</option>
                <option value="small">Small (1-50)</option>
                <option value="medium">Medium (51-500)</option>
                <option value="large">Large (500+)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Results: {form.count}
              </label>
              <input
                type="range"
                min="5"
                max="50"
                value={form.count}
                onChange={(e) => update('count', parseInt(e.target.value))}
                className="mt-2 w-full accent-[#2563eb] dark:accent-[#3b82f6]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Keywords (optional)</label>
            <input
              type="text"
              value={form.keywords}
              onChange={(e) => update('keywords', e.target.value)}
              placeholder="e.g., AI, fintech, healthcare"
              className={inputCls}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-[#2563eb] dark:bg-[#3b82f6] px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb] dark:focus:ring-[#3b82f6] focus:ring-offset-2 dark:focus:ring-offset-[#111827]"
          >
            Search Companies
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:border-[#2563eb] dark:focus:border-[#3b82f6] focus:ring-1 focus:ring-[#2563eb] dark:focus:ring-[#3b82f6] focus:outline-none';
