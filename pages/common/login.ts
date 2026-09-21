import LoginPage from '@pages/LoginPage';
import DashboardPage from '@pages/DashboardPage';
import { UserCredentials } from '@data/auth_data';

/**
 * Shared login helper — invariant I4.
 *
 * Every authenticated test calls this from a `test.beforeEach` rather than repeating login steps
 * inline. It logs in and confirms the session started, so a test that gets as far as its first
 * real step knows it is genuinely authenticated.
 *
 * @param pageLogin - LoginPage fixture
 * @param pageDashboard - DashboardPage fixture
 * @param loginData - credentials from `data/auth_data.ts`, never a literal
 */
export const userLogin = async (
    pageLogin: LoginPage,
    pageDashboard: DashboardPage,
    loginData: UserCredentials
): Promise<void> => {
    await pageLogin.login(loginData.email, loginData.password);
    await pageDashboard.expectLoggedIn();
};

export default userLogin;
