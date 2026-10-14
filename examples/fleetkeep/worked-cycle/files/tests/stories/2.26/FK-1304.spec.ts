// spec: specs/FK-1304.plan.md
// seed: tests/seeds/driver.spec.ts

import test from '@lib/BaseTest';
import { expect } from '@playwright/test';
import { userLogin } from '@pages/common/login';
import { testUsers } from '@data/auth_data';
import { fleetData, fleetMessages } from '@data/testData';
import { resetTestData } from '@data/seed';

test.describe('Vehicles', () => {
    // Every scenario starts from the seed data: a defect one test leaves open must not block another.
    test.beforeEach(async () => {
        await resetTestData();
    });

    test(
        'FK-1304-TC001 Validate that a vehicle returns to service once its category-A defect is closed',
        { tag: ['@Regression', '@Priority1', '@ReturnToService'] },
        async ({ loginPage, dashboardPage, logout, reportDefectPage, defectPage, vehiclesPage }) => {
            const vehicle = fleetData.vehicleForReturn;
            let defectId = '';

            await test.step('Given the driver has reported a category-A defect on their vehicle, so it is off the road', async () => {
                await userLogin(loginPage, dashboardPage, testUsers.driver);
                defectId = await reportDefectPage.report(vehicle, 'A', fleetData.categoryADescription);
                await logout.logout();
            });
            await test.step('And the transport manager has triaged it and raised a job card', async () => {
                await userLogin(loginPage, dashboardPage, testUsers.transportManager);
                await defectPage.act(defectId, 'Triage', 'Triaged');
                await defectPage.act(defectId, 'Raise job card', 'Job card raised');
                await logout.logout();
            });
            await test.step('And the technician has started work and marked it resolved', async () => {
                await userLogin(loginPage, dashboardPage, testUsers.technician);
                await defectPage.act(defectId, 'Start work', 'In progress');
                await defectPage.act(defectId, 'Mark resolved', 'Resolved');
                await logout.logout();
            });
            await test.step('And the transport manager has closed it', async () => {
                await userLogin(loginPage, dashboardPage, testUsers.transportManager);
                await defectPage.act(defectId, 'Close defect', 'Closed');
            });
            await test.step('When the transport manager returns the vehicle to service', async () => {
                await vehiclesPage.returnToService(vehicle);
            });
            await test.step('Then the vehicle is shown as Roadworthy', async () => {
                await vehiclesPage.expectMessage(fleetMessages.backInService(vehicle));
                expect(await vehiclesPage.statusOf(vehicle)).toBe(fleetData.statusRoadworthy);
            });
        }
    );

    test(
        'FK-1304-TC002 Validate that return to service is refused while the category-A defect is only resolved',
        { tag: ['@Regression', '@Priority1', '@ReturnToService'] },
        async ({ loginPage, dashboardPage, logout, reportDefectPage, defectPage, vehiclesPage }) => {
            const vehicle = fleetData.secondVehicle;
            let defectId = '';

            await test.step('Given the driver has reported a category-A defect on their vehicle, so it is off the road', async () => {
                await userLogin(loginPage, dashboardPage, testUsers.driver);
                defectId = await reportDefectPage.report(vehicle, 'A', fleetData.categoryADescription);
                await logout.logout();
            });
            await test.step('And the defect has been triaged, worked and marked resolved, but not closed', async () => {
                await userLogin(loginPage, dashboardPage, testUsers.transportManager);
                await defectPage.act(defectId, 'Triage', 'Triaged');
                await defectPage.act(defectId, 'Raise job card', 'Job card raised');
                await logout.logout();
                await userLogin(loginPage, dashboardPage, testUsers.technician);
                await defectPage.act(defectId, 'Start work', 'In progress');
                await defectPage.act(defectId, 'Mark resolved', 'Resolved');
                await logout.logout();
            });
            await test.step('When the transport manager tries to return the vehicle to service', async () => {
                await userLogin(loginPage, dashboardPage, testUsers.transportManager);
                await vehiclesPage.returnToService(vehicle);
            });
            await test.step('Then the request is refused', async () => {
                await vehiclesPage.expectMessage(fleetMessages.returnRefused(vehicle, defectId));
                expect(await vehiclesPage.statusOf(vehicle)).toBe(fleetData.statusOffRoad);
            });
        }
    );

    test(
        'FK-1304-TC003 Validate that a driver has no Return to service action on an off-road vehicle',
        { tag: ['@Regression', '@Priority2', '@ReturnToService'] },
        async ({ loginPage, dashboardPage, reportDefectPage, vehiclesPage }) => {
            const vehicle = fleetData.vehicleForReturn;

            await test.step('Given the driver has reported a category-A defect on their vehicle, so it is off the road', async () => {
                await userLogin(loginPage, dashboardPage, testUsers.driver);
                await reportDefectPage.report(vehicle, 'A', fleetData.categoryADescription);
            });
            await test.step('When the driver opens the Vehicles page', async () => {
                await vehiclesPage.open();
            });
            await test.step('Then no Return to service action is offered for that vehicle', async () => {
                expect(await vehiclesPage.statusOf(vehicle)).toBe(fleetData.statusOffRoad);
                await expect(vehiclesPage.returnToServiceButton(vehicle)).toHaveCount(0);
            });
        }
    );
});
