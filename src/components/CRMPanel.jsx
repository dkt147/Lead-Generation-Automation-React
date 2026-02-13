import { useState, useEffect } from 'react';
import { useLeadContext } from '../context/LeadContext';
import { checkDuplicates, createLead, updateLead, getColumns } from '../services/api';
import DuplicateResolver from './DuplicateResolver';
import LoadingSpinner from './LoadingSpinner';

export default function CRMPanel() {
  const { state, dispatch, notify } = useLeadContext();
  const { enrichedCompanies, duplicateResults, crmResults } = state;
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [columnMapping, setColumnMapping] = useState(null);

  // Run duplicate check on mount
  useEffect(() => {
    if (duplicateResults.length === 0 && enrichedCompanies.length > 0) {
      runDuplicateCheck();
    }
    if (!columnMapping) {
      loadColumns();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadColumns = async () => {
    try {
      const data = await getColumns();
      const cols = data.columns || [];
      // Auto-map columns by title keyword matching, store id + type
      const mapping = {};
      for (const col of cols) {
        const title = col.title.toLowerCase();
        const entry = { id: col.id, type: col.type };
        if (title.includes('website') || title.includes('url')) mapping.website = entry;
        else if (title.includes('email') && title.includes('sent')) mapping.email_sent = entry;
        else if (title.includes('contact') && title.includes('name')) mapping.contact_name = entry;
        else if (title.includes('email')) mapping.contact_email = entry;
        else if (title.includes('position') || title.includes('role') || title.includes('title')) mapping.contact_position = entry;
        else if (title.includes('description')) mapping.description = entry;
        else if (title.includes('industry')) mapping.industry = entry;
        else if (title.includes('region') || title.includes('location')) mapping.region = entry;
        else if (title.includes('status')) mapping.status = entry;
        else if (title.includes('date')) mapping.date_added = entry;
        else if (title.includes('source')) mapping.lead_source = entry;
      }
      setColumnMapping(mapping);
    } catch (err) {
      console.error('Failed to load columns:', err);
    }
  };

  const runDuplicateCheck = async () => {
    setChecking(true);
    try {
      const data = await checkDuplicates(enrichedCompanies);
      dispatch({ type: 'SET_DUPLICATES', payload: data.results || [] });

      // Initialize CRM results
      const results = (data.results || []).map((r) => ({
        status: r.isDuplicate ? 'duplicate' : 'ready',
        action: null,
        itemId: null,
      }));
      dispatch({ type: 'SET_CRM_RESULTS', payload: results });

      const dupeCount = (data.results || []).filter((r) => r.isDuplicate).length;
      if (dupeCount > 0) {
        notify(`${dupeCount} potential duplicate(s) found - please review`, 'warning');
      } else {
        notify('No duplicates found - ready to push', 'success');
      }
    } catch (err) {
      notify(err.message, 'error');
      // Initialize with all "ready" if check fails
      const results = enrichedCompanies.map(() => ({ status: 'ready', action: null, itemId: null }));
      dispatch({ type: 'SET_CRM_RESULTS', payload: results });
    } finally {
      setChecking(false);
    }
  };

  const handleDuplicateAction = (index, action, existingItemId) => {
    dispatch({
      type: 'UPDATE_CRM_RESULT',
      payload: { index, data: { status: action === 'skip' ? 'skipped' : 'ready', action, existingItemId } },
    });
    dispatch({
      type: 'ADD_AUDIT',
      payload: { company: enrichedCompanies[index]?.name, action, existingItemId },
    });
  };

  const pushToCRM = async () => {
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < enrichedCompanies.length; i++) {
      const result = crmResults[i];
      if (!result || result.status === 'skipped' || result.status === 'pushed') continue;

      try {
        if (result.action === 'update' && result.existingItemId) {
          // Update existing record
          const lead = enrichedCompanies[i];
          const colVals = buildUpdateValues(lead, columnMapping || {});
          await updateLead(result.existingItemId, colVals);
          dispatch({ type: 'UPDATE_CRM_RESULT', payload: { index: i, data: { status: 'pushed', itemId: result.existingItemId } } });
          dispatch({ type: 'ADD_AUDIT', payload: { company: lead.name, action: 'updated', itemId: result.existingItemId } });
        } else {
          // Create new
          const lead = enrichedCompanies[i];
          const data = await createLead(lead, columnMapping || {});
          dispatch({ type: 'UPDATE_CRM_RESULT', payload: { index: i, data: { status: 'pushed', itemId: data.itemId } } });
          dispatch({ type: 'ADD_AUDIT', payload: { company: lead.name, action: 'created', itemId: data.itemId } });
        }
        successCount++;
      } catch (err) {
        dispatch({ type: 'UPDATE_CRM_RESULT', payload: { index: i, data: { status: 'error', error: err.message } } });
        errorCount++;
      }
    }

    if (successCount > 0) notify(`${successCount} leads pushed to Monday.com`, 'success');
    if (errorCount > 0) notify(`${errorCount} leads failed`, 'error');
    setLoading(false);
  };

  if (checking) return <LoadingSpinner message="Checking for duplicates in Monday.com..." />;
  if (loading) return <LoadingSpinner message="Pushing leads to Monday.com..." />;

  const readyCount = crmResults.filter((r) => r?.status === 'ready').length;
  const pushedCount = crmResults.filter((r) => r?.status === 'pushed').length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Monday.com CRM</h2>
          <p className="text-sm text-gray-500">
            {pushedCount} pushed &middot; {readyCount} ready &middot;{' '}
            {crmResults.filter((r) => r?.status === 'skipped').length} skipped
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => dispatch({ type: 'SET_STEP', payload: 2 })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
          {readyCount > 0 && (
            <button
              onClick={pushToCRM}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Push to Monday.com ({readyCount})
            </button>
          )}
          {pushedCount > 0 && (
            <button
              onClick={() => dispatch({ type: 'SET_STEP', payload: 4 })}
              className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Proceed to Email
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {enrichedCompanies.map((company, i) => {
          const result = crmResults[i];
          const dupeResult = duplicateResults[i];
          const status = result?.status || 'ready';

          return (
            <div key={i} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{company.name}</h3>
                  {company.contact && (
                    <p className="text-sm text-gray-500">{company.contact.name} &middot; {company.contact.email}</p>
                  )}
                </div>
                <StatusBadge status={status} />
              </div>

              {result?.error && (
                <p className="mt-2 text-xs text-red-500">{result.error}</p>
              )}

              {status === 'duplicate' && (
                <DuplicateResolver
                  company={company}
                  duplicateResult={dupeResult}
                  onAction={(action, itemId) => handleDuplicateAction(i, action, itemId)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Audit Log */}
      {state.auditLog.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Audit Log</h3>
          <div className="rounded-lg bg-gray-50 p-3">
            {state.auditLog.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 py-1 text-xs text-gray-600">
                <span className="text-gray-400">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className="font-medium">{entry.company}</span>
                <span>&mdash; {entry.action}</span>
                {entry.itemId && <span className="text-gray-400">(ID: {entry.itemId})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    ready: 'bg-blue-100 text-blue-700',
    duplicate: 'bg-yellow-100 text-yellow-700',
    pushed: 'bg-green-100 text-green-700',
    skipped: 'bg-gray-100 text-gray-500',
    error: 'bg-red-100 text-red-700',
  };

  const labels = {
    ready: 'Ready',
    duplicate: 'Potential Duplicate',
    pushed: 'Pushed',
    skipped: 'Skipped',
    error: 'Error',
  };

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.ready}`}>
      {labels[status] || status}
    </span>
  );
}

function buildUpdateValues(lead, mapping) {
  // This is now handled server-side in create-lead.js using the mapping with types
  // Just pass the mapping through — the API formats values based on column type
  return mapping;
}
