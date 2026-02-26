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

function StepContent() {
  const { state } = useLeadContext();
  switch (state.currentStep) {
    case 0: return <SearchForm />;
    case 1: return <ResultsTable />;
    case 2: return <EnrichmentPanel />;
    case 3: return <CRMPanel />;
    case 4: return <EmailOutreach />;
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
