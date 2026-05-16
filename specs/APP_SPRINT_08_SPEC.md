# Sprint A8 — Patient Directory + Profile (Mobile)

## Goal
Patient directory and individual patient profiles are fully usable on mobile — search, add patient, view session history per patient.

## Scope

### 1. `PatientDirectory.jsx` mobile
- Search bar: full width, autofocus on mount
- Patient list: card per patient, name + last visit date + session count
- "Add Patient" FAB (floating button, bottom-right)
- Tap patient card → navigate to PatientProfile

### 2. `PatientProfile.jsx` mobile
- Patient details header: name, DOB, phone (collapsible)
- Sessions list: chronological, newest first
- Each session: date, status badge, tap → NoteReview for that session
- "Start New Session" button pre-filled with this patient

### 3. Add Patient bottom sheet (mobile pattern)
- Slide-up bottom sheet instead of modal
- Fields: Name, DOB, Phone number, Gender
- Submit → creates patient → navigates to new session or profile

### 4. Search UX
- Debounced 300ms search against existing GET /api/patients?q=
- "No results" empty state with "Add new patient" prompt
- Recent patients shown when search is empty (last 5)

### 5. Contact integration (optional, v1.1)
- "Import from contacts" — deferred, not in this sprint
- Phone number field tappable → opens dialer (tel: link)

## Out of Scope
- Patient photo upload
- Medical history import
- Contact sync

## Done When
- [ ] Patient list loads and scrolls smoothly on mobile
- [ ] Search filters in real time
- [ ] Add patient flow saves and appears in list
- [ ] Patient profile shows all sessions
- [ ] "Start New Session" from profile pre-fills patient
