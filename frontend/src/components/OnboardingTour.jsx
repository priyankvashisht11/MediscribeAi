import { useState, useEffect, useCallback } from 'react'
import { useDoctorStore } from '../stores/doctorStore'
import { X, ArrowRight, ArrowLeft } from 'lucide-react'
import styles from './OnboardingTour.module.css'

const STEPS = [
  {
    id: 'new-session',
    target: '[data-tour="new-session"]',
    title: 'Start your first session',
    body: "Tap New Session. Chartr will ask for the patient's name, then go straight into recording.",
    placement: 'bottom',
  },
  {
    id: 'speak-naturally',
    target: null,
    icon: '🎙️',
    title: 'Speak naturally',
    body: 'Just talk to your patient like you always do. Chartr listens in the background — Hindi, English, or both. No special commands. No pauses.',
  },
  {
    id: 'live-transcript',
    target: null,
    icon: '📝',
    title: 'Watch the live transcript',
    body: 'Your words appear in real time on the right panel. This is a preview — the final clean transcript is generated when you end the session.',
  },
  {
    id: 'end-session',
    target: null,
    icon: '⏹️',
    title: 'End and get your documents',
    body: 'Press Stop Session when done. In about 20–30 seconds, Chartr generates your SOAP note, prescription, and patient instructions — all at once.',
  },
  {
    id: 'soap-note',
    target: null,
    icon: '🩺',
    title: 'SOAP note — ready to edit',
    body: 'Chartr fills Chief Complaint, History, Examination, Assessment, and Plan. Edit any field before finalising.',
  },
  {
    id: 'prescription',
    target: null,
    icon: '💊',
    title: 'Prescription PDF',
    body: 'Download a branded PDF with your clinic letterhead, doctor name, and medicines with dose and duration. Print or WhatsApp it directly.',
  },
  {
    id: 'patient-sheet',
    target: null,
    icon: '📄',
    title: 'Patient instruction sheet',
    body: "A plain-language sheet for the patient: what to do, what to avoid, when to come back. In English and Hindi.",
  },
  {
    id: 'patients-nav',
    target: '[data-tour="patients-nav"]',
    title: 'Find a past patient',
    body: 'All patients are stored here. Search by name, view their full visit history, and pick up exactly where you left off.',
    placement: 'right',
  },
  {
    id: 'analytics-nav',
    target: '[data-tour="analytics-nav"]',
    title: 'See your practice analytics',
    body: 'Track consultations over time, peak hours, average session length, and top diagnoses.',
    placement: 'right',
  },
]

const PAD = 8

function getKey(doctorId) {
  return `chartr_onboarding_v1_${doctorId}`
}

export default function OnboardingTour() {
  const doctor = useDoctorStore(s => s.doctor)
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (!doctor?.id) return
    const done = localStorage.getItem(getKey(doctor.id))
    if (!done) {
      const t = setTimeout(() => setActive(true), 700)
      return () => clearTimeout(t)
    }
  }, [doctor?.id])

  const currentStep = STEPS[step]

  const updateRect = useCallback(() => {
    if (!currentStep?.target) { setRect(null); return }
    const el = document.querySelector(currentStep.target)
    if (el) {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    } else {
      setRect(null)
    }
  }, [currentStep])

  useEffect(() => {
    if (!active) return
    updateRect()
    const interval = setInterval(updateRect, 150)
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [active, updateRect])

  function complete() {
    if (doctor?.id) localStorage.setItem(getKey(doctor.id), '1')
    setActive(false)
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else complete()
  }

  function prev() {
    if (step > 0) setStep(s => s - 1)
  }

  if (!active) return null

  const isLast = step === STEPS.length - 1
  const hasTarget = !!currentStep.target && rect !== null

  return (
    <div className={styles.root}>
      {hasTarget ? (
        <>
          <div className={styles.panel} style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - PAD) }} onClick={complete} />
          <div className={styles.panel} style={{ top: rect.top - PAD, left: 0, width: Math.max(0, rect.left - PAD), height: rect.height + PAD * 2 }} onClick={complete} />
          <div className={styles.panel} style={{ top: rect.top - PAD, left: rect.left + rect.width + PAD, right: 0, height: rect.height + PAD * 2 }} onClick={complete} />
          <div className={styles.panel} style={{ top: rect.top + rect.height + PAD, left: 0, right: 0, bottom: 0 }} onClick={complete} />
          <div className={styles.spotlight} style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
          <TooltipCard step={currentStep} stepNum={step + 1} total={STEPS.length} rect={rect} onNext={next} onPrev={prev} onSkip={complete} isLast={isLast} />
        </>
      ) : (
        <>
          <div className={styles.fullOverlay} onClick={complete} />
          <ModalCard step={currentStep} stepNum={step + 1} total={STEPS.length} onNext={next} onPrev={prev} onSkip={complete} isLast={isLast} />
        </>
      )}
    </div>
  )
}

function TooltipCard({ step, stepNum, total, rect, onNext, onPrev, onSkip, isLast }) {
  const CARD_W = 288
  const GAP = 10

  let top, left
  if (step.placement === 'right') {
    top = rect.top - PAD
    left = rect.left + rect.width + PAD + GAP
    if (left + CARD_W > window.innerWidth - 12) {
      left = rect.left - PAD - GAP - CARD_W
    }
  } else {
    top = rect.top + rect.height + PAD + GAP
    left = rect.left - PAD
    if (top + 180 > window.innerHeight - 12) {
      top = rect.top - PAD - GAP - 180
    }
  }
  left = Math.max(12, Math.min(left, window.innerWidth - CARD_W - 12))
  top = Math.max(12, top)

  return (
    <div className={styles.tooltip} style={{ top, left, width: CARD_W }} onClick={e => e.stopPropagation()}>
      <CardBody step={step} stepNum={stepNum} total={total} onNext={onNext} onPrev={onPrev} onSkip={onSkip} isLast={isLast} />
    </div>
  )
}

function ModalCard({ step, stepNum, total, onNext, onPrev, onSkip, isLast }) {
  return (
    <div className={styles.modal} onClick={e => e.stopPropagation()}>
      {step.icon && <div className={styles.icon}>{step.icon}</div>}
      <CardBody step={step} stepNum={stepNum} total={total} onNext={onNext} onPrev={onPrev} onSkip={onSkip} isLast={isLast} centered />
    </div>
  )
}

function CardBody({ step, stepNum, total, onNext, onPrev, onSkip, isLast, centered }) {
  return (
    <>
      <div className={styles.cardHeader}>
        <span className={styles.counter}>{stepNum} of {total}</span>
        <button className={styles.closeBtn} onClick={onSkip} aria-label="Skip tour"><X size={14} /></button>
      </div>
      <h3 className={`${styles.title} ${centered ? styles.centered : ''}`}>{step.title}</h3>
      <p className={`${styles.body} ${centered ? styles.centered : ''}`}>{step.body}</p>
      <div className={styles.footer}>
        <div className={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`${styles.dot} ${i === stepNum - 1 ? styles.dotActive : ''}`} />
          ))}
        </div>
        <div className={styles.actions}>
          {stepNum > 1 && (
            <button className={styles.backBtn} onClick={onPrev}>
              <ArrowLeft size={13} /> Back
            </button>
          )}
          <button className={styles.nextBtn} onClick={onNext}>
            {isLast ? 'Done ✓' : <>Next <ArrowRight size={13} /></>}
          </button>
        </div>
      </div>
    </>
  )
}
