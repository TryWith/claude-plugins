# Step 5: Re-review when the head moves

Goal: keep the package true for the commit that will be merged.

## 5.1 Detect

Compare the current head SHA with the SHA recorded in the package. Do this
at the start of any follow-up turn about the PR and always before
submitting a drafted review. Also read reviews and comments posted since
the last run — the author's replies may close questions.

## 5.2 Assess the delta

- `git diff <old-sha> <new-sha>`: summarise by area. Large squashed
  additions can widen the PR's scope (new closing issues, other apps,
  schema or data-format changes); read the PR body and the newly linked
  issues again.
- For every checklist item, decide: unaffected, needs re-check, or
  invalidated. Look for: changed files under an item's "Where", renamed
  identifiers or codes, new migrations or one-time rebuild instructions,
  changed contracts (status codes, accepted values), and claims in the old
  package or draft that are now false.
- Add items for new behaviour; keep old numbers.

## 5.3 Re-verify

Fetch again with the Step 1.1 command — its `+` lets a force-pushed head
replace the old `pr/<n>` — and confirm `pr/<n>` is the new head SHA before
anything else. Move the verification worktree to the new head, follow any
rebuild notes the delta adds (show them to the user first, as in Step
3.1), re-run E2E and the affected checks, and update the Status
column with the new SHA prefix. Keep earlier human results but mark which
SHA they were done at; ask the human to redo a hands-on check only when
the delta touches it.

## 5.4 Update the files

Update the package and the draft in place, change the header SHA, and tell
the user in the chat what changed in the conclusions — in particular any
statement in a previously confirmed draft that is no longer true.
