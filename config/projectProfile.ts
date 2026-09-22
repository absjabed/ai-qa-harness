/**
 * Machine-readable mirror of PROJECT-PROFILE.md sections 1, 2 and 5.
 *
 * Keep the two in sync: PROJECT-PROFILE.md is what the AI agents read, this file is what the
 * TypeScript layer reads. Nothing else in the harness should hardcode an application name, a role
 * name, or a tracker key.
 */

/** Role keys for this application. Must match PROJECT-PROFILE.md section 2 and `data/auth_data.ts`. */
export const roles = ['admin', 'standardUser', 'readOnlyUser'] as const;

export type Role = (typeof roles)[number];

export interface ProjectProfile {
    /** Application name, used in log output and report titles. */
    appName: string;
    /** Issue-tracker project key, used by the defect-raiser agent's CSV rows. */
    trackerProjectKey: string;
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
}

export const projectProfile: ProjectProfile = {
    appName: process.env.APP_NAME || 'CHANGE_ME',
    trackerProjectKey: process.env.TRACKER_PROJECT_KEY || 'CHANGE_ME',
    baselineRole: 'admin',
    roles,
    dbValidationEnabled: process.env.DB_VALIDATION_ENABLED !== 'false',
    apiTestsEnabled: process.env.API_TESTS_ENABLED === 'true',
    schemaPrefix: process.env.DB_SCHEMA_PREFIX || 'dbo',
};

export default projectProfile;
