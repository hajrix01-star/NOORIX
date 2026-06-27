# HR Accounting Source Rules

## No Fallback Rule

- HR financial screens and documents must not recompute a replacement number when the central snapshot/API is missing or failed.
- The only allowed behavior is loading or error state; never display a locally derived fallback amount.
- Employee-profile documents must use `compensationSnapshot`; do not add `customAllowances` or manual salary, advance, or payroll props back to that path.
- Annual leave salary settlements must use `HrCompensationSnapshotService` for the monthly salary package. Settlement preview/issue paths must not sum employee allowances locally.
- Payroll run create/update paths must validate employee gross salary against `HrCompensationSnapshotService`; a frontend or script must not be able to persist a non-central salary gross amount.
- HR dashboard monthly payroll totals must sum `HrCompensationSnapshotService` salary package totals only; do not rebuild employee salary totals from raw allowance fields in dashboard/BFF code.
- Salary raise creation must be a backend transaction: read the central compensation snapshot, update employee basic salary, and create the movement record together. Frontend code must not update salary and then record the movement as separate requests.
- Any new HR calculation path must use the central engine/snapshot and include a regression test proving there is no fallback.

## Source Of Truth

- Database rows are the source of data.
- HR central calculation utilities and the backend compensation snapshot are the source of accounting results.
- Issued HR financial records should keep an audit marker for the central snapshot/calculation used at issuance when the schema does not yet have a dedicated immutable snapshot column.
- React components are display consumers only; they may format numbers but must not recreate salary, advance, payroll, EOS, or settlement formulas.
