# Coach Tay Recruiting Knowledge Base

Source-backed knowledge base of Coach Tay's recruiting methodology for **She's Next Recruits**.
Phase 1 only: extraction and organization. No application, UI, data integrations, matching logic, or invented benchmarks.

## Files

| File | Purpose |
|---|---|
| `coach-tay-methodology.md` | Overall philosophy, core principles, terminology, common mistakes |
| `athlete-evaluation.md` | How she evaluates prospects: coach criteria, athleticism, size/position, stats, competition level, film |
| `college-fit-framework.md` | Division pathways, academics, school research and selection, realistic-fit logic |
| `recruiting-timeline.md` | Grade-specific guidance (8th–12th, plus post-grad if covered) |
| `recruiting-strategies.md` | Outreach, communication, film, exposure, parent involvement |
| `source-index.md` | Every analyzed material, its ID, and what it contributed |
| `questions-for-coach-tay.md` | Gaps, ambiguities, contradictions, and items to verify |

## Conventions (apply in every file)

### Source IDs
Each material gets an ID in `source-index.md` when received. IDs follow the course's own structure:
- `M1.L1`: Module 1, Lesson 1 (video or text lesson)
- `M2.W1`: a worksheet in Module 2 · `M2.F1`: a figure or graphic in Module 2
- `M2.G9`: a Module 2 grade tab video (e.g. 9th grade)
- `R01`, `R02`, ...: a video or resource whose title doesn't state a module number. Its module placement goes in `source-index.md` once known.

- `-T` suffix: a written lesson text (e.g. `R02-T` = written version of the R02 lesson; `LEVEL-T` = a text with no matching video). `-F` suffix: a figure/graphic transcribed from an image (e.g. `SIZECHART-F`).

Cite location as precisely as the material allows: `[M1.L1 @01:23]`, `[M2.W1 p.1]`.

### Raw sources
Full transcripts and text of every material are saved in `sources/` so any citation can be checked against the original wording. Auto-generated captions are stored unedited. Where the audio was unclear, the entry says so instead of guessing.

### Principle IDs
Each extracted principle gets a stable ID so later files and the future tool can reference it:
`MTH-###` methodology · `EVAL-###` evaluation · `FIT-###` college fit · `TL-###` timeline · `STR-###` strategies · `Q-###` questions.
IDs are never reused or renumbered. Superseded entries are marked, not deleted.

### Evidence labels (required on every entry)
- **EXPLICIT**: Coach Tay states this directly. Quote her wording where possible.
- **INTERPRETATION**: A reasonable reading of her teaching. Never presented as a quote or a rule.
- **MISSING**: Something the materials don't answer. It also gets a matching entry in `questions-for-coach-tay.md`.

### Flags
- ⚠️ **VERIFY**: Depends on NCAA/NAIA/NJCAA rules, contact periods, eligibility standards, or other policies that can change. Note the date of the source material if known.
- ⚔️ **CONFLICT**: Contradicts or sits in tension with another entry. Both entries stay, and both are logged in `questions-for-coach-tay.md`. Nothing gets resolved silently.

### Entry template
```
#### EVAL-001 · Short principle title
- **Label:** EXPLICIT | INTERPRETATION | MISSING
- **Principle:** What she teaches, in her terminology.
- **Her words:** "Direct quote" (EXPLICIT only)
- **Applies to:** Athlete profiles this affects (grade, position, size, level, academic profile).
- **How it could inform school research:** (only if the material supports it)
- **Source:** [M01 §2]
- **Flags:** ⚠️ VERIFY (reason) / ⚔️ CONFLICT with XXX-### / none
```
