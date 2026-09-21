/**
 * Re-export of the shared login helper.
 *
 * The helper itself lives in `pages/common/login.ts`, next to the page objects it drives. This
 * file exists because specs conventionally import test-side helpers from `tests/common/` — it is a
 * pointer, not a second copy. Keeping two implementations in sync is a bug waiting to happen.
 */
export { userLogin, default } from '@pages/common/login';
