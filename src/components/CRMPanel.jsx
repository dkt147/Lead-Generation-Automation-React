import { useState } from 'react';
import { useLeadContext } from '../context/LeadContext';
import { pushLeadToDashboard } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

export default function CRMPanel() {
  const { state, dispatch, notify } = useLeadContext();
  const { enrichedCompanies, crmResults } = state;
  const [loading, setLoading] = useState(false);

  // Initialize CRM results if not yet set
  if (crmResults.length === 0 && enrichedCompanies.length > 0) {
    dispatch({
      type: 'SET_CRM_RESULTS',
      payload: enrichedCompanies.map(() => ({ status: 'ready', action: null, leadId: null })),
    });
  }

  const pushToDashboard = async () => {
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < enrichedCompanies.length; i++) {
      const result = crmResults[i];
      if (!result || result.status === 'pushed') continue;

      try {
        const lead = enrichedCompanies[i];
        const data = await pushLeadToDashboard(lead);
        dispatch({
          type: 'UPDATE_CRM_RESULT',
          payload: { index: i, data: { status: 'pushed', leadId: data.leadId } },
        });
        dispatch({
          type: 'ADD_AUDIT',
          payload: { company: lead.name, action: 'pushed', leadId: data.leadId },
        });
        successCount++;
      } catch (err) {
        dispatch({
          type: 'UPDATE_CRM_RESULT',
          payload: { index: i, data: { status: 'error', error: err.message } },
        });
        errorCount++;
      }
    }

    if (successCount > 0) notify(`${successCount} lead(s) pushed to dashboard`, 'success');
    if (errorCount > 0) notify(`${errorCount} lead(s) failed`, 'error');
    setLoading(false);
  };

  const exportCSV = () => {
    const headers = [
      'Company',
      'Website',
      'Industry',
      'Region',
      'Description',
      'Contact Name',
      'Contact Email',
      'Contact Position',
      'Contact Phone',
      'Status',
    ];

    const rows = enrichedCompanies.map((company, i) => {
      const result = crmResults[i];
      return [
        company.name || '',
        company.website || '',
        company.industry || '',
        company.region || '',
        (company.description || '').replace(/"/g, '""'),
        company.contact?.name || '',
        company.contact?.email || '',
        company.contact?.position || '',
        company.contact?.phone || '',
        result?.status || 'ready',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify('CSV exported successfully', 'success');
  };

  if (loading) return <LoadingSpinner message="Pushing leads to dashboard..." />;

  const readyCount = crmResults.filter((r) => r?.status === 'ready').length;
  const pushedCount = crmResults.filter((r) => r?.status === 'pushed').length;
  const errorCount = crmResults.filter((r) => r?.status === 'error').length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sales Dashboard</h2>
          <p className="text-sm text-gray-500">
            {pushedCount} pushed &middot; {readyCount} ready
            {errorCount > 0 && <> &middot; {errorCount} failed</>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => dispatch({ type: 'SET_STEP', payload: 2 })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={exportCSV}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
          {readyCount > 0 && (
            <button
              onClick={pushToDashboard}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Push to Dashboard ({readyCount})
            </button>
          )}

        </div>
      </div>

      <div className="space-y-3">
        {enrichedCompanies.map((company, i) => {
          const result = crmResults[i];
          const status = result?.status || 'ready';

          return (
            <div key={i} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{company.name}</h3>
                  {company.contact && (
                    <p className="text-sm text-gray-500">
                      {company.contact.name} &middot; {company.contact.email}
                    </p>
                  )}
                </div>
                <StatusBadge status={status} />
              </div>

              {result?.error && <p className="mt-2 text-xs text-red-500">{result.error}</p>}

              {result?.leadId && (
                <p className="mt-1 text-xs text-gray-400">Lead ID: {result.leadId}</p>
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
                <span className="text-gray-400">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="font-medium">{entry.company}</span>
                <span>&mdash; {entry.action}</span>
                {entry.leadId && <span className="text-gray-400">(ID: {entry.leadId})</span>}
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
    pushed: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };

  const labels = {
    ready: 'Ready',
    pushed: 'Pushed',
    error: 'Error',
  };

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.ready}`}
    >
      {labels[status] || status}
    </span>
  );
}
