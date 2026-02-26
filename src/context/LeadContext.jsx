import { createContext, useContext, useReducer, useCallback } from 'react';

const LeadContext = createContext(null);

const STEPS = ['Search', 'Review', 'Enrich', 'Dashboard', 'Email'];

const initialState = {
  currentStep: 0,
  searchParams: { companyType: '', region: '', count: 10, keywords: '', companySize: '' },
  discoveredCompanies: [],
  selectedCompanies: [],
  enrichedCompanies: [],
  duplicateResults: [],
  crmResults: [],
  emailResults: [],
  auditLog: [],
  loading: false,
  error: null,
  notification: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_SEARCH_PARAMS':
      return { ...state, searchParams: { ...state.searchParams, ...action.payload } };
    case 'SET_DISCOVERED':
      return { ...state, discoveredCompanies: action.payload, selectedCompanies: action.payload.map((_, i) => i) };
    case 'TOGGLE_SELECT': {
      const idx = action.payload;
      const selected = state.selectedCompanies.includes(idx)
        ? state.selectedCompanies.filter((i) => i !== idx)
        : [...state.selectedCompanies, idx];
      return { ...state, selectedCompanies: selected };
    }
    case 'SELECT_ALL':
      return { ...state, selectedCompanies: state.discoveredCompanies.map((_, i) => i) };
    case 'SELECT_NONE':
      return { ...state, selectedCompanies: [] };
    case 'SET_ENRICHED':
      return { ...state, enrichedCompanies: action.payload };
    case 'APPEND_ENRICHED':
      return { ...state, enrichedCompanies: [...state.enrichedCompanies, action.payload] };
    case 'SET_DUPLICATES':
      return { ...state, duplicateResults: action.payload };
    case 'SET_CRM_RESULTS':
      return { ...state, crmResults: action.payload };
    case 'UPDATE_CRM_RESULT': {
      const updated = [...state.crmResults];
      updated[action.payload.index] = { ...updated[action.payload.index], ...action.payload.data };
      return { ...state, crmResults: updated };
    }
    case 'SET_EMAIL_RESULTS':
      return { ...state, emailResults: action.payload };
    case 'UPDATE_EMAIL_RESULT': {
      const emailUpdated = [...state.emailResults];
      emailUpdated[action.payload.index] = { ...emailUpdated[action.payload.index], ...action.payload.data };
      return { ...state, emailResults: emailUpdated };
    }
    case 'ADD_AUDIT':
      return { ...state, auditLog: [...state.auditLog, { ...action.payload, timestamp: new Date().toISOString() }] };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_NOTIFICATION':
      return { ...state, notification: action.payload };
    case 'CLEAR_NOTIFICATION':
      return { ...state, notification: null };
    default:
      return state;
  }
}

export function LeadProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const notify = useCallback((message, type = 'info') => {
    dispatch({ type: 'SET_NOTIFICATION', payload: { message, type } });
    setTimeout(() => dispatch({ type: 'CLEAR_NOTIFICATION' }), 5000);
  }, []);

  return (
    <LeadContext.Provider value={{ state, dispatch, notify, STEPS }}>
      {children}
    </LeadContext.Provider>
  );
}

export function useLeadContext() {
  const context = useContext(LeadContext);
  if (!context) throw new Error('useLeadContext must be used within LeadProvider');
  return context;
}