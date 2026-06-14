# Claude Code Prompt: Time-Based Log Search Feature (Backend + Frontend Integration)

> Paste this entire prompt into Claude Code (claude.ai/code or `claude` CLI) in the root of the cloned `Prothomuse-main-server` repository. Claude Code will read every file it needs, then implement everything described below.

---

## Context

You are working inside the **Prothomuse-main-server** monorepo. It currently contains two workspaces:

| Folder | Role |
|---|---|
| `prothomouse-server/` (Go backend, `cmd/server/main.go` + `internal/`) | REST + WebSocket server, PostgreSQL via `database/sql` |
| `health-dashboard/` (React/Next.js frontend) | Monitoring dashboard UI |

The backend already has:
- `internal/repository/log_repository.go` — a `LogRepository` that reads/writes a `logs` table
- `internal/model/` — data structs including `Metric`, `SystemHealth`
- `internal/services/ingest_service.go` — `IngestService.ProcessMetric`
- `cmd/server/main.go` — HTTP routes and WebSocket handler
- PostgreSQL tables: `logs`, `metrics`, `system_health`, `projects`, `users`

The frontend (`health-dashboard/`) is a React/Next.js app. It may already have a project detail page or logs page; if it doesn't, create one.

---

## Goal

Implement a **time-based log search feature** end-to-end:

1. A new REST API endpoint on the backend to query logs by relative time range (e.g. "last 5 minutes", "last 30 minutes", "last 1 hour", "last 6 hours", "last 24 hours") filtered by `project_key`.
2. A new React UI component in the dashboard that lets the user pick a time range and displays the matching logs.
3. Full wiring: CORS headers, environment-based base URL, error states, loading states.

---

## Step 1 — Understand Existing Code First

Before writing any new code, read these files in full:

```
cmd/server/main.go
internal/repository/log_repository.go
internal/model/log.go          (or wherever the Log struct lives)
internal/services/ingest_service.go
go.mod
health-dashboard/package.json
health-dashboard/src/           (scan the directory tree)
```

Note the exact table name and column names in the `logs` table (check `log_repository.go` and any `migrations/` SQL files). You will need the exact column name for the timestamp field — it may be `timestamp`, `created_at`, or `logged_at`. Use whatever is already there; **do not rename existing columns**.

---

## Step 2 — Backend: Add Time-Based Log Query to Repository

Open `internal/repository/log_repository.go` and add the following method to `LogRepository`:

```go
// GetLogsByTimeRange returns logs for a given projectKey created within
// the last `minutes` minutes, ordered newest-first, limited to `limit` rows.
// `minutes` must be > 0. `limit` defaults to 500 if <= 0.
func (r *LogRepository) GetLogsByTimeRange(projectKey string, minutes int, limit int) ([]model.Log, error)
```

Implementation requirements:
- Use a parameterised query (`$1`, `$2`, `$3`) — never string-interpolate user input into SQL.
- Compute the cutoff timestamp as `NOW() - ($2 * INTERVAL '1 minute')` (PostgreSQL syntax) **or** compute it in Go as `time.Now().Add(-time.Duration(minutes) * time.Minute).UnixMilli()` and compare against the integer/bigint timestamp column — choose whichever matches the column's actual data type.
- Order by the timestamp column `DESC`.
- If `limit <= 0`, use `500`.
- Return `([]model.Log, error)`. Return an empty slice (not nil) when there are no results.

If `model.Log` struct does not yet exist, create `internal/model/log.go` with fields that match the existing `logs` table columns exactly. Derive the fields by reading the `CREATE TABLE` statement in `log_repository.go`'s `CreateTable()` method or in `migrations/`.

---

## Step 3 — Backend: New HTTP Endpoint

In `cmd/server/main.go`, register a new route **before** `http.ListenAndServe`:

```
GET /api/logs/search?projectKey=<key>&range=<minutes>&limit=<n>
```

Handler requirements:

1. **Authentication**: Read the `Authorization` header. Accept either:
   - `Bearer <jwt>` — validate with the existing JWT validation logic (reuse `authService` or the same approach used in `/api/auth/validate-jwt`).
   - `ApiKey <key>` — validate with the existing API key logic.
   - If neither is present, return `401 Unauthorized`.

2. **Query params**:
   - `projectKey` (required) — the project to query logs for.
   - `range` (required) — number of minutes as an integer string. Accept friendly aliases too: `"5"`, `"30"`, `"60"`, `"360"`, `"1440"`. If the value is not a positive integer, return `400 Bad Request` with a JSON error body.
   - `limit` (optional, default `200`, max `500`).

3. **CORS**: Add the following headers to ALL responses from this handler (needed for the React frontend):
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, OPTIONS
   Access-Control-Allow-Headers: Authorization, Content-Type
   ```
   Handle `OPTIONS` preflight by returning `200` immediately.

4. **Response** (200):
   ```json
   {
     "projectKey": "proj_abc",
     "rangeMinutes": 30,
     "count": 42,
     "logs": [ /* array of Log objects */ ]
   }
   ```

5. **Error responses** must always be JSON with shape `{"error": "<message>"}`.

6. Log to `log.Printf` each request: `[LOG SEARCH] projectKey=%s range=%dm count=%d`.

Register the route in `main()`:
```go
http.HandleFunc("/api/logs/search", logSearchHandler)
```

Also add a global CORS middleware wrapper or add CORS headers inside every handler that the frontend will call (at minimum `/api/logs/search` and `/api/auth/login`).

---

## Step 4 — Backend: Wire logRepo into main

`logRepo` is already created in `main()` as `logRepo := repository.NewLogRepository(db)`. Pass it into the new handler via closure, exactly as `ingestSvc` is passed to `/stream`:

```go
http.HandleFunc("/api/logs/search", func(w http.ResponseWriter, r *http.Request) {
    logSearchHandler(w, r, logRepo, authService)
})
```

---

## Step 5 — Frontend: API Client

Create `health-dashboard/src/api/logsApi.ts` (or `.js` if the project is JavaScript):

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type LogEntry = {
  id: number;
  projectKey: string;
  apiKey?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  timestamp: number; // Unix ms
  message?: string;
  level?: string;
};

export type LogSearchResponse = {
  projectKey: string;
  rangeMinutes: number;
  count: number;
  logs: LogEntry[];
};

export async function fetchLogsByTimeRange(
  projectKey: string,
  rangeMinutes: number,
  token: string,
  limit = 200
): Promise<LogSearchResponse> {
  const url = `${BASE_URL}/api/logs/search?projectKey=${encodeURIComponent(projectKey)}&range=${rangeMinutes}&limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Failed to fetch logs");
  }
  return res.json();
}
```

---

## Step 6 — Frontend: TimeRangeLogSearch Component

Create `health-dashboard/src/components/TimeRangeLogSearch.tsx` (or `.jsx`):

Requirements:
- **Time range selector**: A row of clickable buttons (or a `<select>`) with these options:
  - `5 min ago` → 5 minutes
  - `15 min ago` → 15 minutes
  - `30 min ago` → 30 minutes
  - `1 hour ago` → 60 minutes
  - `6 hours ago` → 360 minutes
  - `24 hours ago` → 1440 minutes
  - The currently selected range is visually highlighted.
- **Auto-fetch**: When the user selects a range, immediately fire the API call.
- **Refresh button**: A manual refresh icon/button to re-fetch with the current range.
- **Loading state**: Show a spinner or "Loading logs…" text while the request is in flight.
- **Error state**: Show a dismissable red banner with the error message if the request fails.
- **Empty state**: Show "No logs found in this time range." if `count === 0`.
- **Log table**: When results arrive, render a table with columns:
  - `Time` — format the `timestamp` (Unix ms) as a human-readable local datetime using `new Date(ts).toLocaleString()`.
  - `Method` — HTTP method badge (color-coded: GET=blue, POST=green, PUT=yellow, DELETE=red, etc.)
  - `Route` — path string
  - `Status` — status code badge (2xx=green, 4xx=orange, 5xx=red)
  - `Response Time` — in ms
  - `Level` — if the log has a `level` field (INFO/WARN/ERROR), show a badge; otherwise omit the column.
- **Props**:
  ```typescript
  interface Props {
    projectKey: string;
    token: string;
  }
  ```
- Use Tailwind CSS utility classes for styling (the project likely has Tailwind configured).
- The component should auto-fetch on mount with the default range of `30 minutes`.

Example skeleton:
```typescript
"use client"; // if Next.js App Router

import { useEffect, useState } from "react";
import { fetchLogsByTimeRange, LogEntry } from "@/api/logsApi";

const TIME_RANGES = [
  { label: "5 min ago",   minutes: 5   },
  { label: "15 min ago",  minutes: 15  },
  { label: "30 min ago",  minutes: 30  },
  { label: "1 hour ago",  minutes: 60  },
  { label: "6 hours ago", minutes: 360 },
  { label: "24 hours ago",minutes: 1440},
];

export default function TimeRangeLogSearch({ projectKey, token }: Props) {
  const [selectedRange, setSelectedRange] = useState(30);
  const [logs, setLogs]       = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [count, setCount]     = useState(0);

  const load = async (minutes: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLogsByTimeRange(projectKey, minutes, token);
      setLogs(data.logs);
      setCount(data.count);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(selectedRange); }, [projectKey, selectedRange]);

  // ... render time-range buttons, table, loading/error/empty states
}
```

---

## Step 7 — Frontend: Integrate into Project Page

Find the existing project detail page in `health-dashboard/src/` — it is likely at one of:
- `app/projects/[id]/page.tsx`
- `app/dashboard/[projectKey]/page.tsx`
- `pages/projects/[id].tsx`

If no project detail page exists, create `health-dashboard/src/app/projects/[projectKey]/page.tsx` (Next.js App Router) with a minimal layout that:
- Reads `projectKey` from the URL params.
- Reads the JWT token from `localStorage` (key: `"token"`) or from a context/store if one already exists in the project.
- Renders `<TimeRangeLogSearch projectKey={projectKey} token={token} />`.

If the project detail page already exists, import and add `<TimeRangeLogSearch>` to it in a logical position (e.g. below any existing metrics charts).

---

## Step 8 — Environment Config

Ensure `health-dashboard/.env.local` (create if missing) contains:
```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Do not commit secrets. Add `.env.local` to `health-dashboard/.gitignore` if not already there.

---

## Step 9 — Verify Nothing is Broken

After making all changes:

1. In the backend directory, run:
   ```bash
   go build ./...
   ```
   Fix any compilation errors before finishing.

2. Confirm the new route is listed in the startup log alongside the existing endpoints.

3. In `health-dashboard/`, run:
   ```bash
   npm run build   # or yarn build
   ```
   Fix any TypeScript/lint errors before finishing.

---

## Constraints & Style Rules

- **Do not break existing endpoints** — `/api/auth/*`, `/stream`, `/metrics`, `/health` must remain unchanged.
- **Do not rename existing DB columns or table names.**
- **Do not add new Go dependencies** unless absolutely necessary. Prefer stdlib (`net/http`, `database/sql`, `encoding/json`, `strconv`, `time`).
- **Do not add new npm dependencies** unless absolutely necessary. Prefer what's already in `package.json`.
- Use the same code style (formatting, naming conventions) already present in the files you read.
- All SQL must use parameterised queries — no string interpolation.
- All new Go functions must have a one-line comment explaining their purpose.
- All new TypeScript/React components must have a JSDoc comment at the top.

---

## Deliverables Checklist

When done, confirm each item is complete:

- [ ] `internal/repository/log_repository.go` — `GetLogsByTimeRange` method added
- [ ] `internal/model/log.go` — `Log` struct exists with correct fields
- [ ] `cmd/server/main.go` — `/api/logs/search` route registered with CORS headers
- [ ] `cmd/server/main.go` — `logSearchHandler` function implemented
- [ ] `go build ./...` passes with zero errors
- [ ] `health-dashboard/src/api/logsApi.ts` — `fetchLogsByTimeRange` function
- [ ] `health-dashboard/src/components/TimeRangeLogSearch.tsx` — full component
- [ ] Project detail page renders `<TimeRangeLogSearch>`
- [ ] `health-dashboard/.env.local` has `NEXT_PUBLIC_API_URL`
- [ ] `npm run build` passes with zero errors
