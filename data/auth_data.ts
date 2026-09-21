import { roles, type Role } from '@config/projectProfile';

/**
 * Test user credentials.
 *
 * Values come from `.env` (see `.env.example`) — never written literally in this file. A harness
 * that ships real credentials in source is one `git push` away from leaking them, and rotating a
 * password then means editing code instead of an environment.
 *
 * Add a role: add it to `roles` in `config/projectProfile.ts`, add the matching `<ROLE>_EMAIL` /
 * `<ROLE>_PASSWORD` pair to `.env`, and add the row to PROJECT-PROFILE.md section 2. This file
 * needs no edit — it derives the set from the profile.
 */

export interface UserCredentials {
    email: string;
    password: string;
    role?: string;
}

/** `caseWorker` -> `CASE_WORKER_EMAIL` / `CASE_WORKER_PASSWORD`. */
function envKeyFor(role: string): string {
    return role.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

/**
 * Read a role's credentials. Throws at first use rather than at import, so a suite that only
 * exercises two of the project's roles isn't blocked by the others being unconfigured.
 */
function credentialsFor(role: string): UserCredentials {
    const key = envKeyFor(role);
    const email = process.env[`${key}_EMAIL`];
    const password = process.env[`${key}_PASSWORD`];

    if (!email || !password) {
        throw new Error(
            `Credentials for role '${role}' are not configured.\n` +
            `  Set ${key}_EMAIL and ${key}_PASSWORD in .env — see .env.example.`
        );
    }

    return { email, password, role };
}

/**
 * Credentials keyed by role. Lazily resolved via a proxy so an unconfigured role only fails when a
 * test actually asks for it.
 */
export const testUsers: Record<string, UserCredentials> = new Proxy({} as Record<string, UserCredentials>, {
    get: (_target, prop: string) => credentialsFor(prop),
    has: (_target, prop: string) => (roles as readonly string[]).includes(prop) || prop === 'invalid',
    ownKeys: () => [...roles, 'invalid'],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

/**
 * Named defaults for the roles the suite reaches for most often. Rename these to your own roles —
 * the AI agents read PROJECT-PROFILE.md section 2 to know which names exist, and invariant I4
 * requires every test to log in through one of these rather than a literal.
 *
 * Declared as getters so an unused role never has to be configured.
 */
export const defaultUsers = {
    get admin(): UserCredentials {
        return credentialsFor('admin');
    },
    get standardUser(): UserCredentials {
        return credentialsFor('standardUser');
    },
    get readOnlyUser(): UserCredentials {
        return credentialsFor('readOnlyUser');
    },
    /** An account that should fail authentication, for negative-path tests. */
    get invalid(): UserCredentials {
        return {
            email: process.env.INVALID_EMAIL || 'not-a-real-user@example.invalid',
            password: process.env.INVALID_PASSWORD || 'not-a-real-password',
            role: 'invalid',
        };
    },
};

/** Convenience alias matching the baseline role in PROJECT-PROFILE.md section 2. */
export const defaultUser = (role: Role): UserCredentials => credentialsFor(role);

export default testUsers;
