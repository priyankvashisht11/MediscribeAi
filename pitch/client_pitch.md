# MediScribe — Client Pitch

## The Problem We Solve

Doctors in India spend **30–40% of their consultation time** writing notes.
That is time stolen from patients.
A busy GP seeing 40 patients a day writes the same things 40 times —
chief complaint, vitals, assessment, plan, ICD code.
By hand. Every single time.

**Result:** Burnout. Rushed notes. Missed details. Billing errors.

---

## What MediScribe Does

MediScribe is an **ambient AI medical scribe** that listens to the doctor-patient
conversation in real time and automatically produces a structured clinical note —
ready to sign, print, or export as PDF — before the patient leaves the room.

No typing. No dictation. No template filling.
Just talk. We handle the rest.

---

## How It Works — 3 Steps

**Step 1 — Start a Session**
Doctor opens MediScribe on any device (phone, tablet, laptop).
Selects patient name and taps Record.

**Step 2 — Consult Normally**
The doctor conducts the consultation as usual.
MediScribe listens, transcribes, and separates doctor vs. patient voice in real time.

**Step 3 — Review & Sign**
At the end of the consult, a complete SOAP note appears:
- Chief Complaint
- Subjective (with History of Present Illness)
- Objective (vitals, examination findings)
- Assessment (diagnosis)
- Plan (medications, tests, follow-up)
- ICD-10 Codes (for billing and insurance)

One click to export as a clinic-branded PDF. One click to finalize and sign.

---

## Technology Stack (Why It's Better Than Alternatives)

| What | How |
|------|-----|
| Transcription | Deepgram Nova-3 — trained on medical vocabulary, works in Indian English, handles accents |
| SOAP Generation | Perplexity sonar-reasoning-pro — medical reasoning model, not a generic chatbot |
| Speaker Separation | Built-in diarization — knows who is the doctor and who is the patient |
| Data Residency | All infrastructure in Mumbai (ap-south-1) — data stays in India |
| Security | HTTPS everywhere, no audio stored after transcription |

---

## Who This Is For

**Primary Target**
- Solo practitioners and small clinics (1–10 doctors)
- OPD departments in mid-size hospitals
- Telehealth / video consult providers

**Specialties with highest ROI**
- General Physicians (high volume, repetitive notes)
- Pediatrics (parents talk a lot — hard to capture manually)
- Psychiatry (long sessions, nuanced documentation)
- Dermatology (structured findings, needs ICD codes for insurance)

---

## The Numbers

A GP seeing 40 patients/day spends ~4 minutes per note = **160 minutes/day** on documentation.
MediScribe reduces that to under 30 seconds per note (review + sign).
**Time saved: 2.5 hours per doctor per day.**

At a conservative billing rate of ₹500/hour, that is ₹1,250/day saved per doctor.
MediScribe's target price: ₹2,999/month per doctor.
**ROI: Positive in under 3 days of use.**

---

## Current Status

MediScribe is live in production today at:
**https://mediscribe-ai-eight.vercel.app**

Fully functional:
- Real-time transcription ✓
- SOAP note generation ✓
- ICD-10 code suggestions ✓
- PDF export with clinic branding ✓
- Session history and doctor profiles ✓
- Works on any device, any browser ✓

---

## What We Are Looking For

We are in the **design partner / early adopter** stage.
We are looking for 3–5 clinics willing to:
1. Use MediScribe for a free 30-day pilot
2. Give structured feedback (one 30-min call per week)
3. Co-design features specific to their specialty

In exchange:
- Free access for 12 months post-launch
- Named as a founding partner clinic
- Direct line to the product team

---

## Contact

Priyank Vashisht
pvashisht@thelcfgroup.com

Live demo: https://mediscribe-ai-eight.vercel.app
