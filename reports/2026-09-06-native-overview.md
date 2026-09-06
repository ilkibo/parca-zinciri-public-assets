# Native supplier overview: server data only

## Scope

The active `/tedarikci` native-slot host initialized the overview with sample
Marmara company data, old TLP/TKL records and hard-coded 5/3/8/12 counters.
The authenticated browser reproduced this even while the notification/inventory
server reads worked. This was not a homepage or authentication-policy change.

## Change

- Overview and account header no longer read legacy profile/RFQ/activity seeds.
- The already verified `getMobileInventory` page bridge loads on authenticated
  entry and overview refresh. All pages are accumulated before displaying counts.
- Four counters explicitly mean total, pending, approved and rejected **products**.
- RFQ/offer/order summary states that its live integration is incomplete, instead
  of displaying example numbers or claiming zero transactions.
- Unknown/loading/error uses dashes, not false zero counts. Errors offer retry.
- Company label uses current server response/context or a neutral placeholder.
- Company/role scope and session epoch reject stale success/failure responses on
  account change, logout and disconnect. Reconnect reloads using existing bridge.
- Inventory response cannot re-render unrelated forms and discard their drafts.
- No homepage, backend, credentials, authorization, CMS or real record mutation.

## Checks

- `node --check parca-zinciri-supplier-portal-native-slot.js`: PASS.
- `node --test tests/native-overview.test.mjs`: 11 PASS, 0 fail.
  Local isolated browser fixture covers legacy identity exclusion, pagination,
  escaped identity, error/malformed/invalid-cursor behavior, retry/empty,
  old-company success, old-session failure, draft/focus preservation, reconnect
  and 390px horizontal layout.
- Existing native notifications fixture: 11 checks PASS, zero browser errors.
  Its menu locator was narrowed to `.nav` because overview now also includes a
  valid quick-access notifications button. No application behavior was bypassed.
- `git diff --check`: PASS (only Windows LF/CRLF normalization warning).

## Verification boundary

Before this change, the actual authenticated Chrome session verified matching
request/response IDs with `ok: true` for `getSupplierNotifications` (0 items) and
`getMobileInventory` (4 QA products). Those checks establish the underlying read
path, not a live authenticated check of this new overview bundle.

The new overview marker is `data-pz-overview-version="server-inventory-1"`.
Deployment and new-bundle authenticated verification are tracked separately.
Other legacy portal routes are outside this narrowly scoped overview change;
this report does not claim whole-portal completeness or RFQ/sales integration.
