# Delivery Batching Policy

Date: 2026-07-03

Status: active operating rule.

## Why This Exists

The UI unification work proved that very small PRs are safe but slow. Noorix production work should now favor larger scoped batches, fewer PRs, and fewer live deploys.

## Rule

| Principle | Policy |
|---|---|
| Batch size | group related work into one meaningful phase |
| PR count | one PR per phase whenever safe |
| Deploy count | one live deploy at the end of a runtime batch |
| Docs-only changes | bundle with next batch; do not deploy alone |
| Scope control | do not open adjacent work after a phase closes |
| Verification | run checks that match the actual change |
| Reporting | final report must list scope, files, checks, and remaining phases |

## Phase Definition Required Before Work

Each phase must define:

| Field | Meaning |
|---|---|
| Objective | what will be finished |
| Included | files/types of changes allowed |
| Excluded | protected files or out-of-scope work |
| Checks | exact commands or CI checks |
| Publish decision | deploy now, bundle later, or no deploy |

## Safe Exceptions

| Exception | Allowed Why |
|---|---|
| production outage | speed matters more than batching |
| failing CI blocker | unblock the pipeline |
| security or data-risk fix | narrow change is safer |
| user explicitly asks for immediate publish | user priority wins |

## Current Application To UI Work

| Area | Decision |
|---|---|
| PrintTable | next large phase, not tiny PRs |
| MatrixTable | separate large phase after RFC |
| SmartTable v2 | RFC/compatibility pilot phase only, not mixed with cleanup |
| CSS reduction | batch by section, not one helper at a time |
| Docs/governance | bundle unless CI requires the rule immediately |

## Acceptance

This policy is accepted when future work uses:

```txt
one planned phase
one implementation batch
one verification pass
one PR
one deploy only if runtime changed
```

