import { useLeadContext } from '../context/LeadContext';

const STYLES = {
  info:    'bg-blue-50    dark:bg-blue-900/30  border-[#2563eb] dark:border-[#3b82f6] text-blue-800  dark:text-blue-200',
  success: 'bg-green-50   dark:bg-green-900/30 border-green-500                        text-green-800 dark:text-green-200',
  error:   'bg-red-50     dark:bg-red-900/30   border-red-500                          text-red-800   dark:text-red-200',
  warning: 'bg-yellow-50  dark:bg-yellow-900/30 border-yellow-500                      text-yellow-800 dark:text-yellow-200',
};

export default function Notification() {
  const { state, dispatch } = useLeadContext();
  const { notification } = state;

  if (!notification) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className={`rounded-lg border-l-4 p-4 shadow-lg ${STYLES[notification.type] || STYLES.info}`}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium">{notification.message}</p>
          <button
            onClick={() => dispatch({ type: 'CLEAR_NOTIFICATION' })}
            className="text-current opacity-50 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
