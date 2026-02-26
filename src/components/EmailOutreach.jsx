import { useState, useEffect } from 'react';
import { useLeadContext } from '../context/LeadContext';
import { previewEmail, sendEmail } from '../services/api';
import { DEFAULT_EMAIL_TEMPLATE } from '../utils/formatters';
import LoadingSpinner from './LoadingSpinner';

export default function EmailOutreach() {
  const { state, dispatch, notify } = useLeadContext();
  const { enrichedCompanies, emailResults } = state;
  const [template, setTemplate] = useState(DEFAULT_EMAIL_TEMPLATE);
  const [senderName, setSenderName] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [sending, setSending] = useState(false);

  // Only show companies with contacts
  const emailableCompanies = enrichedCompanies.filter((c) => c.contact?.email);

  useEffect(() => {
    if (emailResults.length === 0 && emailableCompanies.length > 0) {
      dispatch({
        type: 'SET_EMAIL_RESULTS',
        payload: emailableCompanies.map(() => ({ status: 'pending', sent: false })),
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePreview = async (index) => {
    try {
      const lead = emailableCompanies[index];
      const data = await previewEmail(lead, template, senderName);
      setPreviewData(data);
      setPreviewIndex(index);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSendOne = async (index) => {
    const lead = emailableCompanies[index];
    try {
      const preview = await previewEmail(lead, template, senderName);
      await sendEmail(preview.to, preview.subject, preview.body);
      dispatch({
        type: 'UPDATE_EMAIL_RESULT',
        payload: { index, data: { status: 'sent', sent: true } },
      });
      notify(`Email sent to ${preview.to}`, 'success');
    } catch (err) {
      dispatch({
        type: 'UPDATE_EMAIL_RESULT',
        payload: { index, data: { status: 'error', error: err.message } },
      });
      notify(`Failed to send to ${lead.contact.email}: ${err.message}`, 'error');
    }
  };

  const handleSendAll = async () => {
    setSending(true);
    let sentCount = 0;
    let errorCount = 0;

    for (let i = 0; i < emailableCompanies.length; i++) {
      if (emailResults[i]?.sent) continue;

      try {
        const lead = emailableCompanies[i];
        const preview = await previewEmail(lead, template, senderName);
        await sendEmail(preview.to, preview.subject, preview.body);
        dispatch({
          type: 'UPDATE_EMAIL_RESULT',
          payload: { index: i, data: { status: 'sent', sent: true } },
        });
        sentCount++;
        // Rate limit: 2 seconds between emails
        if (i < emailableCompanies.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (err) {
        dispatch({
          type: 'UPDATE_EMAIL_RESULT',
          payload: { index: i, data: { status: 'error', error: err.message } },
        });
        errorCount++;
      }
    }

    setSending(false);
    if (sentCount > 0) notify(`${sentCount} emails sent successfully`, 'success');
    if (errorCount > 0) notify(`${errorCount} emails failed`, 'error');
  };

  if (sending) return <LoadingSpinner message="Sending emails..." />;

  const pendingCount = emailResults.filter((r) => !r?.sent).length;
  const sentCount = emailResults.filter((r) => r?.sent).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a2e] dark:text-white">Email Outreach</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {emailableCompanies.length} contacts &middot; {sentCount} sent &middot; {pendingCount} pending
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => dispatch({ type: 'SET_STEP', payload: 3 })}
            className="rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800"
          >
            Back
          </button>
          {pendingCount > 0 && (
            <button
              onClick={handleSendAll}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Send All ({pendingCount})
            </button>
          )}
        </div>
      </div>

      {/* Template Editor */}
      <div className="mb-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Email Template</h3>
        <p className="mb-3 text-xs text-gray-500">
          Placeholders: {'{{contact_name}}'}, {'{{company_name}}'}, {'{{company_type}}'}, {'{{region}}'}, {'{{sender_name}}'}, {'{{contact_position}}'}, {'{{industry}}'}
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Sender Name</label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Your Name"
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Subject</label>
            <input
              type="text"
              value={template.subject}
              onChange={(e) => setTemplate((t) => ({ ...t, subject: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Body</label>
            <textarea
              value={template.body}
              onChange={(e) => setTemplate((t) => ({ ...t, body: e.target.value }))}
              rows={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Per-lead email list */}
      <div className="space-y-3">
        {emailableCompanies.map((company, i) => {
          const result = emailResults[i] || {};
          return (
            <div key={i} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div>
                <h4 className="font-medium text-gray-900">{company.name}</h4>
                <p className="text-sm text-gray-500">
                  {company.contact.name} &lt;{company.contact.email}&gt;
                </p>
              </div>
              <div className="flex items-center gap-2">
                {result.sent ? (
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    Sent
                  </span>
                ) : result.status === 'error' ? (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                    Failed
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => handlePreview(i)}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleSendOne(i)}
                      className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Send
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {previewData && previewIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Email Preview</h3>
              <button
                onClick={() => { setPreviewData(null); setPreviewIndex(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                x
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-gray-500">To:</span>
                <p className="text-sm">{previewData.to}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Subject:</span>
                <p className="text-sm font-medium">{previewData.subject}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">Body:</span>
                <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  {previewData.body}
                </pre>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setPreviewData(null); setPreviewIndex(null); }}
                className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleSendOne(previewIndex);
                  setPreviewData(null);
                  setPreviewIndex(null);
                }}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
