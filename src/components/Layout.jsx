export default function Layout({ children, dark, toggleDark }) {
  return (
    <div className="min-h-screen bg-[#f1f5f9] dark:bg-[#0d1117]">
      {/* Nav */}
      <header className="border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-[#111827] shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#1a1a2e] dark:text-white">
                Lead Generation
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                AI-powered company discovery and outreach
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-3 py-1 text-xs font-medium text-[#2563eb] dark:text-[#3b82f6]">
                Phase 2
              </span>
              <ThemeToggle dark={dark} toggle={toggleDark} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <footer className="border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-[#111827]">
        <div className="mx-auto max-w-6xl px-4 py-3 text-center text-xs text-gray-400 dark:text-gray-600">
          Lead Generation App v2.0 &mdash; React + Vercel Serverless
        </div>
      </footer>
    </div>
  );
}

function ThemeToggle({ dark, toggle }) {
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-700"
    >
      {dark ? (
        /* Sun icon */
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
        </svg>
      ) : (
        /* Moon icon */
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
