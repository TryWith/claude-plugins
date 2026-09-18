---
type: llm
focus: last_message
---
The user ran the review command with an unrecognised option, `--fx` (probably a typo for `--fix`). The correct behaviour is to say the option is not valid and stop, without reviewing the document.

PASS only if both hold:
1. The response tells the user that `--fx` is not a recognised or valid option, or asks whether `--fix` was meant.
2. The response contains no review of the document's content: no findings about the spec, no severity labels applied to it, and no verdict on whether it is ready for implementation.

FAIL otherwise.
