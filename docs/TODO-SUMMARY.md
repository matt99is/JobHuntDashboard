# TODO Summary

This document lists all documented TODOs in the codebase. These are intentional markers for future improvements, not bugs or incomplete work.

## How to Find TODOs

Search the codebase for TODO comments:
```bash
# Find all TODOs in JavaScript files
grep -r "TODO:" scripts/

# Find TODOs in specific categories
grep -r "TODO: \[MISSING\]" scripts/
grep -r "TODO: \[REFACTOR\]" scripts/
grep -r "TODO: \[TEST\]" scripts/
```

## Current TODOs

### scripts/merge-research.js

#### [MISSING] Stdin reading for piped research results
**Location:** `scripts/merge-research.js:137`

**Description:** Currently, research results must be passed via `--results=file.json` argument or placed in default location. Future enhancement would allow piping results directly:

```bash
echo '[{...}]' | npm run merge:research
```

**Priority:** Low (file-based approach works fine)

**Implementation Notes:**
- Add stdin detection check
- Read from process.stdin when no --results argument
- Accumulate data chunks before JSON parsing
- Fallback to existing file-based approach if stdin empty

---

#### [REFACTOR] Auto-run sync after merge
**Location:** `scripts/merge-research.js:383`

**Description:** Add optional `--auto` flag to automatically run sync after merging research results:

```bash
npm run merge:research -- --results=... --auto
```

**Priority:** Low (users may want to review merged data before sync)

**Implementation Notes:**
- Add `--auto` flag to argument parser
- Import/require sync-jobs.js functions
- Call sync after merge completes successfully
- Skip if errors occurred during merge
- Consider adding confirmation prompt for safety

**Tradeoffs:**
- Convenience vs control (users lose ability to review before sync)
- Potential for accidental database updates
- May want `--dry-run` flag as well for safety

---

## Completed TODOs

None yet. TODOs should be removed from code when completed and documented here for historical reference.

---

## TODO Categories Explained

- **[MISSING]** - Feature not yet implemented (intentional gap)
- **[REFACTOR]** - Code works but could be improved for maintainability/performance
- **[TEST]** - Needs test coverage or additional testing
- **[DEFERRED]** - Intentionally postponed until after initial release

## Adding New TODOs

When adding TODOs, follow this format:

```javascript
// TODO: [CATEGORY] Brief description of what needs to be done
// Optional: More detailed explanation or context
// Optional: Links to related issues or documentation
```

**Good TODO:**
```javascript
// TODO: [REFACTOR] Extract validation logic into separate function
// This validation is duplicated in 3 places. DRY principle suggests
// moving to a shared validator module.
```

**Bad TODO:**
```javascript
// TODO: fix this
```

---

**Last Updated:** 2026-01-18 (v1.1.0)
