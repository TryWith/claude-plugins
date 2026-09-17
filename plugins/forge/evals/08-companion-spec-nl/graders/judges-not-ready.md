---
type: llm
focus: last_message
---
The document under review has defects that make it not ready to implement, so the correct conclusion is "not ready".

PASS only if all of the following hold:
1. The response states a conclusion about whether the document is ready for implementation (for example a `NOT READY` verdict, "not ready to implement", 「実装に進めない」, 「このままでは実装に入れない」).
2. That conclusion is that the document is NOT ready.
3. Nowhere does the response say or imply that the document is ready to implement as written (a `READY` verdict that is not `NOT READY`, "ready to implement", 「このまま実装に進めてよい」).

FAIL if the response gives no conclusion, concludes the document is ready, or does not review the document at all (for example it only reports an error or an unknown command).
