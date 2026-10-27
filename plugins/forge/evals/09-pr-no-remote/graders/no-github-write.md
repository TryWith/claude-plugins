---
type: regex
target: trace
match: "count:0"
---
gh\s+(pr\s+(review|comment|merge|edit|close|create)|issue\s+(comment|edit|close|create)|api\b[^\n]*(-X|--method)\s*(POST|PATCH|PUT|DELETE))
