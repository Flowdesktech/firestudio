# Feature: Add fields from Tree view — type-aware

- **Feature id**: `tree-add-fields`
- **Branch**: `feat/add-fields` (already checked out, base `34923d6`)
- **Scope**: Documento + Maps anidados (user choice 2026-09-22). No Array indices.
- **Status**: in_progress

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
- [ ] TD-3 Verification: `pnpm typecheck`, `pnpm test`, `pnpm lint` (changed files), `pnpm format:check`; record per-task tier/outcome. TDD mode: off (no sdd-init capabilities found, no runner configured) → ordinary functional checks.

## Acceptance

- Expand doc or Map → hover reveals Add action → dialog pide nombre + tipo + valor adaptado → Save crea el field y refresca el tree.
- Nombre vacío/duplicado bloquea con helper error; JSON inválido bloquea; Timestamp persiste como `{_seconds,_nanoseconds}` vía helpers existentes.
- Array indices never offer Add (consistent with delete rule).

## Verification evidence

- TD-1 (commit 3623546): `pnpm typecheck` clean; `pnpm test` 12 files / 89 tests passed; scoped lint + prettier check on AddFieldDialog clean.
- TD-3 / TD-2 checks: `pnpm typecheck` clean; `pnpm test` 12 files / 89 tests passed; scoped lint + prettier check on CollectionTab, TreeView, TreeNodeRow, TreeContext, documentService, AddFieldDialog clean.

## Next step

- Implement TD-1 → TD-2 → TD-3 in order; one work-unit commit per task.
