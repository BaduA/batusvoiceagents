/** Idempotent DDL, kept in sync with schema.ts. Runs once per process on first DB access. */
export const DDL = `
CREATE TABLE IF NOT EXISTS agents (
  id text PRIMARY KEY,
  owner text NOT NULL DEFAULT 'anon',
  edit_token_hash text NOT NULL,
  name text NOT NULL,
  config jsonb NOT NULL,
  share_slug text NOT NULL UNIQUE,
  share_enabled boolean NOT NULL DEFAULT false,
  content_warning boolean NOT NULL DEFAULT false,
  moderation_status text NOT NULL DEFAULT 'pending',
  moderation_reason text,
  report_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  agent_id text NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  channel text NOT NULL,
  provider_combo jsonb NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_sec integer,
  est_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  ip_hash text NOT NULL,
  sim_state jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS sessions_agent_idx ON sessions(agent_id);
CREATE INDEX IF NOT EXISTS sessions_started_idx ON sessions(started_at);
CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  latency_ms jsonb,
  usage jsonb
);
CREATE INDEX IF NOT EXISTS messages_session_idx ON messages(session_id, created_at);
CREATE TABLE IF NOT EXISTS action_logs (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  action_name text NOT NULL,
  params jsonb,
  validation_errors jsonb,
  response jsonb,
  response_mode text NOT NULL,
  status text NOT NULL,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS action_logs_session_idx ON action_logs(session_id, created_at);
CREATE TABLE IF NOT EXISTS usage_limits (
  ip_hash text NOT NULL,
  date text NOT NULL,
  session_count integer NOT NULL DEFAULT 0,
  premium_session_count integer NOT NULL DEFAULT 0,
  total_seconds integer NOT NULL DEFAULT 0,
  blocked_attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, date)
);
CREATE TABLE IF NOT EXISTS safety_events (
  id text PRIMARY KEY,
  agent_id text,
  session_id text,
  ip_hash text NOT NULL,
  layer integer NOT NULL,
  decision text NOT NULL,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safety_events_ip_idx ON safety_events(ip_hash, created_at);
`;
