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
          <h2 className="text-lg font-semibold text-gray-900">Discovered Companies</h2>
          <p className="text-sm text-gray-500">
            {discoveredCompanies.length} companies found &middot; {selectedCompanies.length} selected
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => dispatch({ type: 'SET_STEP', payload: 0 })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={() => dispatch({ type: allSelected ? 'SELECT_NONE' : 'SELECT_ALL' })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={handleEnrich}
            disabled={selectedCompanies.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Enrich Selected ({selectedCompanies.length})
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => dispatch({ type: allSelected ? 'SELECT_NONE' : 'SELECT_ALL' })}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Company</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Website</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Industry</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Size</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {discoveredCompanies.map((company, i) => (
              <tr
                key={i}
                className={`cursor-pointer transition-colors ${
                  selectedCompanies.includes(i) ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => dispatch({ type: 'TOGGLE_SELECT', payload: i })}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedCompanies.includes(i)}
                    onChange={() => dispatch({ type: 'TOGGLE_SELECT', payload: i })}
                    className="rounded border-gray-300"
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{company.name}</td>
                <td className="px-4 py-3 text-sm">
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {truncate(company.website, 30)}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{company.industry}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{company.estimated_size}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{truncate(company.description, 60)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
