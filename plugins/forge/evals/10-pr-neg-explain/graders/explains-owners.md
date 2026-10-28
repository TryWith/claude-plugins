---
type: llm
focus: last_message
---
The user asked what the owner categories A, B and C of `/forge:review-pr` mean.

PASS if the response explains them in substance: A is what an AI can verify itself (with the human only spot-checking the evidence), B is what a human must decide (accepting a spec or a risk), and C is what only a human or the author can verify (real devices, external consoles, production, visual judgement). Wording may differ.

FAIL if the response starts a pull-request review instead, or gives a materially different meaning for any of the three.
