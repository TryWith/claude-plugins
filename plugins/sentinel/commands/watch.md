---
description: Watch the current PR every 5 minutes and auto-fix until CI and reviews are all green.
---

# /sentinel:watch

## Language setup

Execute the contents of `_lib/lang-preamble.md`.

## Main loop

Execute the contents of `_lib/watch-pr.md`. See that file for interval, exit condition, and watched targets.

## After completion

Execute `_lib/notify.md` to send the notification.

## Prerequisite

A PR matching the current branch must already exist.
If it does not, prefer running `/sentinel:finalize` instead.
