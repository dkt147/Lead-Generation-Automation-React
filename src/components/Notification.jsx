import { useLeadContext } from '../context/LeadContext';

const STYLES = {
  info: 'bg-blue-50 border-blue-400 text-blue-800',
  success: 'bg-green-50 border-green-400 text-green-800',
  error: 'bg-red-50 border-red-400 text-red-800',
  warning: 'bg-yellow-50 border-yellow-400 text-yellow-800',
};

export default function Notification() {
  const { state, dispatch } = useLeadContext();
  const { notification } = state;

  if (!notification) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm animate-[fadeIn_0.3s_ease-out]">
      <div className={`rounded-lg border-l-4 p-4 shadow-lg ${STYLES[notification.type] || STYLES.info}`}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium">{notification.message}</p>
          <button
            onClick={() => dispatch({ type: 'CLEAR_NOTIFICATION' })}
            className="text-current opacity-50 hover:opacity-100"
          >
            x
          </button>
        </div>
      </div>
    </div>
  );
}
