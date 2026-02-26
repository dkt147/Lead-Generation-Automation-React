import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { enrichSingle } from '../services/api';
import { formatConfidence } from '../utils/formatters';

const btnPrimary = 'rounded-lg bg-[#2563eb] dark:bg-[#3b82f6] px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-500 disabled:opacity-50';
const btnOutline = 'rounded-lg border border-slate-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800';

export default function BulkLookup({ onBack }) {
  const [rows, setRows] = useState([]);           // parsed from Excel
  const [results, setResults] = useState([]);      // enrichment results
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0, running: false });
  const [dragOver, setDragOver] = useState(false);
  const abortRef = useRef(false);
  const fileRef = useRef(null);

  // ── Parse uploaded file ──────────────────────────────────────────
  const parseFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);
    setResults([]);
    setProgress({ done: 0, total: 0, running: false });

    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (raw.length < 2) return;

      const headers = raw[0].map((h) => (h || '').toString().trim().toLowerCase());
      const nameIdx    = headers.findIndex((h) => h === 'aus' || h.includes('company') || h.includes('name'));
      const websiteIdx = headers.findIndex((h) => h.includes('website') || h.includes('url') || h.includes('domain'));
      const countryIdx = headers.findIndex((h) => h.includes('country'));
      const locIdx     = headers.findIndex((h) => h.includes('location') || h.includes('city'));
      const personIdx  = headers.findIndex((h) => h === 'name' && !h.includes('company'));
      const titleIdx   = headers.findIndex((h) => h.includes('title') || h.includes('position'));
      const emailIdx   = headers.findIndex((h) => h.includes('email'));
      const linkedinIdx= headers.findIndex((h) => h.includes('linkedin'));
      const categoryIdx= headers.findIndex((h) => h.includes('engine') || h.includes('mro') || h.includes('category') || h.includes('type'));

      const parsed = [];
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i];
        if (!r || !r.length) continue;
        const companyName = nameIdx >= 0 ? (r[nameIdx] || '').toString().trim() : '';
        const website     = websiteIdx >= 0 ? (r[websiteIdx] || '').toString().trim() : '';
        if (!companyName && !website) continue;

        parsed.push({
          name:     companyName,
          website:  website,
          country:  countryIdx >= 0 ? (r[countryIdx] || '').toString().trim() : '',
          location: locIdx >= 0 ? (r[locIdx] || '').toString().trim() : '',
          person:   personIdx >= 0 ? (r[personIdx] || '').toString().trim() : '',
          title:    titleIdx >= 0 ? (r[titleIdx] || '').toString().trim() : '',
          existingEmail: emailIdx >= 0 ? (r[emailIdx] || '').toString().trim() : '',
          linkedin: linkedinIdx >= 0 ? (r[linkedinIdx] || '').toString().trim() : '',
          category: categoryIdx >= 0 ? (r[categoryIdx] || '').toString().trim() : '',
          selected: true,
        });
      }
      setRows(parsed);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      parseFile(file);
    }
  };

  const toggleRow = (idx) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  const selectAll = () => setRows((prev) => prev.map((r) => ({ ...r, selected: true })));
  const selectNone = () => setRows((prev) => prev.map((r) => ({ ...r, selected: false })));

  // ── Run enrichment ───────────────────────────────────────────────
  const runEnrichment = async () => {
    const selected = rows.filter((r) => r.selected);
    if (!selected.length) return;

    abortRef.current = false;
    setResults([]);
    setProgress({ done: 0, total: selected.length, running: true });

    let found = 0;
    const enriched = [];

    for (let i = 0; i < selected.length; i++) {
      if (abortRef.current) break;
      const row = selected[i];
      try {
        const result = await enrichSingle({
          name: row.name,
          website: row.website,
        });
        enriched.push({ ...row, ...result, enriched: true });
        if (result.contact?.email) found++;
      } catch (err) {
        enriched.push({ ...row, contact: null, enrichmentSource: null, enrichmentError: err.message, enriched: true });
      }
      setResults([...enriched]);
      setProgress({ done: i + 1, total: selected.length, running: i + 1 < selected.length });
    }

    setProgress((p) => ({ ...p, running: false }));
  };

  // ── Export results ───────────────────────────────────────────────
  const exportResults = () => {
    const data = results.map((r) => ({
      'Company': r.name,
      'Website': r.website,
      'Country': r.country,
      'Location': r.location,
      'Category': r.category,
      'Contact Name': r.contact?.name || r.person || '',
      'Contact Email': r.contact?.email || r.existingEmail || '',
      'Contact Position': r.contact?.position || r.title || '',
      'Contact Phone': r.contact?.phone || '',
      'LinkedIn': r.contact?.linkedin || r.linkedin || '',
      'Confidence': r.contact?.confidence || '',
      'Source': r.enrichmentSource || '',
      'Error': r.enrichmentError || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Enriched');
    XLSX.writeFile(wb, `enriched_${fileName || 'prospects'}.xlsx`);
  };

  const selectedCount = rows.filter((r) => r.selected).length;
  const { done, total, running } = progress;

  // ── RENDER ───────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a2e] dark:text-white">Bulk Contact Lookup</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Upload a list of companies to find contact details
          </p>
        </div>
        <button onClick={onBack} className={btnOutline}>Back to Pipeline</button>
      </div>

      {/* Upload area */}
      {rows.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
            dragOver
              ? 'border-[#2563eb] bg-blue-50 dark:border-[#3b82f6] dark:bg-blue-900/10'
              : 'border-slate-300 dark:border-gray-700 hover:border-[#2563eb] dark:hover:border-[#3b82f6]'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => parseFile(e.target.files?.[0])}
          />
          <div className="mb-3">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#1a1a2e] dark:text-white">
            Drop your Excel file here or click to browse
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">
            Supports .xlsx, .xls, .csv — expects columns like Company/Name, Website, Location
          </p>
        </div>
      )}

      {/* Parsed rows table */}
      {rows.length > 0 && results.length === 0 && !running && (
        <div className="rounded-xl bg-white dark:bg-[#111827] shadow-sm ring-1 ring-slate-200 dark:ring-gray-800">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-800 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium text-[#1a1a2e] dark:text-white">{rows.length}</span> companies from{' '}
                <span className="font-medium text-[#1a1a2e] dark:text-white">{fileName}</span>
              </span>
              <button onClick={selectAll} className="text-xs text-[#2563eb] dark:text-[#3b82f6] hover:underline">Select all</button>
              <button onClick={selectNone} className="text-xs text-gray-400 hover:underline">Deselect all</button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setRows([]); setFileName(''); }}
                className={btnOutline}
              >
                Change File
              </button>
              <button
                onClick={runEnrichment}
                disabled={selectedCount === 0}
                className={btnPrimary}
              >
                Find Contacts ({selectedCount})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="max-h-[500px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-gray-900/80 text-left text-xs text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2 w-8"></th>
                  <th className="px-4 py-2">Company</th>
                  <th className="px-4 py-2">Website</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Existing Email</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => toggleRow(i)}
                    className={`cursor-pointer border-t border-slate-100 dark:border-gray-800 transition-colors ${
                      row.selected ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-gray-900/40'
                    }`}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggleRow(i)}
                        className="rounded border-gray-300 dark:border-gray-600 text-[#2563eb]"
                      />
                    </td>
                    <td className="px-4 py-2 font-medium text-[#1a1a2e] dark:text-white">{row.name}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{row.website}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{row.location || row.country}</td>
                    <td className="px-4 py-2">
                      {row.category && (
                        <span className="rounded-full bg-slate-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400">
                          {row.category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">{row.existingEmail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enrichment in progress / results */}
      {(running || results.length > 0) && (
        <div>
          {/* Progress bar + controls */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {running
                ? `Enriching ${done} / ${total}...`
                : `${results.filter((r) => r.contact?.email).length} of ${results.length} contacts found`}
            </p>
            <div className="flex gap-2">
              {running ? (
                <button
                  onClick={() => { abortRef.current = true; }}
                  className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Stop
                </button>
              ) : (
                <>
                  <button onClick={() => { setResults([]); setProgress({ done: 0, total: 0, running: false }); }} className={btnOutline}>
                    Back to List
                  </button>
                  <button onClick={exportResults} className={btnPrimary}>
                    Export Results
                  </button>
                </>
              )}
            </div>
          </div>

          {total > 0 && (
            <div className="mb-4 h-1.5 w-full rounded-full bg-slate-200 dark:bg-gray-800">
              <div
                className="h-1.5 rounded-full bg-[#2563eb] dark:bg-[#3b82f6] transition-all duration-300"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
          )}

          {/* Stats summary */}
          {!running && results.length > 0 && (
            <div className="mb-4 grid grid-cols-4 gap-3">
              {[
                { label: 'Total', value: results.length, cls: 'text-[#1a1a2e] dark:text-white' },
                { label: 'Emails Found', value: results.filter((r) => r.contact?.email).length, cls: 'text-green-600 dark:text-green-400' },
                { label: 'Profile Only', value: results.filter((r) => r.contact && !r.contact.email && r.contact.linkedin).length, cls: 'text-yellow-600 dark:text-yellow-400' },
                { label: 'Not Found', value: results.filter((r) => !r.contact || (!r.contact.email && !r.contact.linkedin)).length, cls: 'text-gray-500' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-white dark:bg-[#111827] p-3 text-center shadow-sm ring-1 ring-slate-200 dark:ring-gray-800">
                  <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Result cards */}
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="rounded-xl bg-white dark:bg-[#111827] p-4 shadow-sm ring-1 ring-slate-200 dark:ring-gray-800">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-[#1a1a2e] dark:text-white">{r.name}</h3>
                    <p className="text-sm text-gray-400 dark:text-gray-600">
                      {r.website}
                      {r.location && <span className="ml-2 text-xs">({r.location})</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {r.enrichmentSource && <SourceBadge source={r.enrichmentSource} />}
                    {r.contact?.email ? (
                      <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                        Contact Found
                      </span>
                    ) : r.contact?.linkedin ? (
                      <span className="rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2.5 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
                        Profile Only
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                        No Contact
                      </span>
                    )}
                  </div>
                </div>

                {r.contact && (r.contact.email || r.contact.name) && (
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-slate-50 dark:bg-gray-900/60 p-3 text-sm md:grid-cols-4">
                    <div>
                      <span className="text-xs text-gray-400 dark:text-gray-600">Name</span>
                      <p className="font-medium text-[#1a1a2e] dark:text-white">{r.contact.name || '—'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 dark:text-gray-600">Email</span>
                      <p className="font-medium text-[#1a1a2e] dark:text-white truncate">
                        {r.contact.email || <span className="text-gray-400 italic text-xs">not found</span>}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 dark:text-gray-600">Position</span>
                      <p className="font-medium text-[#1a1a2e] dark:text-white">{r.contact.position || '—'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 dark:text-gray-600">
                        {r.contact.email ? 'Confidence' : 'LinkedIn'}
                      </span>
                      <p className="font-medium text-[#1a1a2e] dark:text-white truncate">
                        {r.contact.email
                          ? formatConfidence(r.contact.confidence)
                          : r.contact.linkedin
                            ? <a href={r.contact.linkedin} target="_blank" rel="noreferrer" className="text-[#2563eb] dark:text-[#3b82f6] text-xs">View</a>
                            : '—'}
                      </p>
                    </div>
                  </div>
                )}

                {r.enrichmentError && (
                  <p className="mt-2 text-xs text-red-400 dark:text-red-500">{r.enrichmentError}</p>
                )}
              </div>
            ))}

            {/* Skeleton for pending */}
            {running && Array.from({ length: Math.min(total - done, 5) }).map((_, i) => (
              <div key={`pending-${i}`} className="rounded-xl bg-white dark:bg-[#111827] p-4 shadow-sm ring-1 ring-slate-100 dark:ring-gray-800">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-100 dark:bg-gray-800" />
                  {i === 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <span className="inline-block h-2 w-2 animate-ping rounded-full bg-[#2563eb] dark:bg-[#3b82f6]" />
                      enriching...
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceBadge({ source }) {
  const map = {
    'apollo':         { label: 'Apollo',        cls: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
    'apollo-match':   { label: 'Apollo Match',  cls: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' },
    'snov':           { label: 'Snov.io',       cls: 'bg-blue-100   dark:bg-blue-900/30   text-[#2563eb]  dark:text-[#3b82f6]' },
    'hunter':         { label: 'Hunter',        cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  };
  const { label, cls } = map[source] || { label: source || '?', cls: 'bg-slate-100 dark:bg-gray-800 text-gray-500' };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
