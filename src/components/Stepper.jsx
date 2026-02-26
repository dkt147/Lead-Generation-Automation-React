import { useLeadContext } from '../context/LeadContext';

export default function Stepper() {
  const { state, STEPS } = useLeadContext();
  const { currentStep } = state;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  i < currentStep
                    ? 'bg-green-500 text-white'
                    : i === currentStep
                      ? 'bg-[#2563eb] dark:bg-[#3b82f6] text-white'
                      : 'bg-slate-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500'
                }`}
              >
                {i < currentStep ? '✓' : i + 1}
              </div>
              <span
                className={`mt-1 text-xs font-medium ${
                  i === currentStep
                    ? 'text-[#2563eb] dark:text-[#3b82f6]'
                    : 'text-gray-500 dark:text-gray-500'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-2 h-0.5 flex-1 transition-colors ${
                  i < currentStep ? 'bg-green-500' : 'bg-slate-200 dark:bg-gray-800'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
