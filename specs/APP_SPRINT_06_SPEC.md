# Sprint A6 — SOAP Note Review + Edit + Additional Notes

## Goal
The note review screen is fully usable on mobile. Doctors can read the AI-generated SOAP note, edit any field inline, add free-text additional notes, and finalize — all on a phone screen.

## Scope

### 1. `NoteReview.jsx` mobile layout
- Sections (Subjective, Objective, Assessment, Plan) as collapsible accordions
- Tap section header → expands inline textarea
- Keyboard-aware scrolling (view scrolls up when keyboard opens)
- `@capacitor/keyboard` `keyboardWillShow` event → adjust scroll offset

### 2. Additional Notes field (Sprint 13 web feature — port to mobile)
- Free-text area at the bottom of the note
- Label: "Doctor's Additional Notes"
- Autosaves on blur (same PATCH endpoint already built)
- Placeholder: "Add anything the AI missed..."

### 3. Finalize button
- Sticky at bottom above safe area
- Confirm dialog: "Finalize note? This locks the note for editing."
- On confirm: POST /api/notes/{id}/finalize → navigate to PDF options

### 4. Quick edit mode
- Tap any SOAP section text → inline edit
- No modal — edit in place
- Auto-save after 1s debounce (same PATCH endpoint)

### 5. Note status badge
- Draft → yellow pill
- Finalized → green pill
- Shown in header next to patient name

### 6. Keyboard handling
- `ScrollView` equivalent: main content in a scrollable container
- When keyboard opens, focused input stays visible
- "Done" toolbar above keyboard to dismiss

## Out of Scope
- Voice dictation for additional notes
- Multi-language note editing

## Done When
- [ ] All SOAP sections readable on 360px screen
- [ ] Tap to edit works, changes persist via PATCH
- [ ] Additional notes field saves correctly
- [ ] Finalize flow works end-to-end
- [ ] Keyboard does not cover active input field
