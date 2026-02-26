import { useLeadContext } from '../context/LeadContext';
import { truncate } from '../utils/formatters';

export default function ResultsTable() {
  const { state, dispatch, notify } = useLeadContext();
  const { discoveredCompanies, selectedCompanies } = state;

  const allSelected = selectedCompanies.length === discoveredCompanies.length;

  const handleEnrich = () => {
    if (selectedCompanies.length === 0) {
      notify('Select at least one company to enrich', 'warning');
      return;
    }
    dispatch({ type: 'SET_STEP', payload: 2 });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a2e] dark:text-white">Discovered Companies</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {discoveredCompanies.length} companies found &middot; {selectedCompanies.length} selected
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => dispatch({ type: 'SET_STEP', payload: 0 })} className={btnOutline}>
            Back
          </button>
          <button onClick={() => dispatch({ type: allSelected ? 'SELECT_NONE' : 'SELECT_ALL' })} className={btnOutline}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <button onClick={handleEnrich} disabled={selectedCompanies.length === 0} className={btnPrimary}>
            Enrich Selected ({selectedCompanies.length})
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white dark:bg-[#111827] shadow-sm ring-1 ring-slate-200 dark:ring-gray-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-gray-800">
          <thead className="bg-slate-50 dark:bg-gray-900/60">
            <tr>
              <th className="w-10 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => dispatch({ type: allSelected ? 'SELECT_NONE' : 'SELECT_ALL' })}
                  className="rounded border-slate-300 dark:border-gray-700 accent-[#2563eb] dark:accent-[#3b82f6]"
                />
              </th>
              {['Company', 'Website', 'Industry', 'Size', 'Description'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
            {discoveredCompanies.map((company, i) => (
              <tr
                key={i}
                className={`cursor-pointer transition-colors ${
                  selectedCompanies.includes(i)
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-slate-50 dark:hover:bg-gray-800/60'
                }`}
                onClick={() => dispatch({ type: 'TOGGLE_SELECT', payload: i })}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedCompanies.includes(i)}
                    onChange={() => dispatch({ type: 'TOGGLE_SELECT', payload: i })}
                    className="rounded border-slate-300 dark:border-gray-700 accent-[#2563eb] dark:accent-[#3b82f6]"
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-[#1a1a2e] dark:text-white">{company.name}</td>
                <td className="px-4 py-3 text-sm">
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2563eb] dark:text-[#3b82f6] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {truncate(company.website, 30)}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{company.industry}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{company.estimated_size}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-500">{truncate(company.description, 60)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const btnOutline = 'rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800';
const btnPrimary = 'rounded-lg bg-[#2563eb] dark:bg-[#3b82f6] px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-500 disabled:opacity-50';
