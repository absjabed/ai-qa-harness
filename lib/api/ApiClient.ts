import { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Thin client for the application's API.
 *
 * Only relevant when `API_TESTS_ENABLED=true` in `.env` — if this project has no API surface,
 * delete `lib/api/`, the `apiClient` fixture in `lib/BaseTest.ts`, and the `api` project in
 * `playwright.config.ts`.
 *
 * The request context handed in already carries auth (wired in `lib/BaseTest.ts`), so nothing here
 * touches credentials. Add one method per endpoint the suite exercises, named for the operation
 * rather than the verb+path.
 */
export default class ApiClient {
    constructor(private readonly request: APIRequestContext) {}

    /** CHANGE_ME — replace with a real endpoint for this project. */
    async createRecord(payload: object): Promise<APIResponse> {
        return this.request.post('/CHANGE_ME_records', { data: payload });
    }

    /** CHANGE_ME — replace with a real endpoint for this project. */
    async getRecord(identifier: string): Promise<APIResponse> {
        return this.request.get(`/CHANGE_ME_records/${identifier}`);
    }
}
