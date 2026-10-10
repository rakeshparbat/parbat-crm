-- ============================================================
-- 044_saas_multi_tier_and_super_admin.sql
--
-- 1. Super Admin platform flag on profiles
-- 2. SaaS account status (active/suspended) & AI feature toggle
-- 3. 'manager' role addition to account_role_enum
-- 4. Teams & team_members for Manager -> Sales Agent hierarchy
-- 5. UTM parameters on contacts (utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page_url)
-- 6. Updated is_account_member function to support 'manager' & Super Admin bypass
-- ============================================================

-- 1. Profiles Super Admin flag
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_super_admin
  ON profiles(is_super_admin)
  WHERE is_super_admin = TRUE;

-- 2. SaaS Account control (active status, suspension, AI & Broadcast feature gating)
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS broadcasts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_monthly_quota INTEGER DEFAULT 1000;

-- 3. Add 'manager' to account_role_enum if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'manager'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'account_role_enum')
  ) THEN
    ALTER TYPE account_role_enum ADD VALUE 'manager' BEFORE 'agent';
  END IF;
END $$;

-- 4. Teams & Team Members (Hierarchy: Manager -> Agents)
CREATE TABLE IF NOT EXISTS teams (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  manager_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_account_id ON teams(account_id);
CREATE INDEX IF NOT EXISTS idx_teams_manager_user_id ON teams(manager_user_id);

CREATE TABLE IF NOT EXISTS team_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 5. UTM tracking parameters on contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS landing_page_url TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_utm_campaign
  ON contacts(utm_campaign)
  WHERE utm_campaign IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_utm_source
  ON contacts(utm_source)
  WHERE utm_source IS NOT NULL;

-- 6. Helper: check if caller is super admin
CREATE OR REPLACE FUNCTION is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = check_user_id
      AND is_super_admin = TRUE
  );
$$;

-- 7. Update is_account_member to include 'manager' & Super Admin bypass
CREATE OR REPLACE FUNCTION is_account_member(
  target_account_id UUID,
  min_role account_role_enum DEFAULT 'viewer'
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.is_super_admin = TRUE
        OR (
          p.account_id = target_account_id
          AND CASE p.account_role::text
                WHEN 'owner'   THEN 5
                WHEN 'admin'   THEN 4
                WHEN 'manager' THEN 3
                WHEN 'agent'   THEN 2
                WHEN 'viewer'  THEN 1
                ELSE 0
              END
            >=
              CASE min_role::text
                WHEN 'owner'   THEN 5
                WHEN 'admin'   THEN 4
                WHEN 'manager' THEN 3
                WHEN 'agent'   THEN 2
                WHEN 'viewer'  THEN 1
                ELSE 0
              END
        )
      )
  );
$$;

-- 8. Policies on teams and team_members
DROP POLICY IF EXISTS teams_select ON teams;
CREATE POLICY teams_select ON teams FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS teams_manage ON teams;
CREATE POLICY teams_manage ON teams FOR ALL
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS team_members_select ON team_members;
CREATE POLICY team_members_select ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id
        AND is_account_member(t.account_id)
    )
  );

DROP POLICY IF EXISTS team_members_manage ON team_members;
CREATE POLICY team_members_manage ON team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id
        AND is_account_member(t.account_id, 'admin')
    )
  );
