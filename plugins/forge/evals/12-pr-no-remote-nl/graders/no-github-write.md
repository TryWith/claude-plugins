---
type: regex
target: trace
match: "count:0"
---
gh\s+(pr\s+(review|comment|merge|edit|close|create|ready|reopen)|issue\s+(comment|edit|close|create|reopen|delete)|api\s+graphql\b[^\n]*\bmutation\b|api\b(?!\s+graphql\b)(?![^\n]*(-X|--method)[\s=]*GET\b)[^\n]*\s(-X\s*|--method[\s=]+)(POST|PATCH|PUT|DELETE)\b|api\b(?!\s+graphql\b)(?![^\n]*(-X|--method)[\s=]*GET\b)[^\n]*\s(-f|-F|--field|--raw-field|--input)[\s=])
