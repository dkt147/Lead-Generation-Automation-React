import { useState, useEffect } from 'react';
import { LeadProvider } from './context/LeadContext';
import Layout from './components/Layout';
import Stepper from './components/Stepper';
import SearchForm from './components/SearchForm';
import ResultsTable from './components/ResultsTable';
import EnrichmentPanel from './components/EnrichmentPanel';
import CRMPanel from './components/CRMPanel';
import EmailOutreach from './components/EmailOutreach';
import Notification from './components/Notification';
import Login from './components/Login';
import BulkLookup from './components/BulkLookup';
import { useLeadContext } from './context/LeadContext';

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return [dark, () => setDark((d) => !d)];
}

function CompletionScreen() {
  const { state, dispatch } = useLeadContext();
  const enriched = state.enrichedCompanies.filter((c) => c.contact?.email).length;
  const sent = state.emailResults.filter((r) => r?.sent).length;
  const pushed = state.crmResults.filter((r) => r?.status === 'pushed' || r?.status === 'clay-pushed').length;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <svg className="h-10 w-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Pipeline Complete!</h2>
      <p className="mb-8 text-gray-500 dark:text-gray-400">Your lead generation pipeline has finished successfully.</p>
      <div className="mb-8 flex gap-6">
        <div className="rounded-xl bg-white dark:bg-gray-800 px-6 py-4 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
          <p className="text-2xl font-bold text-blue-600">{enriched}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Contacts Found</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 px-6 py-4 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
          <p className="text-2xl font-bold text-green-600">{pushed}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Pushed to CRM</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 px-6 py-4 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
          <p className="text-2xl font-bold text-purple-600">{sent}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Emails Sent</p>
        </div>
      </div>
      <button
        onClick={() => dispatch({ type: 'RESET' })}
        className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
      >
        Start New Search
      </button>
    </div>
  );
}

function StepContent() {
  const { state } = useLeadContext();
  switch (state.currentStep) {
    case 0: return <SearchForm />;
    case 1: return <ResultsTable />;
    case 2: return <EnrichmentPanel />;
    case 3: return <CRMPanel />;
    case 4: return <EmailOutreach />;
    case 5: return <CompletionScreen />;
    default: return <SearchForm />;
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [dark, toggleDark] = useDarkMode();
  const [mode, setMode] = useState('pipeline'); // 'pipeline' | 'bulk'

  if (!user) {
    return <Login onLogin={setUser} dark={dark} toggleDark={toggleDark} />;
  }

  return (
    <LeadProvider>
      <Layout dark={dark} toggleDark={toggleDark}>
        {/* Mode toggle tabs */}
        <div className="mb-4 flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-gray-800/60 p-1 w-fit">
          <button
            onClick={() => setMode('pipeline')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === 'pipeline'
                ? 'bg-white dark:bg-[#111827] text-[#1a1a2e] dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Discovery Pipeline
          </button>
          <button
            onClick={() => setMode('bulk')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === 'bulk'
                ? 'bg-white dark:bg-[#111827] text-[#1a1a2e] dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Bulk Lookup
          </button>
        </div>

        {mode === 'pipeline' ? (
          <>
            <Stepper />
            <StepContent />
          </>
        ) : (
          <BulkLookup onBack={() => setMode('pipeline')} />
        )}
        <Notification />
      </Layout>
    </LeadProvider>
  );
}
