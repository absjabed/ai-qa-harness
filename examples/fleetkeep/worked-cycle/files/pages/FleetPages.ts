import { expect, Page, Locator } from '@playwright/test';
import BasePage from './BasePage';

/** Vehicles list — status per registration, and the transport manager's Return to service action. */
export class VehiclesPage extends BasePage {
    readonly table: Locator;
    readonly message: Locator;

    constructor(page: Page) {
        super(page);
        this.table = page.getByRole('table');
        this.message = page.locator('main p.msg');
    }

    async open(): Promise<void> {
        await this.goto('/vehicles');
    }

    row(registration: string): Locator {
        return this.table.getByRole('row').filter({ has: this.page.getByRole('cell', { name: registration, exact: true }) });
    }

    async statusOf(registration: string): Promise<string> {
        return (await this.row(registration).getByRole('cell').nth(3).innerText()).trim();
    }

    returnToServiceButton(registration: string): Locator {
        return this.row(registration).getByRole('button', { name: 'Return to service' });
    }

    async returnToService(registration: string): Promise<void> {
        await this.open();
        await this.returnToServiceButton(registration).click();
    }

    async expectMessage(text: string): Promise<void> {
        await expect(this.message).toHaveText(text);
    }
}

/** Report a defect — the driver's walkaround-check form. */
export class ReportDefectPage extends BasePage {
    readonly vehicleSelect: Locator;
    readonly description: Locator;
    readonly submitButton: Locator;
    readonly message: Locator;

    constructor(page: Page) {
        super(page);
        this.vehicleSelect = page.getByLabel('Vehicle', { exact: true });
        this.description = page.getByLabel('Description');
        this.submitButton = page.getByRole('button', { name: 'Report defect' });
        this.message = page.locator('main p.msg');
    }

    /** Reports a defect and returns its ID, read from the confirmation. */
    async report(registration: string, category: 'A' | 'B' | 'C', description: string): Promise<string> {
        await this.goto('/defects/new');
        await this.vehicleSelect.selectOption(registration);
        await this.page.getByRole('radio', { name: new RegExp(`^${category} —`) }).check();
        await this.description.fill(description);
        await this.submitButton.click();
        const text = await this.message.innerText();
        const id = text.match(/DEF-\d{4}/)?.[0];
        if (!id) throw new Error(`No defect ID in the confirmation: "${text}"`);
        return id;
    }
}

/** One defect's page — its status, and the actions the signed-in role may take on it. */
export class DefectPage extends BasePage {
    readonly status: Locator;

    constructor(page: Page) {
        super(page);
        this.status = page.locator('#defect-status');
    }

    async open(defectId: string): Promise<void> {
        await this.goto(`/defects/${defectId}`);
    }

    /** Clicks one action — Triage, Raise job card, Start work, Mark resolved, Close defect — and waits for the new status. */
    async act(defectId: string, action: string, expectedStatus: string): Promise<void> {
        await this.open(defectId);
        await this.page.getByRole('button', { name: action, exact: true }).click();
        await expect(this.status).toHaveText(expectedStatus);
    }
}
