# Manual candidate mapping result

All **297** raw backgrounds were visually reviewed and assigned to checklist slots.

- Primary candidates for previously missing slots: 247
- Duplicates/collisions for those slots: 32
- Duplicates of already verified canonical slots: 18
- Effective checklist coverage: 193 verified + 247 manually mapped = 440 of 480
- Still missing after manual mapping: 40
- Confidence: 168 high, 3 medium, 126 low

The mapping is best-effort visual identification. It does not recreate lost provenance. Low-confidence generic skylines should be reviewed before production use.

Files:

- `manual-raw-to-checklist-mapping.csv`: all 297 assignments, statuses, confidence, evidence, hashes, and repository asset paths.
- `manual-mapping-by-slot.md`: primary and duplicate candidates grouped under each checklist slot.
- `checklist-001-480.csv`: complete updated 480-slot checklist.

Runtime assets and lookup metadata live one directory above. The repository root contains the only user-facing checklist: `STILL_MISSING_BACKGROUNDS_CHECKLIST.md`.
