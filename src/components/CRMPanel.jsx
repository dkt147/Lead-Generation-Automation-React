import { useState } from 'react';
import { useLeadContext } from '../context/LeadContext';
import { pushLeadToDashboard, pushLeadToClay } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

export default function CRMPanel() {
  const { state, dispatch, notify } = useLeadContext();
  const { enrichedCompanies, crmResults } = state;
  const [loading, setLoading] = useState(false);
  const [clayLoading, setClayLoading] = useState(false);

  if (crmResults.length === 0 && enrichedCompanies.length > 0) {
    dispatch({
      type: 'SET_CRM_RESULTS',
      payload: enrichedCompanies.map(() => ({ status: 'ready', action: null, leadId: null })),
    });
  }

  const pushToDashboard = async () => {
    setLoading(true);
    let successCount = 0, errorCount = 0;
    for (let i = 0; i < enrichedCompanies.length; i++) {
      const result = crmResults[i];
      if (!result || result.status === 'pushed') continue;
      try {
        const lead = enrichedCompanies[i];
        const data = await pushLeadToDashboard(lead);
        dispatch({ type: 'UPDATE_CRM_RESULT', payload: { index: i, data: { status: 'pushed', leadId: data.leadId } } });
        dispatch({ type: 'ADD_AUDIT', payload: { company: lead.name, action: 'pushed', leadId: data.leadId } });
        successCount++;
      } catch (err) {
        dispatch({ type: 'UPDATE_CRM_RESULT', payload: { index: i, data: { status: 'error', error: err.message } } });
        errorCount++;
      }
    }
    if (successCount > 0) notify(`${successCount} lead(s) pushed to dashboard`, 'success');
    if (errorCount > 0) notify(`${errorCount} lead(s) failed`, 'error');
    setLoading(false);
  };

  const pushToClay = async () => {
    setClayLoading(true);
    let successCount = 0, errorCount = 0;
    for (let i = 0; i < enrichedCompanies.length; i++) {
      const result = crmResults[i];
      if (!result || result.status === 'clay-pushed') continue;
      try {
        const lead = enrichedCompanies[i];
        const data = await pushLeadToClay(lead);
        dispatch({ type: 'UPDATE_CRM_RESULT', payload: { index: i, data: { status: 'clay-pushed', clayRecordId: data.clayRecordId } } });
        dispatch({ type: 'ADD_AUDIT', payload: { company: lead.name, action: 'pushed to Clay', leadId: data.clayRecordId } });
        successCount++;
      } catch (err) {
        dispatch({ type: 'UPDATE_CRM_RESULT', payload: { index: i, data: { status: 'error', error: err.message } } });
        errorCount++;
      }
    }
    if (successCount > 0) notify(`${successCount} lead(s) pushed to Clay`, 'success');
    if (errorCount > 0) notify(`${errorCount} lead(s) failed`, 'error');
    setClayLoading(false);
  };

  const exportCSV = () => {
    const headers = ['Company','Website','Industry','Region','Description','Contact Name','Contact Email','Contact Position','Contact Phone','Status'];
    const rows = enrichedCompanies.map((company, i) => {
      const result = crmResults[i];
      return [
        company.name || '', company.website || '', company.industry || '',
        company.region || '', (company.description || '').replace(/"/g, '""'),
        company.contact?.name || '', company.contact?.email || '',
        company.contact?.position || '', company.contact?.phone || '',
        result?.status || 'ready',
      ];
    });
    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
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
  if (clayLoading) return <LoadingSpinner message="Pushing leads to Clay..." />;

  const readyCount     = crmResults.filter((r) => r?.status === 'ready').length;
  const pushedCount    = crmResults.filter((r) => r?.status === 'pushed').length;
  const clayPushedCount= crmResults.filter((r) => r?.status === 'clay-pushed').length;
  const errorCount     = crmResults.filter((r) => r?.status === 'error').length;
  const clayReadyCount = crmResults.filter((r) => r?.status !== 'clay-pushed').length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a2e] dark:text-white">Sales Dashboard</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {pushedCount} pushed &middot; {readyCount} ready
            {clayPushedCount > 0 && <> &middot; {clayPushedCount} in Clay</>}
            {errorCount > 0 && <> &middot; {errorCount} failed</>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => dispatch({ type: 'SET_STEP', payload: 2 })} className={btnOutline}>Back</button>
          <button onClick={exportCSV} className={btnOutline}>Export CSV</button>
          {clayReadyCount > 0 && (
            <button onClick={pushToClay} className="rounded-lg bg-violet-600 dark:bg-violet-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 dark:hover:bg-violet-600">
              Push to Clay ({clayReadyCount})
            </button>
          )}
          {readyCount > 0 && (
            <button onClick={pushToDashboard} className={btnPrimary}>
              Push to Dashboard ({readyCount})
            </button>
          )}
          <button
            onClick={() => dispatch({ type: 'SET_STEP', payload: 4 })}
            disabled={!enrichedCompanies.some((c) => c.contact?.email)}
            className={btnPrimary}
          >
            Send Emails
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {enrichedCompanies.map((company, i) => {
          const result = crmResults[i];
          const status = result?.status || 'ready';
          return (
            <div key={i} className="rounded-xl bg-white dark:bg-[#111827] p-4 shadow-sm ring-1 ring-slate-200 dark:ring-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-[#1a1a2e] dark:text-white">{company.name}</h3>
                  {company.contact && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {company.contact.name} &middot; {company.contact.email}
                    </p>
                  )}
                </div>
                <StatusBadge status={status} />
              </div>
              {result?.error && <p className="mt-2 text-xs text-red-400 dark:text-red-500">{result.error}</p>}
              {result?.leadId && <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">Lead ID: {result.leadId}</p>}
            </div>
          );
        })}
      </div>

      {/* Audit Log */}
      {state.auditLog.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Audit Log</h3>
          <div className="rounded-lg bg-slate-50 dark:bg-gray-900/60 p-3">
            {state.auditLog.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 py-1 text-xs text-gray-600 dark:text-gray-400">
                <span className="text-gray-400 dark:text-gray-600">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className="font-medium">{entry.company}</span>
                <span>&mdash; {entry.action}</span>
                {entry.leadId && <span className="text-gray-400 dark:text-gray-600">(ID: {entry.leadId})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    ready:          'bg-blue-100   dark:bg-blue-900/30   text-[#2563eb]  dark:text-[#3b82f6]',
    pushed:         'bg-green-100  dark:bg-green-900/30  text-green-700  dark:text-green-400',
    'clay-pushed':  'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
    error:          'bg-red-100    dark:bg-red-900/30    text-red-700    dark:text-red-400',
  };
  const labels = { ready: 'Ready', pushed: 'Pushed', 'clay-pushed': 'In Clay', error: 'Error' };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || map.ready}`}>
      {labels[status] || status}
    </span>
  );
}

const btnOutline = 'rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800';
const btnPrimary = 'rounded-lg bg-[#2563eb] dark:bg-[#3b82f6] px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-500 disabled:opacity-50';
