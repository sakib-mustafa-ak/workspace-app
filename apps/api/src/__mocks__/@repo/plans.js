// Jest mock for `@repo/plans` (a pure workspace package). Kept in sync with the
// real source at packages/plans/src/index.ts; mirrors the @repo/database mock.
// Used only by the API's unit tests so ts-jest never has to transform the
// package's ESM output.
const PLAN_RANK = { FREE: 0, PRO: 1, TEAM: 2 };
const PLAN_LIMITS = {
  FREE: { boards: 3, members: 3, ownedWorkspaces: 1 },
  PRO: { boards: null, members: null, ownedWorkspaces: null },
  TEAM: { boards: null, members: null, ownedWorkspaces: null },
};
const PLAN_FEATURES = {
  AUDIT_LOG_EXPORT: 'AUDIT_LOG_EXPORT',
  SSO: 'SSO',
  ADMIN_TOOLS: 'ADMIN_TOOLS',
};
const PLAN_FEATURE_BY_ID = {
  FREE: [],
  PRO: [],
  TEAM: ['AUDIT_LOG_EXPORT', 'SSO', 'ADMIN_TOOLS'],
};
const PLAN_LABELS = { FREE: 'Free', PRO: 'Pro', TEAM: 'Team' };
const PRICED_PLAN_IDS = ['PRO', 'TEAM'];
const PRICED_PLAN_MONTHLY_PRICE_CENTS = { PRO: 0, TEAM: 0 };

function isPricedPlanId(value) {
  return value === 'PRO' || value === 'TEAM';
}

module.exports = {
  PLAN_RANK,
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLAN_FEATURE_BY_ID,
  PLAN_LABELS,
  PRICED_PLAN_IDS,
  PRICED_PLAN_MONTHLY_PRICE_CENTS,
  isPricedPlanId,
};
