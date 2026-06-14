import React, { useState, useEffect } from 'react';
import { fetchLogs } from '../services/api';

export default function TimeRangeLogSearch({ projectId }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load default last 30 minutes on mount
  useEffect(() => {
    const now = Date.now();
    const thirtyMinsAgo = now - 30 * 60 * 1000;
    setStart(new Date(thirtyMinsAgo).toISOString().slice(0, -1)); // strip Z for datetime-local
    setEnd(new Date(now).toISOString().slice(0, -1));
    loadLogs(thirtyMinsAgo, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toMs = (iso) => (iso ? Date.parse(iso) : null);

  const loadLogs = async (startMs, endMs) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLogs(projectId, startMs, endMs);
      setLogs(data.logs || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const startMs = toMs(start);
    const endMs = toMs(end);
    if (startMs && endMs && startMs < endMs) {
      loadLogs(startMs, endMs);
    } else {
      setError('Please provide a valid start and end time (start < end).');
    }
  };

  return (
    <div className="time-range-log-search">
      <h3 className="mb-2 text-lg font-semibold">Time‑Based Log Search</h3>
      <div className="flex space-x-2 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="start">
            Start
          </label>
          <input
            id="start"
            type="datetime-local"
            className="border rounded px-2 py-1"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="end">
            End
          </label>
          <input
            id="end"
            type="datetime-local"
            className="border rounded px-2 py-1"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <button
          className="mt-auto bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 transition"
          onClick={handleSearch}
        >
          Search
        </button>
      </div>

      {loading && <div>Loading logs…</div>}
      {error && <div className="text-red-600">Error: {error}</div>}

      {!loading && logs.length > 0 && (
        <div className="overflow-x-auto max-h-96 border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Timestamp</th>
                <th className="p-2 text-left">Route</th>
                <th className="p-2 text-left">Method</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Latency (ms)</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="p-2">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="p-2">{log.route}</td>
                  <td className="p-2">{log.method}</td>
                  <td className="p-2">{log.statusCode}</td>
                  <td className="p-2">{log.responseTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
