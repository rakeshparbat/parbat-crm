-- ============================================================
-- 043_lead_sources.sql — Multi-channel lead ingestion
--
-- Adds three things:
--
--   1. `lead_source` column on `contacts` — tags every contact with
--      its acquisition channel ('whatsapp', 'meta', 'google',
--      'website', 'csv', 'manual'). Nullable so existing rows need
--      no back-fill and the column is completely opt-in.
--
--   2. `meta_lead_configs` table — per-account Meta (Facebook /
--      Instagram) Lead Ads configuration. Stores the Page ID, an
--      encrypted Page Access Token (same AES-256-GCM scheme as
--      whatsapp_config.access_token), and a verify token used during
--      webhook subscription handshake.
--
--   3. `google_lead_configs` table — per-account Google Ads Lead
--      Form Extension configuration. Stores only the webhook key
--      Google embeds in every payload; the endpoint URL is derived
--      from the deployment host, not stored.
--
-- RLS follows the same patterns as the rest of the schema:
--   - Any account member may read config rows (viewer+).
--   - Only admin+ may write (create / update / delete).
--   - Service-role reads bypass RLS (webhook handlers).
--
-- Idempotent — safe to run multiple times. All DDL uses
-- IF NOT EXISTS / OR REPLACE; policies are dropped before recreate.
-- ============================================================

-- ============================================================
-- 1. lead_source column on contacts
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS lead_source TEXT;

-- Index: the contacts page filter + dashboard aggregation both
-- run WHERE lead_source = '…' so a partial index on the column
-- pays for itself almost immediately.
CREATE INDEX IF NOT EXISTS idx_contacts_lead_source
  ON contacts(lead_source)
  WHERE lead_source IS NOT NULL;

-- ============================================================
-- 2. meta_lead_configs
-- ============================================================
CREATE TABLE IF NOT EXISTS meta_lead_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- The Facebook Page ID whose Lead Ads will be routed here.
  -- Meta's page-id is a numeric string; store as TEXT to avoid
  -- precision loss and to match how Meta sends it in webhooks.
  page_id           TEXT NOT NULL,
  -- AES-256-GCM encrypted Page Access Token (same scheme as
  -- whatsapp_config.access_token). Encrypt before INSERT; decrypt
  -- in the webhook handler before any Graph API call.
  page_access_token TEXT NOT NULL,
  -- Shared secret between us and Meta for the /leadgen webhook
  -- subscription handshake (hub.verify_token). Stored encrypted
  -- for the same reason as the access token.
  verify_token      TEXT NOT NULL,
  -- Human label — shown in the Settings UI to distinguish multiple
  -- pages if the user ever adds more than one.
  label             TEXT NOT NULL DEFAULT 'Meta Lead Ads',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One config per page per account. A business may have many
  -- Facebook Pages but only one CRM connection per page.
  UNIQUE (account_id, page_id)
);

CREATE INDEX IF NOT EXISTS meta_lead_configs_account_id_idx
  ON meta_lead_configs (account_id);

ALTER TABLE meta_lead_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_lead_configs_select ON meta_lead_configs;
CREATE POLICY meta_lead_configs_select ON meta_lead_configs FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS meta_lead_configs_insert ON meta_lead_configs;
CREATE POLICY meta_lead_configs_insert ON meta_lead_configs FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS meta_lead_configs_update ON meta_lead_configs;
CREATE POLICY meta_lead_configs_update ON meta_lead_configs FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS meta_lead_configs_delete ON meta_lead_configs;
CREATE POLICY meta_lead_configs_delete ON meta_lead_configs FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON meta_lead_configs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON meta_lead_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. google_lead_configs
-- ============================================================
CREATE TABLE IF NOT EXISTS google_lead_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Google embeds this key in every webhook payload body. We
  -- compare it on receipt to prove the request came from Google.
  -- Not encrypted: it's a shared key the operator pastes from
  -- the Google Ads UI into our Settings page; they can rotate
  -- it there too. (Google doesn't sign with HMAC like Meta does.)
  webhook_key  TEXT NOT NULL,
  -- Optional human label for multi-account setups.
  label        TEXT NOT NULL DEFAULT 'Google Lead Forms',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One active config per account. A single webhook endpoint
  -- receives all Google campaigns for that account.
  UNIQUE (account_id)
);

CREATE INDEX IF NOT EXISTS google_lead_configs_account_id_idx
  ON google_lead_configs (account_id);

ALTER TABLE google_lead_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_lead_configs_select ON google_lead_configs;
CREATE POLICY google_lead_configs_select ON google_lead_configs FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS google_lead_configs_insert ON google_lead_configs;
CREATE POLICY google_lead_configs_insert ON google_lead_configs FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS google_lead_configs_update ON google_lead_configs;
CREATE POLICY google_lead_configs_update ON google_lead_configs FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS google_lead_configs_delete ON google_lead_configs;
CREATE POLICY google_lead_configs_delete ON google_lead_configs FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON google_lead_configs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON google_lead_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
