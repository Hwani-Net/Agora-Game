import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface TutorialStep {
  title: string;
  desc: string;
  emoji: string;
}

export default function OnboardingOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  const steps: TutorialStep[] = [
    { emoji: '🏛️', title: t('onboarding.steps.welcome.title'), desc: t('onboarding.steps.welcome.desc') },
    { emoji: '🧬', title: t('onboarding.steps.agent.title'), desc: t('onboarding.steps.agent.desc') },
    { emoji: '⚔️', title: t('onboarding.steps.debate.title'), desc: t('onboarding.steps.debate.desc') },
    { emoji: '📈', title: t('onboarding.steps.stock.title'), desc: t('onboarding.steps.stock.desc') },
    { emoji: '🎯', title: t('onboarding.steps.quest.title'), desc: t('onboarding.steps.quest.desc') },
    { emoji: '🚀', title: t('onboarding.steps.ready.title'), desc: t('onboarding.steps.ready.desc') },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  function handleClose() {
    setExiting(true);
    localStorage.setItem('agora_onboarding_done', 'true');
    setTimeout(onClose, 300);
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowRight' && !isLast) setStep(s => s + 1);
      if (e.key === 'ArrowLeft' && step > 0) setStep(s => s - 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isLast]);

  return (
    <div
      className={`onboarding-overlay ${exiting ? 'onboarding-overlay--exit' : ''}`}
      onClick={handleClose}
    >
      <div
        className="onboarding-card card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 500, textAlign: 'center', padding: '2rem' }}
      >
        {/* Skip button */}
        <button
          className="btn btn--ghost btn--sm"
          onClick={handleClose}
          style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', opacity: 0.5 }}
        >
          ✕
        </button>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: i === step ? 'var(--primary)' : 'rgba(128,128,128,0.3)',
                transition: 'all 0.3s ease',
                transform: i === step ? 'scale(1.3)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div
          key={step}
          className="animate-fade-in"
          style={{ minHeight: 180 }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{current.emoji}</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            {current.title}
          </h3>
          <p style={{
            fontSize: '0.95rem',
            lineHeight: 1.7,
            opacity: 0.8,
            whiteSpace: 'pre-line',
          }}>
            {current.desc}
          </p>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          {step > 0 && (
            <button className="btn btn--secondary btn--sm" onClick={() => setStep(step - 1)}>
              ← {t('common.prev')}
            </button>
          )}
          {isLast ? (
            <button className="btn btn--primary btn--lg" onClick={handleClose}>
              {t('onboarding.start_playing')} 🎮
            </button>
          ) : (
            <button className="btn btn--primary btn--sm" onClick={() => setStep(step + 1)}>
              {t('common.next')} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
