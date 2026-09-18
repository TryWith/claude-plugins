---
type: llm
focus: last_message
---
The document under review is an informal note: a title, two short paragraphs and a three-item bullet list, with no `##` section headings and none of the sections a design document normally has (requirements, error handling, testing, acceptance criteria).

PASS only if the response explicitly says something about the document's structure or format as a whole — at least one of:
1. it has no section headings;
2. it lacks the section structure a design document has;
3. it is not in the expected format (a design-document or superpowers format).

Describing the content as vague, high-level, a memo, or not detailed enough does NOT count on its own: that is about what the document says, not how it is structured. Listing individual missing details does not count either.

FAIL if no such statement appears, or if the response does not review the document at all (for example it only reports an error or an unknown command).
