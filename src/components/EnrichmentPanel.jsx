import { useState, useEffect } from 'react';
import { useLeadContext } from '../context/LeadContext';
import { enrichContacts } from '../services/api';
import { formatConfidence } from '../utils/formatters';
import LoadingSpinner from './LoadingSpinner';

export default function EnrichmentPanel() {
  const { state, dispatch, notify } = useLeadContext();
  const [loading, setLoading] = useState(false);
  const { discoveredCompanies, selectedCompanies, enrichedCompanies } = state;

  const selectedList = selectedCompanies.map((i) => discoveredCompanies[i]);

  useEffect(() => {
    if (enrichedCompanies.length === 0 && selectedList.length > 0) {
      runEnrichment();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runEnrichment = async () => {
    setLoading(true);
    try {
      const data = await enrichContacts(selectedList);
      const enriched = (data.enriched || []).map((c) => ({
        ...c,
        region: state.searchParams.region,
        searchType: state.searchParams.companyType,
      }));
      dispatch({ type: 'SET_ENRICHED', payload: enriched });
      const withContacts = enriched.filter((c) => c.contact).length;
      notify(`Enriched ${enriched.length} companies, ${withContacts} contacts found`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Enriching contacts via Hunter.io..." />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Contact Enrichment</h2>
          <p className="text-sm text-gray-500">
            {enrichedCompanies.filter((c) => c.contact).length} of {enrichedCompanies.length} companies have contacts
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => dispatch({ type: 'SET_STEP', payload: 1 })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_STEP', payload: 3 })}
            disabled={enrichedCompanies.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Proceed to CRM
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {enrichedCompanies.map((company, i) => (
          <div
            key={i}
            className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{company.name}</h3>
                <p className="text-sm text-gray-500">{company.website}</p>
              </div>
              {company.contact ? (
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  Contact Found
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                  No Contact
                </span>
              )}
            </div>

            {company.contact && (
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-gray-50 p-3 text-sm md:grid-cols-4">
                <div>
                  <span className="text-xs text-gray-500">Name</span>
                  <p className="font-medium text-gray-900">{company.contact.name}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Email</span>
                  <p className="font-medium text-gray-900">{company.contact.email}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Position</span>
                  <p className="font-medium text-gray-900">{company.contact.position}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Confidence</span>
                  <p className="font-medium text-gray-900">{formatConfidence(company.contact.confidence)}</p>
                </div>
              </div>
            )}

            {company.enrichmentError && (
              <p className="mt-2 text-xs text-red-500">{company.enrichmentError}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
