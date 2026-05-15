import { useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.css'

const FEATURES = [
  {
    icon: '🎙️',
    title: 'Ambient Recording',
    desc: 'Listens in the background during consultation. No tapping, no dictating.',
  },
  {
    icon: '📋',
    title: 'SOAP Notes in Seconds',
    desc: 'AI generates a structured clinical note the moment the session ends.',
  },
  {
    icon: '💊',
    title: 'Prescription & Patient Sheet',
    desc: 'Download a prescription PDF or a patient-friendly instruction sheet with one click.',
  },
  {
    icon: '📊',
    title: 'Practice Analytics',
    desc: 'See session volumes, top diagnoses, and ICD-10 trends across your clinic.',
  },
]

const HOW_IT_WORKS = [
  { step: '1', title: 'Sign up your clinic', desc: 'Create an account in under a minute. Invite your team with a link.' },
  { step: '2', title: 'Start a session', desc: 'Select the patient, hit record. Speak naturally — MediScribe handles the rest.' },
  { step: '3', title: 'Review and sign', desc: 'Edit the AI-generated SOAP note, finalize, and download PDFs.' },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navBrand}>MediScribe</div>
        <div className={styles.navActions}>
          <button className={styles.navLink} onClick={() => navigate('/login')}>Sign in</button>
          <button className={styles.navCta} onClick={() => navigate('/signup')}>Get started free</button>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>Clinical AI for Indian Doctors</div>
        <h1 className={styles.heroTitle}>
          Your patients talk.<br />
          MediScribe writes.
        </h1>
        <p className={styles.heroSub}>
          Ambient AI scribe that listens to your consultations and generates
          SOAP notes, prescriptions, and patient sheets — in under 30 seconds.
        </p>
        <div className={styles.heroCtas}>
          <button className={styles.btnPrimary} onClick={() => navigate('/signup')}>
            Create your clinic →
          </button>
          <button className={styles.btnGhost} onClick={() => navigate('/login')}>
            Sign in
          </button>
        </div>
        <p className={styles.heroNote}>No credit card. No setup fee. Works on any device.</p>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Everything you need. Nothing you don't.</h2>
        <div className={styles.featureGrid}>
          {FEATURES.map(f => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className={styles.howSection}>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <div className={styles.howGrid}>
          {HOW_IT_WORKS.map(h => (
            <div key={h.step} className={styles.howCard}>
              <div className={styles.howStep}>{h.step}</div>
              <h3 className={styles.howTitle}>{h.title}</h3>
              <p className={styles.howDesc}>{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className={styles.ctaBanner}>
        <h2 className={styles.ctaTitle}>Ready to spend less time writing, more time with patients?</h2>
        <button className={styles.btnPrimary} onClick={() => navigate('/signup')}>
          Create your clinic — it's free
        </button>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>MediScribe</div>
        <p className={styles.footerSub}>Clinical AI · Built for India · en-IN voice recognition</p>
        <div className={styles.footerLinks}>
          <button className={styles.footerLink} onClick={() => navigate('/login')}>Sign in</button>
          <button className={styles.footerLink} onClick={() => navigate('/signup')}>Create account</button>
        </div>
      </footer>
    </div>
  )
}
