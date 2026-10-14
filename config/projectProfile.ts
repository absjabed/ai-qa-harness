/**
 * Machine-readable mirror of PROJECT-PROFILE.md sections 1, 2, 5 and 10.
 *
 * Keep the two in sync: PROJECT-PROFILE.md is what the AI agents read, this file is what the
 * TypeScript layer reads. Nothing else in the harness should hardcode an application name, a role
 * name, or a tracker key.
 */

/** Role keys for this application. Must match PROJECT-PROFILE.md section 2 and `data/auth_data.ts`. */
export const roles = ['admin', 'standardUser', 'readOnlyUser'] as const;

export type Role = (typeof roles)[number];

/**
 * Exit criteria — PROJECT-PROFILE.md section 10. `npm run report:cycle` evaluates each one against the
 * latest run. Percentages are 0–100; counts are absolute.
 */
export interface ExitCriteria {
    /** Share of Priority 1 test cases that must be passing. */
    priority1PassRate: number;
    /** Share of Priority 2 test cases that must be passing. */
    priority2PassRate: number;
    /** Share of acceptance criteria that must have at least one passing test case. */
    acceptanceCriteriaCoverage: number;
    /** Most open defects allowed, by severity. Omit a severity to leave it unbounded. */
    maxOpenDefects: Partial<Record<'P1' | 'P2' | 'P3' | 'P4', number>>;
    /** Most test cases allowed to end the cycle never having been executed. */
    maxNotExecuted: number;
}

export interface ProjectProfile {
    /** Application name, used in log output and report titles. */
    appName: string;
    /** Issue-tracker project key, used by the defect-raiser agent's CSV rows. */
    trackerProjectKey: string;
    /**
     * Pattern every story key must match — PROJECT-PROFILE.md section 1. `npm run check:trace` rejects
     * TCIDs whose story key does not fit it. The default accepts any `ABC-123` style issue key.
     */
    storyKeyPattern: RegExp;
    /** The full-access role every other role's restrictions are defined against. */
    baselineRole: Role;
    /** Roles that can log in. */
    roles: readonly Role[];
    /** Whether DB-backed assertions are in scope for this project. */
    dbValidationEnabled: boolean;
    /** Whether API-level tests are in scope for this project. */
    apiTestsEnabled: boolean;
    /** Schema owner/prefix used when building queries, e.g. 'dbo'. */
    schemaPrefix: string;
    exitCriteria: ExitCriteria;
}

export const projectProfile: ProjectProfile = {
    appName: process.env.APP_NAME || 'CHANGE_ME',
    trackerProjectKey: process.env.TRACKER_PROJECT_KEY || 'CHANGE_ME',
    // Tighten to your tracker's key once known, e.g. /^PROJ-\d+$/.
    storyKeyPattern: /^[A-Z][A-Z0-9]+-\d+$/,
    baselineRole: 'admin',
    roles,
    dbValidationEnabled: process.env.DB_VALIDATION_ENABLED !== 'false',
    apiTestsEnabled: process.env.API_TESTS_ENABLED === 'true',
    // SQL Server's default schema is dbo; PostgreSQL's is public.
    schemaPrefix: process.env.DB_SCHEMA_PREFIX || (process.env.DB_ENGINE === 'postgres' ? 'public' : 'dbo'),
    exitCriteria: {
        priority1PassRate: 100,
        priority2PassRate: 95,
        acceptanceCriteriaCoverage: 100,
        maxOpenDefects: { P1: 0, P2: 0 },
        maxNotExecuted: 0,
    },
};

export default projectProfile;
