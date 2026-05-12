#!/usr/bin/env python3
"""
One-time script to build the local ICD-10 SQLite database.
Run: python scripts/build_icd_db.py
Curated subset of ~80 common Indian primary-care codes.
"""

import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "../data/icd10_codes.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

SEED_CODES = [
    # Infectious & Parasitic
    ("A01.0", "Typhoid fever", "Infectious"),
    ("A09",   "Diarrhoea and gastroenteritis of infectious origin", "Infectious"),
    ("A15.0", "Tuberculosis of lung, confirmed by sputum microscopy", "Infectious"),
    ("A90",   "Dengue fever", "Infectious"),
    ("A91",   "Dengue haemorrhagic fever", "Infectious"),
    ("B50.9", "Plasmodium falciparum malaria, unspecified", "Infectious"),
    ("B34.9", "Viral infection, unspecified", "Infectious"),
    # Respiratory
    ("J00",   "Acute nasopharyngitis (common cold)", "Respiratory"),
    ("J02.9", "Acute pharyngitis, unspecified", "Respiratory"),
    ("J06.9", "Acute upper respiratory infection, unspecified", "Respiratory"),
    ("J18.9", "Pneumonia, unspecified organism", "Respiratory"),
    ("J20.9", "Acute bronchitis, unspecified", "Respiratory"),
    ("J45.9", "Asthma, unspecified", "Respiratory"),
    ("J11.1", "Influenza with other respiratory manifestations, virus not identified", "Respiratory"),
    # Cardiovascular
    ("I10",   "Essential (primary) hypertension", "Cardiovascular"),
    ("I11.9", "Hypertensive heart disease without heart failure", "Cardiovascular"),
    ("I20.9", "Angina pectoris, unspecified", "Cardiovascular"),
    ("I21.9", "Acute myocardial infarction, unspecified", "Cardiovascular"),
    ("I50.9", "Heart failure, unspecified", "Cardiovascular"),
    ("I63.9", "Cerebral infarction, unspecified", "Cardiovascular"),
    # Diabetes & Endocrine
    ("E11.9", "Type 2 diabetes mellitus without complications", "Endocrine"),
    ("E11.0", "Type 2 diabetes mellitus with hyperosmolarity", "Endocrine"),
    ("E11.4", "Type 2 diabetes mellitus with diabetic neuropathy", "Endocrine"),
    ("E11.6", "Type 2 diabetes mellitus with other specified complications", "Endocrine"),
    ("E78.5", "Hyperlipidaemia, unspecified", "Endocrine"),
    ("E03.9", "Hypothyroidism, unspecified", "Endocrine"),
    ("E05.9", "Thyrotoxicosis, unspecified", "Endocrine"),
    # Gastrointestinal
    ("K21.0", "Gastro-oesophageal reflux disease with oesophagitis", "Gastrointestinal"),
    ("K25.9", "Gastric ulcer, unspecified", "Gastrointestinal"),
    ("K29.7", "Gastritis, unspecified", "Gastrointestinal"),
    ("K57.9", "Diverticular disease of intestine, unspecified", "Gastrointestinal"),
    ("K80.2", "Calculus of gallbladder without cholecystitis", "Gastrointestinal"),
    ("K92.1", "Melaena", "Gastrointestinal"),
    # Musculoskeletal
    ("M05.9", "Seropositive rheumatoid arthritis, unspecified", "Musculoskeletal"),
    ("M10.9", "Gout, unspecified", "Musculoskeletal"),
    ("M17.9", "Gonarthrosis, unspecified", "Musculoskeletal"),
    ("M25.5", "Pain in joint", "Musculoskeletal"),
    ("M54.5", "Low back pain", "Musculoskeletal"),
    # Neurological
    ("G43.9", "Migraine, unspecified", "Neurological"),
    ("G45.9", "Transient cerebral ischaemic attack, unspecified", "Neurological"),
    ("R51",   "Headache", "Neurological"),
    # Genitourinary
    ("N18.9", "Chronic kidney disease, unspecified", "Genitourinary"),
    ("N39.0", "Urinary tract infection, site not specified", "Genitourinary"),
    ("N40",   "Benign prostatic hyperplasia", "Genitourinary"),
    # Symptoms & Signs
    ("R00.0", "Tachycardia, unspecified", "Symptoms"),
    ("R04.2", "Haemoptysis", "Symptoms"),
    ("R05",   "Cough", "Symptoms"),
    ("R06.0", "Dyspnoea", "Symptoms"),
    ("R07.4", "Chest pain, unspecified", "Symptoms"),
    ("R10.4", "Other and unspecified abdominal pain", "Symptoms"),
    ("R11",   "Nausea and vomiting", "Symptoms"),
    ("R50.9", "Fever, unspecified", "Symptoms"),
    ("R53",   "Malaise and fatigue", "Symptoms"),
    ("R55",   "Syncope and collapse", "Symptoms"),
    ("R73.0", "Abnormal glucose", "Symptoms"),
    # Mental Health
    ("F32.9", "Depressive episode, unspecified", "Mental Health"),
    ("F41.1", "Generalised anxiety disorder", "Mental Health"),
    ("F10.1", "Mental and behavioural disorders due to use of alcohol, harmful use", "Mental Health"),
    # Skin
    ("L30.9", "Dermatitis, unspecified", "Skin"),
    ("L40.0", "Psoriasis vulgaris", "Skin"),
    ("B35.1", "Tinea unguium", "Skin"),
    # Eye
    ("H26.9", "Cataract, unspecified", "Eye"),
    ("H40.1", "Open-angle glaucoma", "Eye"),
    # Injury
    ("T14.9", "Injury, unspecified", "Injury"),
    ("S09.9", "Unspecified injury of head", "Injury"),
    # Anaemia
    ("D50.9", "Iron deficiency anaemia, unspecified", "Blood"),
    ("D64.9", "Anaemia, unspecified", "Blood"),
    # Pregnancy
    ("O26.9", "Pregnancy-related condition, unspecified", "Obstetric"),
    ("Z34.0", "Supervision of normal first pregnancy", "Obstetric"),
    # Preventive / Well visits
    ("Z00.0", "General medical examination", "Preventive"),
    ("Z10.0", "Cardiovascular system examination", "Preventive"),
    ("Z76.0", "Issue of repeat prescription", "Preventive"),
]


def build():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS icd10 (
            code TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            category TEXT NOT NULL
        )
    """)
    c.execute("CREATE INDEX IF NOT EXISTS idx_desc ON icd10(description)")
    c.executemany(
        "INSERT OR REPLACE INTO icd10 (code, description, category) VALUES (?, ?, ?)",
        SEED_CODES,
    )
    conn.commit()
    count = c.execute("SELECT COUNT(*) FROM icd10").fetchone()[0]
    conn.close()
    print(f"ICD-10 database built: {count} codes at {DB_PATH}")


if __name__ == "__main__":
    build()
