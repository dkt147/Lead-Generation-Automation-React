import { useState, useEffect, useRef } from 'react';
import { useLeadContext } from '../context/LeadContext';
import { enrichSingle } from '../services/api';
import { formatConfidence } from '../utils/formatters';

export default function EnrichmentPanel() {
  const { state, dispatch, notify } = useLeadContext();
  const { discoveredCompanies, selectedCompanies, enrichedCompanies } = state;
  const selectedList = selectedCompanies.map((i) => discoveredCompanies[i]);

  const [progress, setProgress] = useState({ done: 0, total: 0, running: false });
  const abortRef = useRef(false);

  useEffect(() => {
    if (enrichedCompanies.length === 0 && selectedList.length > 0) {
      runEnrichment();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runEnrichment = async () => {
    abortRef.current = false;
    const total = selectedList.length;
    setProgress({ done: 0, total, running: true });
    dispatch({ type: 'SET_ENRICHED', payload: [] });

    let found = 0;
    for (let i = 0; i < selectedList.length; i++) {
      if (abortRef.current) break;
      const company = selectedList[i];
      try {
        const result = await enrichSingle(company);
        const enriched = { ...result, region: state.searchParams.region, searchType: state.searchParams.companyType };
        dispatch({ type: 'APPEND_ENRICHED', payload: enriched });
        if (enriched.contact?.email) found++;
      } catch (err) {
        dispatch({
          type: 'APPEND_ENRICHED',
          payload: { ...company, contact: null, enrichmentSource: null, enrichmentError: err.message },
        });
      }
      setProgress({ done: i + 1, total, running: i + 1 < total });
    }

    notify(`Done — ${found} of ${total} contacts found`, found > 0 ? 'success' : 'warning');
    setProgress((p) => ({ ...p, running: false }));
  };

  const { done, total, running } = progress;

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a2e] dark:text-white">Contact Enrichment</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {running
              ? `Enriching ${done} / ${total}...`
              : `${enrichedCompanies.filter((c) => c.contact?.email).length} of ${enrichedCompanies.length} contacts found`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => dispatch({ type: 'SET_STEP', payload: 1 })} className={btnOutline}>
            Back
          </button>
          {running ? (
            <button onClick={() => { abortRef.current = true; }} className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
              Stop
            </button>
          ) : (
            <>
              {enrichedCompanies.length > 0 && (
                <button onClick={runEnrichment} className={btnOutline}>Re-run</button>
              )}
              <button
                onClick={() => dispatch({ type: 'SET_STEP', payload: 3 })}
                disabled={enrichedCompanies.length === 0}
                className={btnPrimary}
              >
                Proceed to CRM
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-4 h-1.5 w-full rounded-full bg-slate-200 dark:bg-gray-800">
          <div
            className="h-1.5 rounded-full bg-[#2563eb] dark:bg-[#3b82f6] transition-all duration-300"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      )}

      {/* Results */}
      <div className="space-y-3">
        {enrichedCompanies.map((company, i) => (
          <div key={i} className="rounded-xl bg-white dark:bg-[#111827] p-4 shadow-sm ring-1 ring-slate-200 dark:ring-gray-800">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-[#1a1a2e] dark:text-white">{company.name}</h3>
                <p className="text-sm text-gray-400 dark:text-gray-600">{company.website}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {company.contact && <SourceBadge source={company.enrichmentSource} />}
                {company.contact?.email ? (
                  <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                    Contact Found
                  </span>
                ) : company.contact?.linkedin ? (
                  <span className="rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
                    Profile Only
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                    No Contact
                  </span>
                )}
              </div>
            </div>

            {company.contact && (company.contact.email || company.contact.name) && (
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-slate-50 dark:bg-gray-900/60 p-3 text-sm md:grid-cols-4">
                <div>
                  <span className="text-xs text-gray-400 dark:text-gray-600">Name</span>
                  <p className="font-medium text-[#1a1a2e] dark:text-white">{company.contact.name || '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400 dark:text-gray-600">Email</span>
                  <p className="font-medium text-[#1a1a2e] dark:text-white truncate">
                    {company.contact.email || <span className="text-gray-400 italic text-xs">not found</span>}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-400 dark:text-gray-600">Position</span>
                  <p className="font-medium text-[#1a1a2e] dark:text-white">{company.contact.position || '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400 dark:text-gray-600">
                    {company.contact.email ? 'Confidence' : 'LinkedIn'}
                  </span>
                  <p className="font-medium text-[#1a1a2e] dark:text-white truncate">
                    {company.contact.email
                      ? formatConfidence(company.contact.confidence)
                      : company.contact.linkedin
                        ? <a href={company.contact.linkedin} target="_blank" rel="noreferrer" className="text-[#2563eb] dark:text-[#3b82f6] text-xs">View</a>
                        : '—'}
                  </p>
                </div>
              </div>
            )}

            {company.enrichmentError && (
              <p className="mt-2 text-xs text-red-400 dark:text-red-500">{company.enrichmentError}</p>
            )}
          </div>
        ))}

        {/* Skeleton for pending */}
        {running && Array.from({ length: total - done }).map((_, i) => (
          <div key={`pending-${i}`} className="rounded-xl bg-white dark:bg-[#111827] p-4 shadow-sm ring-1 ring-slate-100 dark:ring-gray-800">
            <div className="flex items-center gap-3">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-100 dark:bg-gray-800" />
              {i === 0 && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <span className="inline-block h-2 w-2 animate-ping rounded-full bg-[#2563eb] dark:bg-[#3b82f6]" />
                  enriching...
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceBadge({ source }) {
  const map = {
    'apollo':         { label: 'Apollo',        cls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
    'apollo-match':   { label: 'Apollo Match',  cls: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' },
    'snov':           { label: 'Snov.io',       cls: 'bg-blue-100   dark:bg-blue-900/30   text-[#2563eb]  dark:text-[#3b82f6]' },
    'hunter':         { label: 'Hunter',        cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  };
  const { label, cls } = map[source] || { label: source || '?', cls: 'bg-slate-100 dark:bg-gray-800 text-gray-500' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

const btnOutline = 'rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800';
const btnPrimary = 'rounded-lg bg-[#2563eb] dark:bg-[#3b82f6] px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-500 disabled:opacity-50';
