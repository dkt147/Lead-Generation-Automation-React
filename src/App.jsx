import { useState } from 'react';
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
import { useLeadContext } from './context/LeadContext';

function StepContent() {
  const { state } = useLeadContext();

  switch (state.currentStep) {
    case 0:
      return <SearchForm />;
    case 1:
      return <ResultsTable />;
    case 2:
      return <EnrichmentPanel />;
    case 3:
      return <CRMPanel />;
    case 4:
      return <EmailOutreach />;
    default:
      return <SearchForm />;
  }
}

export default function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <LeadProvider>
      <Layout>
        <Stepper />
        <StepContent />
        <Notification />
      </Layout>
    </LeadProvider>
  );
}
