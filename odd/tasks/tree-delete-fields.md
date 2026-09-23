# Feature: Delete document fields from Tree view

- **Feature id**: `tree-delete-fields`
- **Repo locator**: `odd/tasks/tree-delete-fields.md`
- **Branch**: `feat/remove-fields`
- **First reviewed boundary**: `34923d6` (branch point)

## Objective

Let the user delete a field from a Firestore document directly in the Tree view, without having to hand-edit the document JSON.

## Problem

Today the only way to remove a field is the JSON editor. That works but it is not
intuitive: the user has to locate the key in a free-form blob and re-save the whole
document. Table view cannot host this either — `TableRow` only addresses top-level
keys (`doc.data?.[f]`) and collapses nested Maps/Arrays into one `JSON.stringify`
cell, so a nested key like `profile.displayName` is not addressable there. Tree view
already renders every field (including nested ones) as its own node with a path, so a
field is a first-class target for deletion there.

## Why

Tree is the only view where "a field of one document" is an unambiguous, addressable
node. Deleting there maps 1:1 onto the data model, and it covers nested fields that
table cannot even display as separate cells.

## Scope (authorized edit roots)

- `src/features/collections/**`
- `odd/tasks/tree-delete-fields.md` (this document)

Out of scope (do not touch):

- Table view delete affordance (possible follow-up, top-level fields only)
- JSON view changes
- Fixing the pre-existing nested **edit** limitation (see "Known pre-existing limitation")
- Array element deletion / splicing
- Electron IPC or auth-method changes — deletion reuses the existing `updateDocument` thunk

## Constraints

- Deletion must be explicit and confirmed: destructive and permanent. Never delete
  on a single stray click.
- Offer delete only for **field** nodes (top-level keys and Map keys). Never on
  Document or Collection nodes — those already have their own delete flows.
- Do **not** offer delete on Array _element_ nodes (index children). Deleting an
  array element is a splice, not a field removal.
- Nested Maps/Arrays are deletable **as a field** (i.e. removing `profile` or `tags`
  entirely).
- Persistence follows the existing pattern: `updateDocument` does a full
  `setDocument`/`googleSetDocument` with the document data object, so omitting a key
  removes it from Firestore. Do not introduce field-mask or `FieldValue.delete`
  plumbing.
- UI copy and code comments in English (project convention). No AI attribution in
  commits. Conventional Commits only.

## TDD

- **Mode**: `off`
- **Source**: no explicit project or session TDD configuration found
- **Runner**: `vitest` (`pnpm test`)

Ordinary functional checks apply. `prepareDeleteData` is a pure function and MUST
ship with unit tests covering nested and top-level paths.

## Delivery strategy

- **Strategy**: `exception-ok` (maintainer-approved `size:exception`)
- **Forecast at creation**: ~185 authored changed lines — under the 400-line budget
- **Actual running count** from boundary `34923d6`: **421** (411+/10-) — over budget
- **Breakdown**: `odd/tasks/tree-delete-fields.md` 188 (this planning document) +
  product code/tests 233
- **Per commit**: `9044a77` = 252, `12469d2` = 197 — both individually under 400
- **Chain strategy**: none — maintainer accepted `size:exception` for a single PR
  instead of a chained split (2026-09-22)
- **Slice boundaries**: one PR holding `9044a77` and `12469d2`

## Known pre-existing limitation (out of scope, follow-up candidate)

`TreeEditingCell.field` carries only the leaf `nodeKey`, so editing a nested field
today writes to the top level of the document. Nested **delete** must NOT inherit
this: it needs a document-relative field path. Fixing nested **edit** is a separate
change.

## Acceptance criteria

1. In Tree view, a field node (top-level or nested Map key) exposes a visible delete
   affordance on hover.
2. Activating it opens a confirmation that names the document id and the
   document-relative field path (e.g. `profile.displayName`). Cancel leaves data
   untouched.
3. Confirming removes exactly that key — and only that key — from the document in
   Firestore, for both `google` and service-account auth methods (via the existing
   `updateDocument` thunk).
4. Nested paths work: `profile.displayName` removes `displayName` from `profile` and
   leaves sibling keys intact; `profile` removes the whole map.
5. Document nodes and Collection nodes show no delete affordance. Array element
   nodes show none either.
6. `pnpm test`, `pnpm typecheck`, and `pnpm lint` all pass.

## Applicable checks

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`

## Tasks

### TD-1 — Field-path removal in `documentService` + unit tests

- [x] Add `prepareDeleteData(doc, fieldPath)` to
      `src/features/collections/services/documentService.ts`. - `fieldPath` is dot notation relative to `doc.data`
      (`displayName`, `profile`, `profile.displayName`). - Returns a **new** object with that key removed; never mutates the input. - Missing intermediate path, or a non-Map intermediate (array/primitive), is a
      no-op returning the data unchanged — do not throw. - Mirrors `prepareUpdateData` so the result can be passed straight to
      `updateDocument`.
- [x] Add `src/features/collections/services/documentService.test.ts` covering:
      top-level key, whole-map key, nested key, nested key under a missing parent
      (no-op), non-Map intermediate (no-op), input not mutated.
- [x] Checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`
- [x] Commit: `feat(collections): add field-path removal to document service`
- [x] Commit id: `9044a77`

### TD-2 — Tree view delete affordance + wiring

- [x] Thread a document-relative `fieldPath` through `TreeNodeRow` / `TreeContext`
      (root fields get the key; nested fields get `parent.field`). Do not change the
      existing `field`/`nodeKey` used by edit.
- [x] Add `onDeleteField(docId, fieldPath, docData, docCollectionPath)` to
      `TreeContextValue`, provided by `TreeView`.
- [x] In `TreeNodeRow`, show a small delete icon on hover for field nodes only:
      not `isDoc`, not `isCollection`, not array-element nodes. Keep the row dense;
      the icon must not shift layout when it appears.
- [x] Confirmation dialog naming the document id and the field path, with explicit
      Cancel / Delete actions. English copy.
- [x] Implement the handler in `CollectionTab`: `prepareDeleteData` then dispatch
      `updateDocument`, then refresh/notify via the existing message path.
- [x] Checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`
- [x] Commit: `feat(collections): allow deleting fields from documents in tree view`
- [x] Commit id: `12469d2`

## Authorized scope notes for implementer

Follow `work-unit-commits`: one commit per task above, tests and docs with the
behavior, Conventional Commit message, no `Co-Authored-By` or AI attribution.
Rollback boundary per commit is the files named in that task only.

## Progress

| Task | Status | Evidence         |
| ---- | ------ | ---------------- |
| TD-1 | done   | commit `9044a77` |
| TD-2 | done   | commit `12469d2` |

## Verification evidence

### TD-1 — commit `9044a77`

- `pnpm test`: 96 passed (13 files) — includes `documentService.test.ts`, 7 tests
- `pnpm typecheck`: clean, no output
- `pnpm lint` (scoped to changed files): `ESLint: No issues found`
- `pnpm lint` (full script): 1 pre-existing error in `firebaseController.js`
  (`no-unused-vars`). File is untouched by this change — known environmental
  failure, not introduced here.
- Runtime harness: N/A (Electron desktop UI; no runtime boundary exercised)

Rollback boundary TD-1: `src/features/collections/services/documentService.ts`,
`src/features/collections/services/documentService.test.ts`.

### TD-2

- `pnpm test`: 96 passed (13 files)
- `pnpm typecheck`: clean, no output
- `pnpm lint` (scoped to 4 changed files): `ESLint: No issues found`
- `pnpm lint` (full script): 1 pre-existing error in `firebaseController.js`
  (same known environmental failure as TD-1)
- Runtime harness: N/A (Electron desktop UI; no runtime boundary exercised)

Array-element vs Map-key distinction: `TreeNodeRow`'s nested recursion passes
`fieldPath` only when `!Array.isArray(value)`. Array children are index elements
and get no `fieldPath`, which is what disables their delete affordance. This
matches `prepareDeleteData`, whose non-Map-intermediate rule already rejects
`tags.0`-style paths.

Rollback boundary TD-2: `src/features/collections/components/CollectionTab.tsx`,
`src/features/collections/components/TreeView.tsx`,
`src/features/collections/components/tree/TreeContext.ts`,
`src/features/collections/components/tree/TreeNodeRow.tsx`.

## Next step

Run the deferred native review for the PR slice. Risk was assessed `medium`
(`executable_change` on the test file) and deferred to slice close; the feature is
complete, so the preflight STATUS runs now with `--base-ref 34923d6 --committed-only`.
