/**
 * Machine-readable mirror of PROJECT-PROFILE.md sections 1, 2 and 5.
 *
 * Keep the two in sync: PROJECT-PROFILE.md is what the AI agents read, this file is what the
 * TypeScript layer reads. Nothing else in the harness should hardcode an application name, a role
 * name, or a tracker key.
 */

/** Role keys for this application. Must match PROJECT-PROFILE.md section 2 and `data/auth_data.ts`. */
export const roles = ['admin', 'role2', 'role3'] as const;

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

/**
 * Fail loudly at import time if the profile was never filled in, rather than letting a run proceed
 * and produce results that look real but were taken against a placeholder configuration.
 */
export function assertProfileConfigured(): void {
    const unset = Object.entries(projectProfile)
        .filter(([, value]) => value === 'CHANGE_ME')
        .map(([key]) => key);

    if (unset.length > 0) {
        throw new Error(
            `Project profile not configured: ${unset.join(', ')} still set to CHANGE_ME.\n` +
            `  Fill in PROJECT-PROFILE.md, then set the matching values in .env (see .env.example).`
        );
    }
}

export default projectProfile;
