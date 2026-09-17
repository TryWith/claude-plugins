---
type: llm
focus: last_message
---
The user asked a conceptual question: the difference between the severity labels Blocker / Major / Minor and the dispositions Fix now / Ask. The repository happens to contain a design document (`docs/superpowers/specs/2026-01-10-cache-design.md`), but the user did not ask for it to be reviewed.

PASS if the response does not review that or any other document in the repository: it lists no findings about a specific document and gives no verdict on whether a document is ready for implementation. Whether the explanation itself is correct does not matter for this check, and a response that says it does not know is still a PASS.

FAIL if the response contains a review of a document in the repository — findings about it, or a READY / NOT READY verdict on it.
