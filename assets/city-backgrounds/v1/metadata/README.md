# Background mapping and completion result

The city-specific checklist is now **480 of 480 complete**, and all **12 generic fallbacks** have been replaced by the final supplied set.

- Previously verified or manually mapped city slots: 440
- City slots supplied by the final completion archive: 40
- Current city coverage: 480 of 480
- Current generic coverage: 12 of 12
- Still missing: 0

## Historical manual review

All **297** raw backgrounds were visually reviewed and assigned to checklist slots.

- Primary candidates for previously missing slots: 247
- Duplicates/collisions for those slots: 32
- Duplicates of already verified canonical slots: 18
- Effective coverage at that stage: 193 verified + 247 manually mapped = 440 of 480
- Missing at that stage, before the final completion archive: 40
- Confidence: 168 high, 3 medium, 126 low

The mapping is best-effort visual identification. It does not recreate lost provenance. Low-confidence generic skylines should be reviewed before production use.

Files:

- `manual-raw-to-checklist-mapping.csv`: all 297 assignments, statuses, confidence, evidence, hashes, and repository asset paths.
- `manual-mapping-by-slot.md`: primary and duplicate candidates grouped under each checklist slot.
- `checklist-001-480.csv`: complete current 480-slot checklist, including the final 40 supplied backgrounds.

Runtime assets and lookup metadata live one directory above. The repository root contains the only user-facing checklist: `STILL_MISSING_BACKGROUNDS_CHECKLIST.md`, which now records zero remaining gaps.
