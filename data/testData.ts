/**
 * Centralized test data — invariant I3.
 *
 * Every domain value a test touches lives here under a named key. No spec file, page object, or
 * plan ever types a business identifier, name, or code directly. Two reasons: a value that changes
 * when the test environment is reseeded gets fixed in one place, and a reader can tell what a test
 * depends on by reading its `Data` field instead of the whole body.
 *
 * The keys below are a shape to copy, not a schema to keep. Replace them with the entities in
 * PROJECT-PROFILE.md section 3, keeping the two in sync — the AI planner agent reads that table to
 * decide which values it is forbidden to inline.
 */

/** The core entity the application manages. */
export const recordData = {
    /** A record that exists and is in its normal, actionable state. */
    validIdentifier: 'CHANGE_ME',
    /** A well-formed identifier that matches no record — for not-found paths. */
    unknownIdentifier: 'CHANGE_ME',
    /** A malformed identifier — for input-validation paths. */
    malformedIdentifier: 'CHANGE_ME',
    /** A record in a terminal state, for transition-guard tests. */
    closedIdentifier: 'CHANGE_ME',
};

/** The person or team a record is assigned to. */
export const ownerData = {
    /** An owner with records assigned, reachable by the baseline role. */
    primary: 'CHANGE_ME',
    /** A second owner, for cross-ownership and permission-boundary tests. */
    secondary: 'CHANGE_ME',
    /** An owner with no records, for empty-state tests. */
    empty: 'CHANGE_ME',
};

/** The organizational unit records are filed under. */
export const groupData = {
    primary: 'CHANGE_ME',
    secondary: 'CHANGE_ME',
};

/**
 * Boundary values for BVA scenarios. Sourced here rather than inlined so a limit change in the
 * application is a one-line edit, and so a plan can name the key it is exercising.
 */
export const boundaries = {
    /** Maximum characters the free-text field accepts. */
    maxTextLength: 0,
    /** Rows shown per page before pagination kicks in. */
    pageSize: 0,
    /** Furthest future date the application accepts, as an offset in days from today. */
    maxFutureDays: 0,
};

/**
 * Strings that have historically broken input handling. Generic across projects — keep these as
 * they are unless the application has its own known-bad inputs worth adding.
 */
export const adversarialInput = {
    empty: '',
    whitespaceOnly: '   ',
    longString: 'A'.repeat(512),
    specialCharacters: `<>&"'/\\%{}[]|^~\``,
    unicode: 'Ωμέγα 漢字 🙂',
    leadingTrailingSpace: '  padded  ',
};

export default { recordData, ownerData, groupData, boundaries, adversarialInput };
