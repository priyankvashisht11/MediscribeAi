import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import styles from './LandingPage.module.css'

const STATS = [
  { value: '< 30s', label: 'avg. note generation' },
  { value: '3', label: 'documents per session' },
  { value: 'Hindi + English', label: 'language support' },
  { value: 'Free', label: 'to get started' },
]

const HOW_IT_WORKS = [
  {
    num: '01',
    title: 'Open Chartr, name the patient',
    desc: 'Type the patient name and hit Start. No hospital ID, no complex forms — 10 seconds flat.',
    img: 'https://images.pexels.com/photos/4266941/pexels-photo-4266941.jpeg?auto=compress&cs=tinysrgb&w=520',
  },
  {
    num: '02',
    title: 'Consult as you always do',
    desc: 'Hindi, English, Hinglish — speak freely. Chartr listens without interrupting your flow.',
    img: 'https://images.pexels.com/photos/7653316/pexels-photo-7653316.jpeg?auto=compress&cs=tinysrgb&w=520',
  },
  {
    num: '03',
    title: 'Documents ready in 30 seconds',
    desc: 'SOAP note, prescription PDF, patient instruction sheet — all branded with your clinic.',
    img: 'https://images.unsplash.com/photo-1778918006429-9212a04d2177?w=520&q=80&auto=format&fit=crop',
  },
]

const TESTIMONIALS = [
  {
    quote: "I was spending 45 minutes after each OPD writing notes. With Chartr I'm done in under 5. The Hindi recognition is surprisingly accurate for my Delhi patients.",
    name: 'Dr. Rajesh Sharma',
    title: 'General Physician · New Delhi',
    initials: 'RS',
  },
  {
    quote: "60 patients a day as a pediatrician. Chartr's SOAP accuracy is high enough that I just review and approve. Documentation backlog: completely gone.",
    name: 'Dr. Priya Mehta',
    title: 'Pediatrician · Mumbai',
    initials: 'PM',
  },
  {
    quote: "Setup took 5 minutes, zero IT involvement. The branded prescription PDF looks more professional than what I had with my previous system.",
    name: 'Dr. Arun Krishnamurthy',
    title: 'Cardiologist · Bangalore',
    initials: 'AK',
  },
]

const SPECIALTIES = ['General Practice', 'Pediatrics', 'Cardiology', 'Orthopedics', 'Dermatology', 'Neurology', 'Gynecology', 'Psychiatry', 'ENT', 'Ophthalmology']

const FEATURES = [
  {
    tag: 'Ambient Recording',
    title: 'Listens.\nUnderstands.\nDocuments.',
    desc: 'Start a session and speak naturally. Chartr runs in the background during your consultation — no dictation, no typing. Works in Hindi, English, and Hinglish without missing a beat.',
    items: ['Live transcription, results in under 150ms', 'Zero interruptions to workflow', 'Works on phone, tablet, desktop'],
    visual: 'recording',
  },
  {
    tag: 'AI Documents',
    title: 'Three documents.\nOne click.',
    desc: 'The moment your session ends, Chartr generates a structured SOAP note, a prescription PDF, and a plain-language patient instruction sheet — all branded with your clinic details.',
    items: ['SOAP note with ICD-10 codes', 'Branded prescription PDF', 'Patient-friendly instruction sheet'],
    visual: 'docs',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    document.body.style.overflow = 'auto'
    document.body.style.height = 'auto'
    return () => {
      document.body.style.overflow = ''
      document.body.style.height = ''
    }
  }, [])

  return (
    <div className={styles.page}>

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <Logo size={26} light />
          Chartr
        </div>
        <div className={styles.navActions}>
          <button className={styles.navLink} onClick={() => navigate('/login')}>Sign in</button>
          <button className={styles.navCta} onClick={() => navigate('/signup')}>Get started free</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <h1 className={styles.heroTitle}>
            Your patients talk.<br />Chartr writes.
          </h1>
          <p className={styles.heroSub}>
            Ambient AI scribe built for Indian doctors. Listens to your
            consultations and generates SOAP notes, prescriptions, and patient
            sheets in under 30 seconds.
          </p>
          <div className={styles.heroCtas}>
            <button className={styles.btnPrimary} onClick={() => navigate('/signup')}>
              Create your clinic →
            </button>
            <button className={styles.btnGhost} onClick={() => navigate('/login')}>
              Sign in
            </button>
          </div>
          <p className={styles.heroNote}>No credit card · No setup fee · Works on any device</p>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.heroImageWrap}>
            <img
              src="https://images.pexels.com/photos/5407222/pexels-photo-5407222.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Young female doctor in consultation"
              className={styles.heroImage}
            />
            <div className={styles.heroNoteCard}>
              <span className={styles.heroNoteTag}>SOAP · Generated in 24s</span>
              <p className={styles.heroNoteText}>Chief Complaint: Fever 101.2°F × 3 days, body ache, mild cough</p>
              <p className={styles.heroNoteText} style={{ opacity: 0.55 }}>Assessment: Viral URTI (J06.9) — symptomatic management...</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className={styles.statsStrip}>
        {STATS.map(s => (
          <div key={s.label} className={styles.stripItem}>
            <span className={styles.stripValue}>{s.value}</span>
            <span className={styles.stripLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── How it works ── */}
      <section className={styles.howSection}>
        <div className={styles.howInner}>
          <span className={styles.eyebrow}>Simple by design</span>
          <h2 className={styles.howTitle}>From consultation to documents<br />in three steps</h2>
          <div className={styles.howSteps}>
            {HOW_IT_WORKS.map((step) => (
              <div key={step.num} className={styles.howStep}>
                <div className={styles.howStepImgWrap}>
                  <img src={step.img} alt={step.title} className={styles.howStepImg} />
                  <div className={styles.howStepNum}>{step.num}</div>
                </div>
                <h3 className={styles.howStepTitle}>{step.title}</h3>
                <p className={styles.howStepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className={styles.features}>
        {FEATURES.map((f, i) => (
          <div key={f.tag} className={`${styles.featureRow} ${i % 2 === 1 ? styles.featureRowFlip : ''}`}>
            <div className={styles.featureText}>
              <span className={styles.featureTag}>{f.tag}</span>
              <h2 className={styles.featureTitle}>{f.title}</h2>
              <p className={styles.featureDesc}>{f.desc}</p>
              <ul className={styles.featureList}>
                {f.items.map(item => (
                  <li key={item} className={styles.featureListItem}>
                    <span className={styles.featureArrow}>→</span>{item}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.featureVisual}>
              {f.visual === 'recording' ? (
                <div className={styles.rvWrap}>
                  <div className={styles.rvImageWrap}>
                    <img
                      src="https://images.unsplash.com/photo-1758691462863-9e1b8a863140?w=600&q=80&auto=format&fit=crop"
                      alt="Doctor consulting with patient, ambient recording"
                      className={styles.rvImage}
                    />
                    <div className={styles.rvBadge}>
                      <span className={styles.rvDot} />
                      <span className={styles.rvStatus}>Recording · 00:42</span>
                    </div>
                  </div>
                  <p className={styles.rvQuote}>
                    "Patient presents with fever for 3 days, 101°F at home.
                    Mild body ache, slight cough, no loose motions..."
                  </p>
                </div>
              ) : (
                <div className={styles.docsWrap}>
                  {['SOAP Note', 'Prescription', 'Patient Sheet'].map((doc, j) => (
                    <div key={doc} className={styles.docRow}>
                      <div className={styles.docIcon}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      <div className={styles.docInfo}>
                        <p className={styles.docName}>{doc}</p>
                        <p className={styles.docStatus}>Generated · PDF ready</p>
                      </div>
                      <span className={styles.docDownload}>↓</span>
                    </div>
                  ))}
                  <div className={styles.docTimer}>
                    <span className={styles.docTimerVal}>28s</span>
                    <span className={styles.docTimerLabel}>total generation time</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* ── Testimonials ── */}
      <section className={styles.testimonialSection}>
        <div className={styles.testimonialInner}>
          <span className={styles.eyebrow}>From doctors across India</span>
          <h2 className={styles.testimonialHeading}>Trusted by practitioners<br />who see 50+ patients daily</h2>
          <div className={styles.testimonialGrid}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} className={styles.testimonialCard}>
                <p className={styles.testimonialQuote}>"{t.quote}"</p>
                <div className={styles.testimonialAuthor}>
                  <div className={styles.testimonialAvatar}>{t.initials}</div>
                  <div>
                    <p className={styles.testimonialName}>{t.name}</p>
                    <p className={styles.testimonialRole}>{t.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Specialties strip ── */}
      <div className={styles.specialtiesStrip}>
        <span className={styles.specialtiesLabel}>Works across</span>
        <div className={styles.specialtiesList}>
          {SPECIALTIES.map(s => (
            <span key={s} className={styles.specialtyPill}>{s}</span>
          ))}
        </div>
      </div>

      {/* ── CTA banner ── */}
      <section className={styles.ctaBanner}>
        <span className={styles.ctaEyebrow}>Built for India</span>
        <h2 className={styles.ctaTitle}>Less time writing.<br />More time with patients.</h2>
        <button className={styles.ctaBtn} onClick={() => navigate('/signup')}>
          Create your clinic — it's free
        </button>
        <p className={styles.ctaNote}>No credit card required</p>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>Chartr</div>
        <p className={styles.footerSub}>Clinical AI · Built for India · en-IN voice recognition</p>
        <div className={styles.footerLinks}>
          <button className={styles.footerLink} onClick={() => navigate('/login')}>Sign in</button>
          <button className={styles.footerLink} onClick={() => navigate('/signup')}>Create account</button>
        </div>
      </footer>

    </div>
  )
}
