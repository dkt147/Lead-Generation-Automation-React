import { getExistingItemSummary } from '../utils/duplicateMatching';

export default function DuplicateResolver({ company, duplicateResult, onAction }) {
  if (!duplicateResult?.isDuplicate) return null;

  const match = duplicateResult.matches[0];
  const existing = getExistingItemSummary(match);

  return (
    <div className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-yellow-600">&#9888;</span>
        <span className="text-sm font-medium text-yellow-800">
          Potential Duplicate Found
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-gray-500">New Lead</p>
          <p className="font-medium">{company.name}</p>
          <p className="text-gray-600">{company.website}</p>
          {company.contact && <p className="text-gray-600">{company.contact.email}</p>}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Existing Record</p>
          <p className="font-medium">{existing.name}</p>
          {Object.entries(existing)
            .filter(([k]) => k !== 'name' && k !== 'itemId')
            .slice(0, 3)
            .map(([k, v]) => (
              <p key={k} className="text-gray-600">{v}</p>
            ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAction('skip')}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white"
        >
          Skip
        </button>
        <button
          onClick={() => onAction('update', match.itemId)}
          className="rounded-lg bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700"
        >
          Update Existing
        </button>
        <button
          onClick={() => onAction('create')}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          Create Anyway
        </button>
      </div>
    </div>
  );
}
