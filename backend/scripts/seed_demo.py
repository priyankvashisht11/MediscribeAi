#!/usr/bin/env python3
"""
seed_demo.py — Populate Chartr with realistic demo data:
  - 3 quick dashboard sessions (Ramesh Kumar, Sushma Devi, Aryan Sharma)
  - 1 longitudinal patient (Arjun Mehta, 48yo) with 5 visits + 3 documents
    to showcase Health Intelligence

Idempotent: running twice does not create duplicates.
"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime, timezone, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings
from app.models import Session as SessionModel, Transcript, ClinicalNote, NoteAuditLog
from app.models.patient import Patient
from app.models.patient_document import PatientDocument

# ─── Doctor UUIDs (must match _seed_mock_doctors in main.py) ─────────────────
DR_ANANYA  = UUID("00000000-0000-0000-0000-000000000001")  # General Physician
DR_RAJESH  = UUID("00000000-0000-0000-0000-000000000002")  # Pediatrics
DR_PRIYA   = UUID("00000000-0000-0000-0000-000000000003")  # Dermatology

# ─── Minimal valid PDF bytes for document placeholders ───────────────────────
PLACEHOLDER_PDF = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
    b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n"
    b"0000000058 00000 n \n0000000115 00000 n \n"
    b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n"
)

# ─── Demo session definitions (dashboard) ─────────────────────────────────────
DEMO_SESSIONS = [
    {
        "id": UUID("aaaaaaaa-0000-0000-0000-000000000001"),
        "doctor_id": DR_ANANYA,
        "patient_name": "Ramesh Kumar",
        "patient_age": 52,
        "patient_gender": "Male",
        "duration_seconds": 487,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=3),
        "transcript": [
            ("doctor",  "Good morning Mr. Ramesh, please sit down. What brings you in today?"),
            ("patient", "Doctor sahab, mujhe kaafi dino se sir dard ho raha hai, aur BP bhi high hai last check mein."),
            ("doctor",  "I see. How long has the headache been there?"),
            ("patient", "About two weeks. Mostly in the morning, back of the head."),
            ("doctor",  "Any nausea, vomiting, visual changes?"),
            ("patient", "No vomiting but sometimes blurred vision for a few minutes."),
            ("doctor",  "Are you on any medications currently?"),
            ("patient", "Haan, amlodipine 5mg le raha hoon, ek saal se."),
            ("doctor",  "Any family history of hypertension or heart disease?"),
            ("patient", "Father ko tha. 60 mein heart attack aaya tha unhe."),
            ("doctor",  "Let me check your BP. It's reading 158 over 96. That's elevated."),
            ("doctor",  "I'm going to increase the amlodipine to 10mg and add telmisartan 40mg."),
            ("doctor",  "I also want you to get an ECG and lipid profile done today."),
            ("patient", "Theek hai doctor. Kuch aur karna hai?"),
            ("doctor",  "Salt restriction, no more than 2 grams per day. Follow up in two weeks."),
            ("doctor",  "If you have severe headache or chest pain, come immediately to the emergency."),
        ],
        "note": {
            "chief_complaint": "Headache for 2 weeks, predominantly occipital, worse in the morning. Associated with occasional transient blurring of vision.",
            "history_of_present_illness": "52-year-old male presenting with 2-week history of occipital headache, worst in the mornings. Reports occasional blurring of vision lasting a few minutes. No nausea or vomiting. Previously diagnosed with hypertension, currently on amlodipine 5mg for 1 year.",
            "past_medical_history": "Hypertension (diagnosed approximately 1 year ago)",
            "medications": "Amlodipine 5mg once daily",
            "allergies": "Not documented in this consultation.",
            "review_of_systems": "Neurological: occipital headache, transient blurred vision. Cardiovascular: elevated BP. Gastrointestinal: no nausea/vomiting.",
            "subjective": "52-year-old male with known hypertension presenting with 2-week occipital headache and transient visual blurring on amlodipine 5mg. Father had MI at 60.",
            "objective": "Blood Pressure: 158/96 mmHg (elevated).",
            "physical_examination": "BP measured in clinic: 158/96 mmHg",
            "assessment": "1. Uncontrolled hypertension (I10)\n2. Hypertensive headache",
            "plan": "1. Amlodipine increased from 5mg to 10mg once daily\n2. Telmisartan 40mg once daily — new addition\n3. ECG (today)\n4. Fasting lipid profile (today)\n5. Salt restriction: maximum 2g per day\n6. Follow up in 2 weeks. Emergency if severe headache or chest pain.",
            "follow_up": "Review in 2 weeks. Emergency attendance if severe headache or chest pain.",
            "icd_codes": [
                {"code": "I10", "description": "Essential (primary) hypertension"},
                {"code": "G44.309", "description": "Post-traumatic headache, unspecified, not intractable"},
            ],
            "confidence_score": 0.91,
            "generated_by": "perplexity/r1-1776",
            "is_finalized": True,
        },
    },
    {
        "id": UUID("aaaaaaaa-0000-0000-0000-000000000002"),
        "doctor_id": DR_ANANYA,
        "patient_name": "Sushma Devi",
        "patient_age": 64,
        "patient_gender": "Female",
        "duration_seconds": 623,
        "created_at": datetime.now(timezone.utc) - timedelta(hours=1, minutes=30),
        "transcript": [
            ("doctor",  "Mrs. Sushma, good morning. I've reviewed your previous echo report. How are you feeling?"),
            ("patient", "Doctor, thoda breathlessness ho raha hai last 3-4 dino se. Seedhi nahi chal pa rahi."),
            ("doctor",  "How many steps before you get breathless?"),
            ("patient", "Ghar mein hi, 10-15 kadam mein ruk jaati hoon."),
            ("doctor",  "Any ankle swelling? Chest pain? Palpitations?"),
            ("patient", "Ankle thoda suja hua hai, haan. Chest pain nahi. Dil thoda tez lagta hai kabhi kabhi."),
            ("doctor",  "When did you last take your furosemide?"),
            ("patient", "Kal subah. Roz leta hoon."),
            ("doctor",  "Let me examine you. JVP is elevated. Bibasal crepitations on auscultation. Bilateral pitting ankle oedema 2+."),
            ("doctor",  "This looks like decompensated heart failure. I'm going to double the furosemide dose temporarily."),
            ("doctor",  "Furosemide 80mg once daily for 5 days, then back to 40mg."),
            ("patient", "Kuch aur?"),
            ("doctor",  "Salt restriction very strictly. Less than 1.5 grams per day. Fluid restriction — less than 1.5 litres."),
            ("doctor",  "I want a BNP, renal function test, electrolytes today. Echo repeat in 4 weeks."),
            ("doctor",  "Come back in 5 days. If breathlessness worsens or you cannot lie flat, go to emergency directly."),
        ],
        "note": {
            "chief_complaint": "Breathlessness on minimal exertion for 3-4 days. Unable to walk more than 10-15 steps without stopping.",
            "history_of_present_illness": "64-year-old female with known cardiac history presenting with progressive breathlessness over 3-4 days. Functional capacity severely reduced — symptomatic after 10-15 steps. Reports associated bilateral ankle swelling and intermittent palpitations. No chest pain. Currently on furosemide (last dose yesterday morning).",
            "past_medical_history": "Known cardiac disease (previous echo on file). On furosemide — consistent with heart failure management.",
            "medications": "Furosemide 40mg once daily",
            "allergies": "Not documented in this consultation.",
            "review_of_systems": "Respiratory: progressive dyspnoea on minimal exertion. Cardiovascular: palpitations, ankle oedema, elevated JVP. No chest pain.",
            "subjective": "64-year-old female with known cardiac disease presenting with decompensated heart failure — progressive dyspnoea, elevated JVP, bibasal crepitations, bilateral 2+ ankle oedema.",
            "objective": "JVP elevated. Bibasal crepitations on auscultation. Bilateral pitting ankle oedema 2+.",
            "physical_examination": "JVP elevated. Bibasal crepitations on auscultation. Bilateral pitting ankle oedema 2+.",
            "assessment": "1. Decompensated heart failure (I50.9)",
            "plan": "1. Furosemide increased to 80mg once daily for 5 days, then revert to 40mg once daily\n2. BNP (today)\n3. Renal function test (today)\n4. Serum electrolytes (today)\n5. Echocardiogram (repeat in 4 weeks)\n6. Salt restriction < 1.5g/day. Fluid restriction < 1.5L/day.\n7. Review in 5 days. Emergency if breathlessness worsens or cannot lie flat.",
            "follow_up": "Review in 5 days. Emergency attendance if breathlessness worsens or patient cannot lie flat.",
            "icd_codes": [
                {"code": "I50.9", "description": "Heart failure, unspecified"},
            ],
            "confidence_score": 0.88,
            "generated_by": "perplexity/r1-1776",
            "is_finalized": True,
        },
    },
    {
        "id": UUID("aaaaaaaa-0000-0000-0000-000000000003"),
        "doctor_id": DR_RAJESH,
        "patient_name": "Aryan Sharma",
        "patient_age": 7,
        "patient_gender": "Male",
        "duration_seconds": 312,
        "created_at": datetime.now(timezone.utc) - timedelta(minutes=25),
        "transcript": [
            ("doctor",  "Hello, please come in. So what's going on with little Aryan?"),
            ("patient", "Doctor, isko kal raat se bukhaar hai. 102 degree aaya tha."),
            ("doctor",  "Any cough, cold, runny nose?"),
            ("patient", "Haan thodi si naak beh rahi hai. Khaana nahi kha raha."),
            ("doctor",  "Any ear pain? Does he pull his ears?"),
            ("patient", "Nahi, kaan nahi pakda usne."),
            ("doctor",  "Let me have a look. Throat is red, mild tonsillar hypertrophy. Ears are clear. Chest is clear."),
            ("doctor",  "This looks like viral URTI. No need for antibiotics."),
            ("doctor",  "Give paracetamol 250mg every 6 hours if fever above 38 degrees."),
            ("patient", "Koi syrup dena hai?"),
            ("doctor",  "Yes, cetirizine 2.5ml once at night for the runny nose. Plenty of fluids. Light diet."),
            ("doctor",  "Come back if fever persists beyond 3 days or if he develops rash or difficulty breathing."),
        ],
        "note": {
            "chief_complaint": "Fever since last night, maximum 102°F. Associated runny nose and poor appetite.",
            "history_of_present_illness": "7-year-old male brought by parent with 1-day history of fever (max 102°F). Associated rhinorrhoea and decreased appetite. No ear pain or ear pulling reported. No cough.",
            "past_medical_history": "Not documented in this consultation.",
            "medications": "None currently",
            "allergies": "Not documented in this consultation.",
            "review_of_systems": "ENT: rhinorrhoea, pharyngeal erythema. Fever 102°F. Appetite reduced. No ear pain. No cough.",
            "subjective": "7-year-old male with 1-day history of fever and rhinorrhoea consistent with viral URTI.",
            "objective": "Temperature: 102°F (reported by parent). Throat: erythematous, mild tonsillar hypertrophy. Ears: clear bilaterally. Chest: clear on auscultation.",
            "physical_examination": "Throat: erythematous, mild tonsillar hypertrophy. Ears: clear bilaterally. Chest: clear on auscultation.",
            "assessment": "1. Viral upper respiratory tract infection (J06.9)",
            "plan": "1. Paracetamol 250mg every 6 hours if temperature > 38°C\n2. Cetirizine 2.5ml once daily at night for rhinorrhoea\n3. Adequate oral hydration. Light diet.\n4. Return if fever persists beyond 3 days, or if rash or difficulty breathing develops.",
            "follow_up": "Return if fever persists beyond 3 days, or if rash or difficulty breathing develops.",
            "icd_codes": [
                {"code": "J06.9", "description": "Acute upper respiratory infection, unspecified"},
            ],
            "confidence_score": 0.85,
            "generated_by": "perplexity/r1-1776",
            "is_finalized": False,
        },
    },
]

# ─── Longitudinal patient: Arjun Mehta ────────────────────────────────────────
# 5 visits over 8 months: T2DM + HTN diagnosed and progressively managed.
# Designed to produce a compelling Health Intelligence analysis.

ARJUN_PATIENT_ID = UUID("bbbbbbbb-0000-0000-0000-000000000001")

ARJUN_SESSIONS = [
    {
        "id": UUID("aaaaaaaa-0000-0000-0000-000000000004"),
        "doctor_id": DR_ANANYA,
        "months_ago": 8,
        "duration_seconds": 521,
        "transcript": [
            ("doctor",  "Good morning Mr. Arjun. What brings you in today?"),
            ("patient", "Doctor, last 2-3 mahine se bohot thakaan ho rahi hai. Aur pyaas bhi zyada lagti hai, baar baar bathroom jaana padta hai."),
            ("doctor",  "How long exactly has the fatigue been going on?"),
            ("patient", "About 3 months. Aur weight bhi 4-5 kg kam hua hai bina kisi reason ke."),
            ("doctor",  "Any family history of diabetes?"),
            ("patient", "Haan, father ko tha. Maa ko bhi BP hai."),
            ("doctor",  "Let me check your BP. 164 over 98. That's quite high. And I'm doing a random blood glucose right now."),
            ("doctor",  "Blood glucose is 287 mg/dL. That's significantly elevated. With your symptoms, this is very likely diabetes."),
            ("patient", "Matlab kya doctor? Mujhe bhi sugar ho gaya?"),
            ("doctor",  "We need to confirm with proper tests. I'm sending you for HbA1c, fasting glucose, lipid profile, kidney function, and urine tests."),
            ("doctor",  "Meanwhile, please stop all sugar, maida, rice. Walk 30 minutes daily. No alcohol."),
            ("patient", "Theek hai. Koi dawai?"),
            ("doctor",  "Let's wait for the reports first. Come back in 10 days with all reports."),
        ],
        "note": {
            "chief_complaint": "Fatigue for 3 months, polydipsia, polyuria, unintentional weight loss of 4-5 kg.",
            "history_of_present_illness": "48-year-old male presenting with 3-month history of progressive fatigue, increased thirst, frequent urination, and unintentional weight loss of 4-5 kg. Random blood glucose measured in clinic: 287 mg/dL. Blood pressure elevated at 164/98 mmHg. Family history of type 2 diabetes (father) and hypertension (mother).",
            "past_medical_history": "No known diagnosis. Family history: father — T2DM, mother — hypertension.",
            "medications": "None",
            "allergies": "None known",
            "review_of_systems": "Constitutional: fatigue, weight loss 4-5 kg. Metabolic: polydipsia, polyuria. Cardiovascular: hypertension. Neurological: nil.",
            "subjective": "48-year-old male with classic triad of T2DM symptoms (polydipsia, polyuria, weight loss) and random blood glucose 287 mg/dL. BP 164/98 mmHg. Strong family history of diabetes and hypertension.",
            "objective": "BP: 164/98 mmHg. Random blood glucose (fingerprick): 287 mg/dL. BMI: 27.4 kg/m².",
            "physical_examination": "BP 164/98 mmHg. No peripheral oedema. No acanthosis nigricans noted. Abdomen soft.",
            "assessment": "1. Suspected Type 2 Diabetes Mellitus — confirmatory tests ordered (E11.9)\n2. Stage 2 Essential Hypertension (I10)\n3. Unintentional weight loss — likely metabolic",
            "plan": "1. Investigations: HbA1c, fasting blood glucose, lipid profile, renal function tests, urine albumin-creatinine ratio, CBC\n2. Lifestyle modification: low-glycaemic diet, eliminate refined sugar/maida, 30 min walk daily, no alcohol\n3. Review in 10 days with all reports\n4. Will initiate pharmacotherapy after confirming diagnosis",
            "follow_up": "Review in 10 days with all investigation reports before starting medication.",
            "icd_codes": [
                {"code": "E11.9", "description": "Type 2 diabetes mellitus without complications"},
                {"code": "I10", "description": "Essential (primary) hypertension"},
                {"code": "R63.4", "description": "Abnormal weight loss"},
            ],
            "confidence_score": 0.89,
            "generated_by": "perplexity/r1-1776",
            "is_finalized": True,
        },
    },
    {
        "id": UUID("aaaaaaaa-0000-0000-0000-000000000005"),
        "doctor_id": DR_ANANYA,
        "months_ago": 6,
        "duration_seconds": 614,
        "transcript": [
            ("doctor",  "Mr. Arjun, I have your reports. HbA1c is 9.2%. Fasting glucose 218. This confirms Type 2 Diabetes."),
            ("patient", "Kya bolein doctor. Ab kya hoga?"),
            ("doctor",  "It's manageable. We'll start medication today. Also your LDL cholesterol is 168, triglycerides 280 — both elevated."),
            ("doctor",  "Kidney function is normal for now. Urine microalbumin is borderline — we'll watch it."),
            ("patient", "BP ka kya scene hai?"),
            ("doctor",  "Still elevated at 152/94. We need to control both BP and sugar together."),
            ("doctor",  "I'm starting Metformin 500mg twice daily with meals. Amlodipine 5mg once daily for BP."),
            ("patient", "Side effects?"),
            ("doctor",  "Metformin can cause some stomach upset initially — take with food. It will settle in 2 weeks."),
            ("doctor",  "I need you to check your fasting glucose every morning and note it down. Come back in 6 weeks."),
            ("patient", "Theek hai doctor. Khaane mein kya khaun kya chhodu?"),
            ("doctor",  "Brown rice over white, roti limited to 2-3, no fruit juices, no sweets at all. Vegetables — as much as you want. Dal is good. Walk daily without fail."),
        ],
        "note": {
            "chief_complaint": "Follow-up with investigation reports. HbA1c 9.2%, confirmed Type 2 Diabetes Mellitus.",
            "history_of_present_illness": "48-year-old male returning with investigation results confirming Type 2 DM. HbA1c 9.2%, fasting blood glucose 218 mg/dL. Lipid profile shows dyslipidaemia: LDL 168 mg/dL, triglycerides 280 mg/dL. Renal function normal. Urine microalbumin borderline. BP 152/94 mmHg — persistent Stage 2 hypertension.",
            "past_medical_history": "Type 2 Diabetes Mellitus — newly diagnosed. Stage 2 Hypertension.",
            "medications": "None (initiating today)",
            "allergies": "None known",
            "review_of_systems": "Metabolic: polydipsia/polyuria improving slightly. Cardiovascular: hypertension persisting. Renal: borderline urine microalbumin.",
            "subjective": "HbA1c 9.2% confirms T2DM. Dyslipidaemia on lipid profile. BP still 152/94. Starting dual therapy today.",
            "objective": "BP: 152/94 mmHg. FBG: 218 mg/dL. HbA1c: 9.2%. LDL: 168 mg/dL. TG: 280 mg/dL. Renal function: normal. Urine microalbumin: 28 mg/g (borderline).",
            "physical_examination": "BP 152/94 mmHg. No new findings.",
            "assessment": "1. Type 2 Diabetes Mellitus — HbA1c 9.2% (E11.9)\n2. Essential Hypertension — Stage 2, inadequately controlled (I10)\n3. Mixed Dyslipidaemia — LDL 168, TG 280 (E78.5)\n4. Borderline microalbuminuria — monitor",
            "plan": "1. Metformin 500mg BD with meals — initiated today\n2. Amlodipine 5mg OD — initiated today\n3. Diabetic diet counselling: low GI, eliminate refined sugar\n4. Daily 30-minute walk — mandatory\n5. Home FBG monitoring daily, morning fasting\n6. Review in 6 weeks — repeat HbA1c in 3 months",
            "follow_up": "Review in 6 weeks with home glucose log. Repeat HbA1c in 3 months.",
            "icd_codes": [
                {"code": "E11.9", "description": "Type 2 diabetes mellitus without complications"},
                {"code": "I10", "description": "Essential (primary) hypertension"},
                {"code": "E78.5", "description": "Hyperlipidemia, unspecified"},
            ],
            "confidence_score": 0.93,
            "generated_by": "perplexity/r1-1776",
            "is_finalized": True,
        },
    },
    {
        "id": UUID("aaaaaaaa-0000-0000-0000-000000000006"),
        "doctor_id": DR_ANANYA,
        "months_ago": 4,
        "duration_seconds": 498,
        "transcript": [
            ("doctor",  "Good morning Mr. Arjun. How have you been? Let me see your glucose log."),
            ("patient", "Doctor, glucose thoda kam hua hai. Log dekhen — 140 se 160 ke beech hai mostly."),
            ("doctor",  "That's some improvement. BP today is 148/90 — still higher than target. Let's see your HbA1c."),
            ("doctor",  "HbA1c is now 8.1% — down from 9.2%. Good progress but we need to bring it below 7."),
            ("patient", "Koi naya dawai leni padegi?"),
            ("doctor",  "Yes, I think we should add Glipizide 5mg once daily before breakfast. This will help lower the sugar further."),
            ("doctor",  "Also your lipid profile — I want a fresh one done today. And I'm increasing amlodipine to 10mg."),
            ("patient", "Thoda chakkar aata hai kabhi kabhi."),
            ("doctor",  "That could be the BP dropping too fast. Let's watch it. Also are you taking metformin with both meals?"),
            ("patient", "Haan doctor, roz le raha hoon. Kabhi kabhi pet mein dard hota hai."),
            ("doctor",  "That's expected — it usually settles. If it's severe, let me know. Otherwise continue."),
            ("doctor",  "Come back in 6 weeks. I also want kidney function and urine microalbumin repeated."),
        ],
        "note": {
            "chief_complaint": "Routine follow-up. HbA1c 8.1% (down from 9.2%). Home glucose 140-160 mg/dL. Occasional dizziness.",
            "history_of_present_illness": "48-year-old male with T2DM and HTN on Metformin 500mg BD and Amlodipine 5mg OD. HbA1c improved from 9.2% to 8.1% over 2 months. Home fasting glucose 140-160 mg/dL. BP 148/90 mmHg — improved but above target. Occasional dizziness, possibly postural. Mild GI upset from Metformin — tolerable.",
            "past_medical_history": "T2DM (E11.9), Essential Hypertension Stage 2 (I10), Dyslipidaemia (E78.5)",
            "medications": "Metformin 500mg BD, Amlodipine 5mg OD",
            "allergies": "None known",
            "review_of_systems": "Metabolic: glucose improving. Cardiovascular: BP 148/90. GI: mild metformin-related discomfort.",
            "subjective": "HbA1c improving (9.2% → 8.1%). BP partially controlled. Adding Glipizide. Increasing Amlodipine.",
            "objective": "BP: 148/90 mmHg. HbA1c: 8.1%. Home FBG: 140-160 mg/dL.",
            "physical_examination": "BP 148/90 mmHg. No ankle oedema. No focal neurological deficit.",
            "assessment": "1. T2DM — improving, HbA1c 8.1% (E11.9)\n2. Hypertension — partially controlled (I10)\n3. Dyslipidaemia — repeat lipid profile ordered (E78.5)\n4. Metformin-related GI symptoms — mild, tolerable",
            "plan": "1. Add Glipizide 5mg OD before breakfast\n2. Increase Amlodipine to 10mg OD\n3. Continue Metformin 500mg BD\n4. Fresh fasting lipid profile today\n5. Renal function + urine microalbumin today\n6. Review in 6 weeks — target HbA1c < 7% in next visit",
            "follow_up": "Review in 6 weeks. Target HbA1c < 7%. Monitor for hypoglycaemia on Glipizide.",
            "icd_codes": [
                {"code": "E11.9", "description": "Type 2 diabetes mellitus without complications"},
                {"code": "I10", "description": "Essential (primary) hypertension"},
                {"code": "E78.5", "description": "Hyperlipidemia, unspecified"},
            ],
            "confidence_score": 0.91,
            "generated_by": "perplexity/r1-1776",
            "is_finalized": True,
        },
    },
    {
        "id": UUID("aaaaaaaa-0000-0000-0000-000000000007"),
        "doctor_id": DR_ANANYA,
        "months_ago": 2,
        "duration_seconds": 572,
        "transcript": [
            ("doctor",  "Mr. Arjun. HbA1c is 7.4% — excellent improvement. But I'm a bit concerned about something you mentioned."),
            ("patient", "Haan doctor, last 2-3 hafton mein seedhiyan chadhte waqt seene mein thoda khinchao hota hai."),
            ("doctor",  "Chest tightness on exertion. Any radiation to the arm or jaw?"),
            ("patient", "Nahi, sirf seene mein. 1-2 minute mein chala jaata hai."),
            ("doctor",  "I'm sending you for a chest X-ray right now. Also your lipid profile came back — LDL is 178, HDL only 38, triglycerides 289. That's concerning."),
            ("patient", "Yeh bad hai kya?"),
            ("doctor",  "Yes — LDL is too high, HDL too low. Combined with diabetes and hypertension, your cardiac risk is elevated."),
            ("doctor",  "Chest X-ray shows mild cardiomegaly — heart is slightly enlarged, likely from years of high BP."),
            ("doctor",  "I'm starting Atorvastatin 20mg tonight. And I want you to see a cardiologist for an echocardiogram."),
            ("patient", "Seedha hospital jaun?"),
            ("doctor",  "I'll give you a referral. Don't delay. BP today is 138/86 — that's much better though."),
            ("doctor",  "Continue all your medications. Do NOT miss the Atorvastatin. Come back in 6 weeks or sooner if chest pain worsens."),
        ],
        "note": {
            "chief_complaint": "Exertional chest tightness for 2-3 weeks, resolving at rest. HbA1c 7.4% (improving). Dyslipidaemia worsened: LDL 178, HDL 38, TG 289.",
            "history_of_present_illness": "48-year-old male with T2DM and HTN presenting with new-onset exertional chest tightness for 2-3 weeks, resolving within 1-2 minutes at rest. No radiation to arm or jaw. HbA1c 7.4% (improved from 8.1%). BP 138/86 mmHg — better controlled. Lipid profile: LDL 178 mg/dL, HDL 38 mg/dL, TG 289 mg/dL — high cardiovascular risk. Chest X-ray: mild cardiomegaly (CTR 0.56).",
            "past_medical_history": "T2DM (E11.9), Essential Hypertension Stage 2 (I10), Dyslipidaemia (E78.5). On Metformin 500mg BD, Glipizide 5mg OD, Amlodipine 10mg OD.",
            "medications": "Metformin 500mg BD, Glipizide 5mg OD, Amlodipine 10mg OD",
            "allergies": "None known",
            "review_of_systems": "Cardiovascular: exertional chest tightness, cardiomegaly on CXR, dyslipidaemia. Metabolic: diabetes improving. Respiratory: chest X-ray clear lung fields.",
            "subjective": "New exertional chest tightness in a diabetic hypertensive patient with dyslipidaemia and cardiomegaly. High cardiac risk profile.",
            "objective": "BP: 138/86 mmHg. HbA1c: 7.4%. LDL: 178 mg/dL. HDL: 38 mg/dL. TG: 289 mg/dL. Chest X-ray: mild cardiomegaly, clear lung fields.",
            "physical_examination": "BP 138/86 mmHg. No new chest findings. No ankle oedema.",
            "assessment": "1. Exertional chest tightness — possible angina, needs cardiac evaluation (R07.9)\n2. T2DM — improving, HbA1c 7.4% (E11.9)\n3. Hypertension — improving, BP 138/86 (I10)\n4. Mixed dyslipidaemia — LDL 178, HDL 38, TG 289 (E78.5)\n5. Mild cardiomegaly on CXR — likely hypertensive (I51.7)",
            "plan": "1. Add Atorvastatin 20mg OD at night — started today\n2. Urgent cardiology referral for echocardiogram\n3. Continue: Metformin 500mg BD, Glipizide 5mg OD, Amlodipine 10mg OD\n4. Emergency: if chest pain at rest, radiates to arm/jaw, or lasts >15 min — go to ER immediately\n5. Review in 6 weeks or sooner if symptoms worsen",
            "follow_up": "Cardiology referral issued. Echo urgent. Review in 6 weeks.",
            "icd_codes": [
                {"code": "R07.9", "description": "Chest pain, unspecified"},
                {"code": "E11.9", "description": "Type 2 diabetes mellitus without complications"},
                {"code": "I10", "description": "Essential (primary) hypertension"},
                {"code": "E78.5", "description": "Hyperlipidemia, unspecified"},
                {"code": "I51.7", "description": "Cardiomegaly"},
            ],
            "confidence_score": 0.94,
            "generated_by": "perplexity/r1-1776",
            "is_finalized": True,
        },
    },
    {
        "id": UUID("aaaaaaaa-0000-0000-0000-000000000008"),
        "doctor_id": DR_ANANYA,
        "weeks_ago": 3,
        "duration_seconds": 445,
        "transcript": [
            ("doctor",  "Mr. Arjun! Good news. HbA1c is 6.9% — that's almost at target. How's the chest?"),
            ("patient", "Doctor, chest ki tightness kaafi kam ho gayi hai. Atorvastatin start karne ke baad."),
            ("doctor",  "That's excellent. The statin is working. Echo report?"),
            ("patient", "Cardiologist ne echo kiya — report laya hoon."),
            ("doctor",  "Echo shows mild LV hypertrophy, EF 58% — that's acceptable. Consistent with hypertensive heart disease. No ischaemic pattern."),
            ("patient", "Iska matlab kya?"),
            ("doctor",  "Your heart muscle is slightly thickened from years of BP pressure, but the pumping function is normal. The chest tightness is likely from this, not a blockage."),
            ("doctor",  "BP today is 130/82 — very good. Excellent control. We're on track."),
            ("patient", "Dawaiyan kab tak leni padegi?"),
            ("doctor",  "These are long-term medications. But as sugar and BP stay controlled, we can potentially reduce doses over time."),
            ("doctor",  "I also want to send you to ophthalmology for diabetic eye check. It's been 8 months since diagnosis — mandatory screening."),
            ("doctor",  "Come back in 3 months. Target for next HbA1c: below 6.5%."),
        ],
        "note": {
            "chief_complaint": "Routine follow-up. Chest tightness significantly improved. Echo done: mild LV hypertrophy, EF 58%.",
            "history_of_present_illness": "48-year-old male with T2DM and HTN on optimised therapy. HbA1c 6.9% — approaching target of <6.5%. Chest tightness markedly improved after Atorvastatin initiation. Echocardiogram: mild LV hypertrophy, EF 58% (normal), no regional wall motion abnormality — consistent with hypertensive cardiomyopathy, no ischaemic pattern. BP 130/82 mmHg — well controlled.",
            "past_medical_history": "T2DM (E11.9), Essential Hypertension (I10), Dyslipidaemia (E78.5), Hypertensive cardiomyopathy (I51.7). On Metformin 500mg BD, Glipizide 5mg OD, Amlodipine 10mg OD, Atorvastatin 20mg OD.",
            "medications": "Metformin 500mg BD, Glipizide 5mg OD, Amlodipine 10mg OD, Atorvastatin 20mg OD",
            "allergies": "None known",
            "review_of_systems": "Cardiovascular: chest tightness resolved, BP well controlled. Metabolic: HbA1c 6.9%, excellent trend. Ocular: diabetic retinopathy screening overdue — referral today.",
            "subjective": "Excellent overall trend. HbA1c 6.9% (from 9.2% over 5 months). BP 130/82. Chest symptoms resolved. Echo: hypertensive LVH, EF normal.",
            "objective": "BP: 130/82 mmHg. HbA1c: 6.9%. Echo: mild LV hypertrophy, EF 58%, no RWMA. LDL (pending recheck in 3 months).",
            "physical_examination": "BP 130/82 mmHg. No chest pain on examination. No ankle oedema.",
            "assessment": "1. T2DM — well controlled, HbA1c 6.9% (E11.9)\n2. Hypertension — well controlled, BP 130/82 (I10)\n3. Hypertensive cardiomyopathy — mild LVH, EF normal (I11.9)\n4. Dyslipidaemia — improving on statin, recheck in 3 months (E78.5)\n5. Diabetic retinopathy screening overdue — referral issued",
            "plan": "1. Continue all current medications unchanged\n2. Ophthalmology referral — diabetic retinopathy screening (8 months post-diagnosis)\n3. Urine microalbumin + renal function in 3 months\n4. Repeat lipid profile in 3 months\n5. HbA1c target: <6.5% by next visit\n6. Review in 3 months",
            "follow_up": "Review in 3 months. Ophthalmology referral issued for diabetic retinopathy screening.",
            "icd_codes": [
                {"code": "E11.9", "description": "Type 2 diabetes mellitus without complications"},
                {"code": "I10", "description": "Essential (primary) hypertension"},
                {"code": "I11.9", "description": "Hypertensive heart disease without heart failure"},
                {"code": "E78.5", "description": "Hyperlipidemia, unspecified"},
            ],
            "confidence_score": 0.96,
            "generated_by": "perplexity/r1-1776",
            "is_finalized": True,
        },
    },
]

ARJUN_DOCUMENTS = [
    {
        "id": UUID("cccccccc-0000-0000-0000-000000000001"),
        "filename": "HbA1c_Trend_Report.pdf",
        "doc_type": "lab_report",
        "description": (
            "Serial HbA1c measurements over 5 months showing progressive glycaemic improvement:\n"
            "• Visit 1 (baseline): 9.2% — poorly controlled diabetes at diagnosis\n"
            "• Visit 2 (2 months): 8.1% — moderate improvement on Metformin + lifestyle\n"
            "• Visit 3 (4 months): 7.4% — further improvement after adding Glipizide\n"
            "• Visit 4 (5 months): 6.9% — approaching target range (<6.5%)\n"
            "Trend: Consistently improving. Current trajectory suggests HbA1c target achievable in next visit.\n"
            "Note: Fasting blood glucose also improved from 218 mg/dL (baseline) to ~110-125 mg/dL (current)."
        ),
        "content_type": "application/pdf",
        "months_ago": 1,
    },
    {
        "id": UUID("cccccccc-0000-0000-0000-000000000002"),
        "filename": "Lipid_Profile_Report.pdf",
        "doc_type": "lab_report",
        "description": (
            "Fasting Lipid Profile — HIGH CARDIOVASCULAR RISK PROFILE:\n"
            "• Total Cholesterol: 241 mg/dL (HIGH — target <200)\n"
            "• LDL Cholesterol: 178 mg/dL (HIGH — target <100 for diabetics)\n"
            "• HDL Cholesterol: 38 mg/dL (LOW — target >40 for males)\n"
            "• Triglycerides: 289 mg/dL (HIGH — target <150)\n"
            "• Non-HDL Cholesterol: 203 mg/dL (HIGH)\n"
            "Clinical impression: Mixed dyslipidaemia in a diabetic patient. Combined with hypertension, "
            "this represents HIGH 10-year cardiovascular risk. Statin therapy and dietary modification indicated. "
            "Atorvastatin 20mg initiated at last visit — repeat lipid profile in 3 months to assess response."
        ),
        "content_type": "application/pdf",
        "months_ago": 2,
    },
    {
        "id": UUID("cccccccc-0000-0000-0000-000000000003"),
        "filename": "Chest_Xray_PA_View.pdf",
        "doc_type": "xray",
        "description": (
            "Chest X-Ray — PA View:\n"
            "• Cardiothoracic ratio (CTR): 0.56 (MILDLY ELEVATED — normal <0.50)\n"
            "• Impression: Mild cardiomegaly, likely hypertensive in aetiology\n"
            "• Lung fields: Clear bilaterally. No consolidation, infiltrates, or pleural effusion.\n"
            "• Mediastinum: Not widened\n"
            "• Bony structures: Normal\n"
            "• Diaphragm: Normal contour bilaterally\n"
            "Clinical correlation: In the context of long-standing hypertension (Stage 2) and T2DM, "
            "this mild cardiomegaly is consistent with hypertensive heart disease / early LV hypertrophy. "
            "Echocardiogram recommended for functional assessment. Subsequently confirmed on echo: "
            "mild LV hypertrophy, EF 58% — no ischaemic pattern."
        ),
        "content_type": "application/pdf",
        "months_ago": 2,
    },
]


async def _seed_arjun(db: AsyncSession):
    """Seed Arjun Mehta with 5 longitudinal visits + 3 documents."""
    seeded = 0
    now_utc = datetime.now(timezone.utc)

    # Create or find patient
    patient = await db.get(Patient, ARJUN_PATIENT_ID)
    if not patient:
        patient = Patient(
            id=ARJUN_PATIENT_ID,
            name="Arjun Mehta",
            age=48,
            gender="Male",
            blood_group="B+",
            chronic_conditions="Type 2 Diabetes Mellitus, Essential Hypertension, Dyslipidaemia",
            known_allergies="None",
            phone="+91 98100 55432",
        )
        db.add(patient)
        await db.flush()

    for demo in ARJUN_SESSIONS:
        existing = await db.get(SessionModel, demo["id"])
        if existing:
            continue

        if "months_ago" in demo:
            session_time = now_utc - timedelta(days=demo["months_ago"] * 30)
        else:
            session_time = now_utc - timedelta(weeks=demo["weeks_ago"])

        ended_at = session_time + timedelta(seconds=demo["duration_seconds"])

        session = SessionModel(
            id=demo["id"],
            doctor_id=demo["doctor_id"],
            patient_id=ARJUN_PATIENT_ID,
            patient_consent_given=True,
            consent_timestamp=session_time,
            status="completed",
            started_at=session_time,
            ended_at=ended_at,
            created_at=session_time,
        )
        db.add(session)
        await db.flush()

        chunk_interval_ms = (demo["duration_seconds"] * 1000) // max(len(demo["transcript"]), 1)
        for i, (speaker, text) in enumerate(demo["transcript"]):
            db.add(Transcript(
                id=uuid4(),
                session_id=demo["id"],
                speaker=speaker,
                text=text,
                start_time_ms=i * chunk_interval_ms,
                confidence=0.87 + (i % 3) * 0.03,
                created_at=session_time + timedelta(milliseconds=i * chunk_interval_ms),
            ))

        note_data = demo["note"]
        note_id = uuid4()
        note = ClinicalNote(
            id=note_id,
            session_id=demo["id"],
            status="finalized",
            chief_complaint=note_data["chief_complaint"],
            history_of_present_illness=note_data["history_of_present_illness"],
            past_medical_history=note_data["past_medical_history"],
            medications=note_data["medications"],
            allergies=note_data["allergies"],
            review_of_systems=note_data["review_of_systems"],
            subjective=note_data["subjective"],
            objective=note_data["objective"],
            physical_examination=note_data["physical_examination"],
            assessment=note_data["assessment"],
            plan=note_data["plan"],
            follow_up=note_data["follow_up"],
            icd_codes=note_data["icd_codes"],
            confidence_score=note_data["confidence_score"],
            generated_by=note_data["generated_by"],
            is_finalized=True,
            finalized_at=ended_at + timedelta(minutes=2),
            created_at=ended_at,
        )
        db.add(note)

        db.add(NoteAuditLog(
            id=uuid4(), note_id=note_id, changed_by=demo["doctor_id"],
            change_type="generated",
            snapshot={"confidence_score": note_data["confidence_score"], "seeded": True},
            created_at=ended_at + timedelta(seconds=30),
        ))
        db.add(NoteAuditLog(
            id=uuid4(), note_id=note_id, changed_by=demo["doctor_id"],
            change_type="finalized",
            snapshot={"finalized_at": (ended_at + timedelta(minutes=2)).isoformat()},
            created_at=ended_at + timedelta(minutes=2),
        ))

        await db.commit()
        seeded += 1

    # Seed documents
    for doc_def in ARJUN_DOCUMENTS:
        existing_doc = await db.get(PatientDocument, doc_def["id"])
        if existing_doc:
            continue

        if "months_ago" in doc_def:
            upload_time = now_utc - timedelta(days=doc_def["months_ago"] * 30)
        else:
            upload_time = now_utc - timedelta(weeks=doc_def.get("weeks_ago", 2))

        doc = PatientDocument(
            id=doc_def["id"],
            patient_id=ARJUN_PATIENT_ID,
            filename=doc_def["filename"],
            doc_type=doc_def["doc_type"],
            description=doc_def["description"],
            ai_analyzed=True,
            content_type=doc_def["content_type"],
            file_size=len(PLACEHOLDER_PDF),
            file_data=PLACEHOLDER_PDF,
            uploaded_at=upload_time,
        )
        db.add(doc)

    await db.commit()
    print(f"  ✓ Seeded: Arjun Mehta — {seeded} visits + {len(ARJUN_DOCUMENTS)} documents")
    return seeded


async def seed(db: AsyncSession):
    seeded = 0
    for demo in DEMO_SESSIONS:
        existing = await db.get(SessionModel, demo["id"])
        if existing:
            print(f"  Session {demo['patient_name']} already exists — skipping")
            continue

        now = demo["created_at"]
        ended_at = now + timedelta(seconds=demo["duration_seconds"])

        patient_result = await db.execute(
            select(Patient).where(Patient.name == demo["patient_name"])
        )
        patient = patient_result.scalar_one_or_none()
        if not patient:
            patient = Patient(
                id=uuid4(),
                name=demo["patient_name"],
                age=demo["patient_age"],
                gender=demo["patient_gender"],
            )
            db.add(patient)
            await db.flush()

        session = SessionModel(
            id=demo["id"],
            doctor_id=demo["doctor_id"],
            patient_id=patient.id,
            patient_consent_given=True,
            consent_timestamp=now,
            status="completed",
            started_at=now,
            ended_at=ended_at,
            created_at=now,
        )
        db.add(session)
        await db.flush()

        chunk_interval_ms = (demo["duration_seconds"] * 1000) // max(len(demo["transcript"]), 1)
        for i, (speaker, text) in enumerate(demo["transcript"]):
            chunk = Transcript(
                id=uuid4(),
                session_id=demo["id"],
                speaker=speaker,
                text=text,
                start_time_ms=i * chunk_interval_ms,
                confidence=0.87 + (i % 3) * 0.03,
                created_at=now + timedelta(milliseconds=i * chunk_interval_ms),
            )
            db.add(chunk)

        note_id = uuid4()
        note_data = demo["note"]
        is_finalized = note_data["is_finalized"]
        note = ClinicalNote(
            id=note_id,
            session_id=demo["id"],
            status="finalized" if is_finalized else "ready",
            chief_complaint=note_data["chief_complaint"],
            history_of_present_illness=note_data["history_of_present_illness"],
            past_medical_history=note_data["past_medical_history"],
            medications=note_data["medications"],
            allergies=note_data["allergies"],
            review_of_systems=note_data["review_of_systems"],
            subjective=note_data["subjective"],
            objective=note_data["objective"],
            physical_examination=note_data["physical_examination"],
            assessment=note_data["assessment"],
            plan=note_data["plan"],
            follow_up=note_data["follow_up"],
            icd_codes=note_data["icd_codes"],
            confidence_score=note_data["confidence_score"],
            generated_by=note_data["generated_by"],
            is_finalized=is_finalized,
            finalized_at=ended_at + timedelta(minutes=2) if is_finalized else None,
            created_at=ended_at,
        )
        db.add(note)

        db.add(NoteAuditLog(
            id=uuid4(), note_id=note_id, changed_by=demo["doctor_id"],
            change_type="generated",
            snapshot={"confidence_score": note_data["confidence_score"], "chunk_count": len(demo["transcript"]), "seeded": True},
            created_at=ended_at + timedelta(seconds=30),
        ))

        if is_finalized:
            db.add(NoteAuditLog(
                id=uuid4(), note_id=note_id, changed_by=demo["doctor_id"],
                change_type="finalized",
                snapshot={"finalized_at": (ended_at + timedelta(minutes=2)).isoformat()},
                created_at=ended_at + timedelta(minutes=2),
            ))

        await db.commit()
        seeded += 1
        print(f"  ✓ Seeded: {demo['patient_name']} ({demo['duration_seconds']}s)")

    arjun_seeded = await _seed_arjun(db)
    seeded += arjun_seeded
    return seeded


async def main():
    engine = create_async_engine(settings.database_url, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with AsyncSessionLocal() as db:
        print("Seeding demo data...")
        n = await seed(db)
        print(f"Done. {n} sessions seeded (0 = already existed).")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
