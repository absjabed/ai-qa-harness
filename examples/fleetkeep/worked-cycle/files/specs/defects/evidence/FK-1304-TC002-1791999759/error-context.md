# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories\2.26\FK-1304.spec.ts >> Vehicles >> FK-1304-TC002 Validate that return to service is refused while the category-A defect is only resolved
- Location: tests\stories\2.26\FK-1304.spec.ts:49:9

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  locator('main p.msg')
Expected: "FK22 DEF can't return to service: category-A defect DEF-0003 is not closed."
Received: "FK22 DEF is back in service."
Timeout:  5000ms

Call log:
  - Expect "toHaveText" locator('main p.msg') with timeout 5000ms
  - waiting for locator('main p.msg')
    14 × locator resolved to <p class="msg" role="status">FK22 DEF is back in service.</p>
       - unexpected value "FK22 DEF is back in service."

```

```yaml
- status: FK22 DEF is back in service.
```

# Test source

```ts
  1  | import { expect, Page, Locator } from '@playwright/test';
  2  | import BasePage from './BasePage';
  3  | 
  4  | /** Vehicles list — status per registration, and the transport manager's Return to service action. */
  5  | export class VehiclesPage extends BasePage {
  6  |     readonly table: Locator;
  7  |     readonly message: Locator;
  8  | 
  9  |     constructor(page: Page) {
  10 |         super(page);
  11 |         this.table = page.getByRole('table');
  12 |         this.message = page.locator('main p.msg');
  13 |     }
  14 | 
  15 |     async open(): Promise<void> {
  16 |         await this.goto('/vehicles');
  17 |     }
  18 | 
  19 |     row(registration: string): Locator {
  20 |         return this.table.getByRole('row').filter({ has: this.page.getByRole('cell', { name: registration, exact: true }) });
  21 |     }
  22 | 
  23 |     async statusOf(registration: string): Promise<string> {
  24 |         return (await this.row(registration).getByRole('cell').nth(3).innerText()).trim();
  25 |     }
  26 | 
  27 |     returnToServiceButton(registration: string): Locator {
  28 |         return this.row(registration).getByRole('button', { name: 'Return to service' });
  29 |     }
  30 | 
  31 |     async returnToService(registration: string): Promise<void> {
  32 |         await this.open();
  33 |         await this.returnToServiceButton(registration).click();
  34 |     }
  35 | 
  36 |     async expectMessage(text: string): Promise<void> {
> 37 |         await expect(this.message).toHaveText(text);
     |                                    ^ Error: expect(locator).toHaveText(expected) failed
  38 |     }
  39 | }
  40 | 
  41 | /** Report a defect — the driver's walkaround-check form. */
  42 | export class ReportDefectPage extends BasePage {
  43 |     readonly vehicleSelect: Locator;
  44 |     readonly description: Locator;
  45 |     readonly submitButton: Locator;
  46 |     readonly message: Locator;
  47 | 
  48 |     constructor(page: Page) {
  49 |         super(page);
  50 |         this.vehicleSelect = page.getByLabel('Vehicle', { exact: true });
  51 |         this.description = page.getByLabel('Description');
  52 |         this.submitButton = page.getByRole('button', { name: 'Report defect' });
  53 |         this.message = page.locator('main p.msg');
  54 |     }
  55 | 
  56 |     /** Reports a defect and returns its ID, read from the confirmation. */
  57 |     async report(registration: string, category: 'A' | 'B' | 'C', description: string): Promise<string> {
  58 |         await this.goto('/defects/new');
  59 |         await this.vehicleSelect.selectOption(registration);
  60 |         await this.page.getByRole('radio', { name: new RegExp(`^${category} —`) }).check();
  61 |         await this.description.fill(description);
  62 |         await this.submitButton.click();
  63 |         const text = await this.message.innerText();
  64 |         const id = text.match(/DEF-\d{4}/)?.[0];
  65 |         if (!id) throw new Error(`No defect ID in the confirmation: "${text}"`);
  66 |         return id;
  67 |     }
  68 | }
  69 | 
  70 | /** One defect's page — its status, and the actions the signed-in role may take on it. */
  71 | export class DefectPage extends BasePage {
  72 |     readonly status: Locator;
  73 | 
  74 |     constructor(page: Page) {
  75 |         super(page);
  76 |         this.status = page.locator('#defect-status');
  77 |     }
  78 | 
  79 |     async open(defectId: string): Promise<void> {
  80 |         await this.goto(`/defects/${defectId}`);
  81 |     }
  82 | 
  83 |     /** Clicks one action — Triage, Raise job card, Start work, Mark resolved, Close defect — and waits for the new status. */
  84 |     async act(defectId: string, action: string, expectedStatus: string): Promise<void> {
  85 |         await this.open(defectId);
  86 |         await this.page.getByRole('button', { name: action, exact: true }).click();
  87 |         await expect(this.status).toHaveText(expectedStatus);
  88 |     }
  89 | }
  90 | 
```