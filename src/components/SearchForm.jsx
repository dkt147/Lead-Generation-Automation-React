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
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Discover Companies</h2>
        <p className="mb-6 text-sm text-gray-500">
          Use AI to find real companies matching your criteria.
        </p>

        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Company Type *</label>
            <input
              type="text"
              value={form.companyType}
              onChange={(e) => update('companyType', e.target.value)}
              placeholder="e.g., SaaS startups, marketing agencies, law firms"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Region *</label>
            <input
              type="text"
              value={form.region}
              onChange={(e) => update('region', e.target.value)}
              placeholder="e.g., Winnipeg, Manitoba"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Company Size</label>
              <select
                value={form.companySize}
                onChange={(e) => update('companySize', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Any size</option>
                <option value="small">Small (1-50)</option>
                <option value="medium">Medium (51-500)</option>
                <option value="large">Large (500+)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Results: {form.count}
              </label>
              <input
                type="range"
                min="5"
                max="50"
                value={form.count}
                onChange={(e) => update('count', parseInt(e.target.value))}
                className="mt-2 w-full"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Keywords (optional)</label>
            <input
              type="text"
              value={form.keywords}
              onChange={(e) => update('keywords', e.target.value)}
              placeholder="e.g., AI, fintech, healthcare"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          >
            Search Companies
          </button>
        </form>
      </div>
    </div>
  );
}
