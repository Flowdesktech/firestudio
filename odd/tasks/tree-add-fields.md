# Feature: Add fields from Tree view — type-aware

- **Feature id**: `tree-add-fields`
- **Branch**: `feat/add-fields` (already checked out, base `34923d6`)
- **Scope**: Documento + Maps anidados (user choice 2026-09-22). No Array indices.
- **Status**: implemented + verified; native review ESCALATED (terminal stop, see below)

## Objective

Permitir agregar fields en Tree view especificando el tipo de valor, de forma intuitiva y alineada a la convención del proyecto.

## Why

JSON permite agregar pero no es intuitivo; Table solo edita top-level. Tree modela cada field anidado con path `docId.field.nested`.

## Conventions to reuse (English artifacts)

- Types: `getValueType` in `src/shared/utils/firestoreUtils.ts` → String, Integer, Number, Boolean, Null, Timestamp, GeoPoint, Array, Map (+ Reference as string passthrough).
- Colors: `getTypeColor(type, isDark)`.
- Dialogs: MUI `Dialog/Title/Content/Actions` like `AddDocumentDialog.tsx` + `EditDialog.tsx` (Ctrl+Enter to save, `MONOSPACE_FONT_FAMILY`, Type badge).
- Date input: `datetime-local` like `TreeNodeRow.tsx:144` + `DatePopover.tsx`, helpers in `dateUtils.ts` (`formatDateForDateTimeLocal`, `isIsoDateString`).
- Tree plumbing: `TreeContext.ts` + `TreeNodeRow.tsx` + `TreeView.tsx` + handlers in `CollectionTab.tsx` (`onCellEdit/onCellSave`, `updateDocument` thunk in `collectionSlice.ts`).
- Service: `documentService.ts` (`transformValueForSave`, `prepareUpdateData` top-level only) — add nested-path variant.

## Tasks

- [x] TD-1 `AddFieldDialog` type-aware component (`src/features/collections/components/tree/AddFieldDialog.tsx`): props `open, parentPathLabel, existingKeys, onClose, onSubmit(fieldName, value)`; field-name TextField with duplicate/empty validation; MUI Select of types String,Integer,Number,Boolean,Null,Timestamp,GeoPoint,Array,Map,Reference; per-type input (TextField / number / Select True-False / datetime-local / lat,lng / JSON multiline for Array,Map with JSON.parse + error / Reference string); default values per type; Ctrl+Enter saves. Reuse `MONOSPACE_FONT_FAMILY`, Type badge style from EditDialog.
- [x] TD-2 Nested add plumbing: `documentService.prepareAddData(docDataRecord, parentPath, fieldName, value)` (dot-path set, reject duplicates/empty, no Array indices); `TreeContext` += `onAddField(docId, parentPath, docData, docCollectionPath)`; `CollectionTab` implements it (opens dialog, on submit builds new data, dispatches `updateDocument`, refreshes, shows message); `TreeView` forwards through context; `TreeNodeRow` shows hover `Add` IconButton (AddIcon) on Document rows and Map rows → calls `onAddField` with nested path.
- [x] TD-3 Verification: `pnpm typecheck` clean, `pnpm test` 12 files / 89 passed, scoped lint + format clean (writer + parent spot-check 2026-09-22). TDD off (no sdd-init capabilities on file).

## Acceptance

- Expand doc or Map → hover reveals Add action → dialog pide nombre + tipo + valor adaptado → Save crea el field y refresca el tree.
- Nombre vacío/duplicado/puntos bloquea con helper error; JSON inválido y fecha inválida bloquean; Timestamp persiste como `{_seconds,_nanoseconds}` vía helpers existentes.
- Array indices never offer Add (consistent with delete rule).

## Verification evidence

- TD-1 (commit 3623546): `pnpm typecheck` clean; `pnpm test` 12 files / 89 tests passed; scoped lint + prettier check on AddFieldDialog clean.
- TD-2 (commit a22afac): `pnpm typecheck` clean; `pnpm test` 12 files / 89 tests passed; scoped lint + prettier check on CollectionTab, TreeView, TreeNodeRow, TreeContext, documentService clean.
- Correction `faac5e2` (R3-002 parentPath fallback, R3-003 structuredClone): typecheck/test/scoped lint+format clean.
- R3-001 fix `0207f8b` (timestamp invalid-date guard): typecheck/test/scoped lint+format clean.

## Native review (RDD on, global) — ESCALATED, terminal

- Assess on slice (`--base-ref 34923d6 --committed-only`): `risk: medium` (`executable_change` in CollectionTab), 566 changed lines.
- Lineage `review-55ef78428f190c9d`, one lens `review-reliability`. Reviewer: 3 findings (R3-001 BLOCKER timestamp NaN, R3-002/R3-003 CRITICAL). Refuter corroborated.
- Bounded correction `faac5e2` fixed R3-002 + R3-003 only. Validator rejected: R3-001 unaddressed → state `escalated`, then terminal `stop/native_stop_required`.
- R3-001 fixed afterwards as ordinary work (`0207f8b`), outside the review transaction. Review outcome stays informational only — push/PR/merge remain user decisions under ordinary repository policy.

## Next step

- Delivery decision owned by the user: push / open PR / merge (slice is ~590 lines, over the 400-line budget — needs `size:exception` or split per repo policy).
