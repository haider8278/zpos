# POS System Specification with FBR Integration

## Problem Statement

Tier-1 retailers in Pakistan need a Point of Sale (POS) system that can process in-store sales quickly while meeting Pakistan Federal Board of Revenue (FBR) integration requirements. The system must support common retail workflows, calculate applicable taxes accurately, submit invoices to FBR in real time where possible, print legally compliant receipts, and continue operating during temporary internet or FBR service outages without losing transaction data.

## Proposed Solution

Build a POS platform with checkout, inventory, role-based access control, and FBR tax integration. The checkout flow will calculate discounts, taxes, payment splits, and FBR POS fees before invoice finalization. On sale completion, the system will submit the invoice payload to the FBR/PRAL API, store the returned fiscal invoice number, generate an FBR QR code, and print the receipt.

If FBR or internet connectivity is unavailable, the sale will still be recorded locally with a `Pending Sync` status. A background queue manager will retry submission automatically, update invoice status after successful sync, and alert business administrators if the failure persists long enough to require regulatory escalation.

## Goals

* Process retail sales with cash, card, mobile wallet, bank transfer, and split-payment support.
* Maintain inventory and product catalog data across outlets and warehouses.
* Enforce role-based restrictions for sensitive actions.
* Calculate sales tax, further tax, discounts, and FBR POS fees consistently.
* Submit invoices, returns, and credit/debit notes to FBR.
* Print receipts containing FBR fiscal invoice information and QR code.
* Support offline checkout and automatic invoice synchronization.

## Non-Goals

* Full accounting ledger implementation.
* Payroll, HR, or staff scheduling.
* Customer-facing e-commerce storefront.
* Direct banking settlement or payment processor reconciliation beyond recording payment method and reference metadata.

## Functional Requirements

### Sales & Checkout

* Cashiers must be able to add products by barcode, SKU, or search.
* The system must support line-item discounts, cart-wide discounts, promotions, and loyalty point redemption.
* A sale must support one or more payment methods, including Cash, Credit/Debit Card, EasyPaisa, JazzCash, and Bank Transfer.
* Split payments must validate that the sum of payment amounts equals the final payable invoice total.
* The invoice must not be finalized until stock, pricing, discount, tax, and payment validation pass.
* Completed invoices must be immutable except through authorized return, void, debit note, or credit note workflows.

### Inventory & Catalog

* Products must support SKU, item name, barcode, size, color, competitor SKU, tax category, and optional PCT/HS code.
* Stock quantity must update after each completed sale, return, goods receipt, or transfer.
* The system must support low-stock thresholds and notify authorized users when stock falls below configured limits.
* Store managers must be able to create purchase orders and record Goods Received Notes (GRNs).
* Multi-outlet inventory transfers must track source, destination, quantity, transfer status, and responsible user.

### RBAC & Security

* Supported roles must include Admin, Store Manager, and Cashier.
* Only authorized roles may open cash drawers outside a sale, void invoices, process returns, approve manual discount overrides, or modify tax configuration.
* All sensitive actions must be audit logged with user, timestamp, outlet, action type, affected entity, and before/after values where applicable.
* User sessions must expire after a configurable inactivity period.

### Tax Calculation

* Tax rates must be configurable by product tax category and effective date.
* The system must support standard, reduced, zero-rated, and exempt tax categories.
* The system must support additional further tax for eligible buyer or transaction types, including unregistered B2B buyers.
* The FBR POS service fee must be automatically added per invoice when enabled by configuration.
* Tax calculation must occur before FBR submission and receipt printing.

### FBR Invoice Submission

* FBR submission must be triggered when a cashier completes a transaction and before the final receipt is printed when connectivity is available.
* The system must generate a unique `USIN` for every invoice.
* The FBR payload must include at minimum:
  * `POSID`
  * `USIN`
  * `DateTime`
  * `TotalSaleValue`
  * `TotalTaxCharged`
  * `Discount`
  * `TotalBillAmount`
  * `PaymentMode`
  * `InvoiceType`
  * `InvoiceItems`
* Each invoice item must include at minimum:
  * `ItemCode`
  * `ItemName`
  * `PCTCode`, when applicable
  * `Quantity`
  * `TaxRate`
  * `TaxCharged`
* On successful FBR submission, the system must persist the FBR fiscal invoice number and full response metadata.
* On FBR timeout, validation failure, or connectivity failure, the system must persist the invoice locally and mark it with the appropriate sync status.

### Receipts

* Receipts must include store name, outlet address, NTN, STRN, POS ID, USIN, date/time, item details, discounts, tax, FBR POS fee, total, and payment summary.
* Receipts for successfully synced invoices must include the FBR fiscal invoice number.
* Receipts must include an FBR QR code generated from the approved FBR response payload.
* For offline or pending invoices, the receipt must clearly indicate that FBR sync is pending and must be reprintable after sync completes.

### Returns, Voids, Credit Notes, and Debit Notes

* Returns and voids must require role-based authorization.
* A return must reference the original invoice.
* The system must generate the correct FBR debit note or credit note payload for tax adjustment.
* Inventory must be restored or adjusted according to the approved return workflow.
* Partial returns must adjust item quantity, tax, discount allocation, and payment refund amount accurately.

### Offline Mode & Queue Management

* The POS must continue creating invoices when internet connectivity or FBR service is unavailable.
* Offline invoices must be stored in a durable local cache using SQLite, IndexedDB, or equivalent local persistence.
* A background sync process must retry pending FBR submissions automatically.
* Retry behavior must use configurable retry intervals and must avoid duplicate FBR submissions for the same `USIN`.
* Administrators must be alerted when pending sync remains unresolved beyond the configured compliance threshold.

## Acceptance Criteria

### Checkout

* Given a cashier adds items and accepts full payment, when the sale is completed, then the system creates an invoice, decrements stock, calculates tax, records payment, submits to FBR if online, and prints a receipt.
* Given multiple payment methods are used, when payment totals do not equal the invoice total, then the system blocks completion and displays the remaining or excess amount.
* Given a cashier attempts a restricted discount override, when the cashier lacks permission, then the action is blocked and an authorization prompt or error is shown.

### FBR Integration

* Given FBR returns a successful response, when the invoice is saved, then the fiscal invoice number and QR payload are stored and printed.
* Given FBR is unavailable, when a sale is completed, then the invoice is saved with `Pending Sync`, a pending receipt can be printed, and the queue retries automatically.
* Given a pending invoice sync succeeds later, when the invoice is opened or reprinted, then the receipt includes the FBR fiscal invoice number and QR code.
* Given the same invoice is retried, when the queue manager runs, then it must not create duplicate fiscal invoices for the same `USIN`.

### Inventory

* Given a sale completes, when stock is available, then item quantities decrease immediately.
* Given stock falls below threshold, when the transaction is saved, then authorized users receive a low-stock notification.
* Given a GRN is recorded against a purchase order, when it is approved, then stock increases for the receiving outlet or warehouse.

### Security & Audit

* Given a restricted action is performed, when it succeeds or fails, then the audit log records the actor, timestamp, action, and result.
* Given an inactive user session exceeds the configured timeout, when the user attempts another action, then re-authentication is required.

## Technical Considerations

### Architecture

* Recommended client options: Next.js for web POS or Electron for desktop POS.
* Recommended backend options: Node.js or Laravel.
* Recommended primary database: PostgreSQL or MySQL.
* Recommended local offline cache: SQLite for desktop/Electron or IndexedDB for browser-based POS.
* Use a server-side integration layer for FBR credentials, payload signing or transformation, request retries, and response persistence.

### Data Model

Core entities should include:

* `User`
* `Role`
* `Permission`
* `Outlet`
* `Product`
* `ProductVariant`
* `InventoryBalance`
* `PurchaseOrder`
* `GoodsReceivedNote`
* `InventoryTransfer`
* `Invoice`
* `InvoiceItem`
* `Payment`
* `TaxRate`
* `FbrSubmission`
* `AuditLog`

### Invoice Statuses

Invoices should support at least these statuses:

* `Draft`
* `Completed`
* `PendingSync`
* `Synced`
* `SyncFailed`
* `Voided`
* `Returned`
* `PartiallyReturned`

### FBR Submission Statuses

FBR submissions should support at least these statuses:

* `NotRequired`
* `Queued`
* `InProgress`
* `Succeeded`
* `FailedRetryable`
* `FailedPermanent`

### Configuration

The system must separate configuration for:

* FBR sandbox environment.
* FBR production environment.
* Store/outlet POS IDs.
* Tax rates and effective dates.
* POS fee amount and enablement.
* Retry intervals and maximum retry attempts.
* Compliance alert threshold.
* Session timeout.

### Performance

* Checkout UI interactions should remain responsive under normal store load.
* FBR payload preparation and response handling should complete in under 500ms excluding external network latency.
* Product search by barcode or SKU should return results within 300ms for normal catalog sizes.
* Queue processing must run asynchronously and must not block cashier checkout.

### Reliability

* Every completed sale must be durably persisted before receipt printing.
* Local offline storage must survive app restart, browser refresh, or device reboot.
* Queue retries must be idempotent using `USIN` or a dedicated idempotency key.
* Failed sync attempts must retain request payload, response/error details, attempt count, and next retry time.

### Security

* FBR credentials must never be stored in client-side source code.
* Sensitive credentials must be encrypted at rest and injected through environment-specific configuration.
* All API calls should use TLS.
* Audit logs should be append-only for normal application users.
* Manual tax-rate changes must require privileged access and be auditable.

## Edge Cases

* Internet drops after local invoice save but before FBR response is received.
* FBR accepts an invoice but the POS times out before receiving the fiscal invoice number.
* Duplicate retry is attempted for an invoice that may already exist in FBR.
* Cashier closes the app while invoices are pending sync.
* Printer failure occurs after successful FBR submission.
* QR code generation fails after FBR success.
* Partial payment is recorded and then one payment provider fails.
* Product tax category changes while items are already in the cart.
* Discount reduces taxable value to zero.
* Return is attempted for an invoice that has not yet synced to FBR.
* Partial return applies to an item with cart-level discount allocation.
* Stock is sold offline at multiple counters and later creates negative stock.
* FBR sandbox and production credentials are accidentally misconfigured.
* POS ID is invalid, suspended, or not registered for the outlet.
* Buyer registration status changes after invoice creation.
* Clock drift causes invoice timestamps to be outside acceptable FBR tolerance.

## Implementation Notes

* Treat FBR API contracts, tax rates, POS fee rules, and reporting obligations as configurable and subject to verification against current FBR/PRAL documentation before production launch.
* Keep FBR submission logic isolated behind an adapter so sandbox, production, and future API changes can be handled without rewriting checkout logic.
* Use database transactions for invoice creation, payment recording, inventory updates, and initial FBR queue creation.
* Use structured logs and metrics for checkout failures, FBR latency, queue depth, sync failure rates, and pending compliance alerts.
* Add automated tests for tax calculation, split payment validation, offline queue retry, idempotency, RBAC restrictions, and return/credit note workflows.
