# Orders V4 kernel governance

Orders V4 is an independent operational domain. It does not read from or write
to legacy Orders tables. Legacy data migration is a
separate, explicit operation and is not part of normal V4 runtime behavior.

## Authoritative boundaries

- `orders-v4-conversion.kernel.ts` resolves unit conversions.
- `orders-v4-calculation.kernel.ts` owns quantity, weighted cost, recipe use,
  stocktake, reversal, and negative-stock revaluation arithmetic.
- `orders-v4-ledger-posting.service.ts` is the only inventory-ledger writer.
- `orders-v4-funds.kernel.ts` owns custody and imported-cash arithmetic.
- `orders-v4-funds-posting.service.ts` is the only custody-ledger writer.
- `orders-v4-item-definition.service.ts` is the only public atomic path for
  item units, conversion chain, order packaging, prices, and display stock unit.

Boundary tests fail the build if another V4 source file writes directly to an
inventory or custody ledger.

## Unit invariant

Every item has two deliberately different unit concepts:

- `kernelUnitId`: immutable from item creation and used by documents, recipes,
  price normalization, stocktakes, and inventory ledger balances.
- `inventoryUnitId`: editable display unit used in the inventory user interface.

Changing the display unit never rebases historical ledger quantities. The
database rejects changes to the kernel unit. The active conversion definition
must keep every configured unit connected to the kernel unit.

## Negative inventory policy

Operational registration is allowed to make inventory negative. An issue uses
the current weighted cost, or the recipe's last-five purchase cost when there is
no current cost. Before the next receipt, a negative balance is revalued at the
incoming receipt unit cost. The receipt is then posted normally. This preserves:

`quantityAfter = previousQuantity + quantityDelta`

`valueAfter = previousValue + valueDelta`

and prevents an artificial average cost when a receipt crosses zero.

## Recipe cost policy

- Recipe components must be active purchased items.
- A component may appear only once in a recipe version.
- Registration is blocked if a recipe component has no received purchase price.
- Cost is the simple average of the latest five distinct received purchase
  documents after every price is normalized to the component kernel unit.
- The selected conversion and calculated cost are snapshotted on the document.

## Funds policy

- Custody may become negative.
- Funding, purchase, and reversal are append-only movements calculated by the
  funds kernel and posted by the funds posting service.
- Cash is imported read-only from cash sales; V4 never mutates the sales system.
- Cash availability at receipt date excludes V4 cash purchases dated later.
- Transfer remains a tagged payment method until an external transfer source is
  explicitly defined by the business.

## Operational quality gate

The data-quality endpoint validates active unit connectivity, immutable kernel
unit use, recipe component type and price readiness, inventory ledger sequence,
custody ledger sequence, and document-to-line operational cost reconciliation.
The inventory balance query reads only the latest ledger entry for each
item/location pair and converts it to the selected display unit for presentation.

## Migration readiness

The future legacy migration must map each imported item to one immutable kernel
unit before importing documents or balances. It must use the same posting and
versioning boundaries or an equivalent audited bulk-import transaction. Source
and destination counts, totals, balances, unit paths, recipe costs, custody, and
cash classifications must be reconciled before any legacy module is removed.
