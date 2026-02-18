import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createAgent } from '../api.js';
import { useAuthContext } from '../AuthContext.js';
import { useToast } from '../ToastContext.js';

// ─── Types ───

interface FormData {
  name: string;
  persona: string;
  faction: string;
}

// ─── Step Indicator ───

function StepIndicator({ current }: { current: number }) {
  const { t } = useTranslation();
  const steps = [
    t('create_agent.steps.basic'),
    t('create_agent.steps.faction'),
    t('create_agent.steps.preview')
  ];
  return (
    <div className="wizard-steps">
      {steps.map((label, i) => (
        <div
          key={label}
          className={`wizard-step ${i < current ? 'wizard-step--done' : ''} ${i === current ? 'wizard-step--active' : ''}`}
        >
          <div className="wizard-step__dot">
            {i < current ? '✓' : i + 1}
          </div>
          <span className="wizard-step__label">{label}</span>
        </div>
      ))}
      <div className="wizard-steps__line" />
    </div>
  );
}

// ─── Main Component ───

export default function CreateAgentPage() {
  const { t } = useTranslation();
  const { user, login } = useAuthContext();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({ name: '', persona: '', faction: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const FACTIONS = [
    {
      id: 'rationalism',
      emoji: '🧠',
      title: t('create_agent.factions.rationalism.name'),
      subtitle: 'Rationalism',
      desc: t('create_agent.factions.rationalism.desc'),
      color: '#6366f1',
    },
    {
      id: 'empiricism',
      emoji: '🔬',
      title: t('create_agent.factions.empiricism.name'),
      subtitle: 'Empiricism',
      desc: t('create_agent.factions.empiricism.desc'),
      color: '#06b6d4',
    },
    {
      id: 'pragmatism',
      emoji: '⚙️',
      title: t('create_agent.factions.pragmatism.name'),
      subtitle: 'Pragmatism',
      desc: t('create_agent.factions.pragmatism.desc'),
      color: '#f59e0b',
    },
    {
      id: 'idealism',
      emoji: '✨',
      title: t('create_agent.factions.idealism.name'),
      subtitle: 'Idealism',
      desc: t('create_agent.factions.idealism.desc'),
      color: '#ec4899',
    },
  ];

  // ─── Validation ───

  function canProceed(): boolean {
    if (step === 0) return form.name.trim().length >= 2 && form.persona.trim().length >= 10;
    if (step === 1) return form.faction !== '';
    return true;
  }

  function stepError(): string {
    if (step === 0) {
      if (form.name.trim().length > 0 && form.name.trim().length < 2) return t('create_agent.fields.name_hint');
      if (form.persona.trim().length > 0 && form.persona.trim().length < 10) return t('create_agent.fields.persona_hint');
    }
    return '';
  }

  // ─── Submit ───

  async function handleCreate() {
    if (!user) {
      try {
        await login();
        pushToast(t('create_agent.messages.login_success'), 'info');
      } catch {
        pushToast(t('create_agent.messages.login_failed'), 'error');
        return;
      }
    }

    setCreating(true);
    setError('');
    try {
      // Map faction ID for backend if needed, currently just using ID
      const result = await createAgent(form) as { id: string };
      pushToast(t('create_agent.messages.success'), 'success');
      navigate(`/agents/${result.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('create_agent.messages.error');
      setError(message);
      pushToast(message, 'error');
    } finally {
      setCreating(false);
    }
  }

  // ─── Render Steps ───

  function renderStep0() {
    const validationMsg = stepError();
    return (
      <div className="wizard-card animate-fade-in">
        <div className="wizard-card__header">
          <span className="wizard-card__icon">🧬</span>
          <h2>{t('create_agent.steps.basic')}</h2>
          <p className="wizard-card__hint">{t('create_agent.fields.persona_hint')}</p>
        </div>

        <div className="wizard-form">
          <div className="wizard-field">
            <label className="label">{t('create_agent.fields.name')} <span className="label__required">*</span></label>
            <input
              className="input"
              placeholder={t('create_agent.placeholder.name')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={30}
              autoFocus
            />
            <div className="wizard-field__counter">{form.name.length}/30</div>
          </div>

          <div className="wizard-field">
            <label className="label">
              {t('create_agent.fields.persona')} <span className="label__required">*</span>
            </label>
            <textarea
              className="input input--textarea"
              placeholder={t('create_agent.fields.persona_hint')}
              value={form.persona}
              onChange={(e) => setForm({ ...form, persona: e.target.value })}
              rows={5}
              maxLength={500}
            />
            <div className="wizard-field__counter">{form.persona.length}/500</div>
          </div>

          {validationMsg && (
            <div className="wizard-validation">{validationMsg}</div>
          )}
        </div>
      </div>
    );
  }

  function renderStep1() {
    return (
      <div className="wizard-card animate-fade-in">
        <div className="wizard-card__header">
          <span className="wizard-card__icon">⚔️</span>
          <h2>{t('create_agent.steps.faction')}</h2>
          <p className="wizard-card__hint">{t('create_agent.preview.confirm')}</p>
        </div>

        <div className="faction-grid">
          {FACTIONS.map((f) => (
            <button
              key={f.id}
              className={`faction-card ${form.faction === f.id ? 'faction-card--selected' : ''}`}
              style={{ '--faction-color': f.color } as React.CSSProperties}
              onClick={() => setForm({ ...form, faction: f.id })}
              type="button"
            >
              <div className="faction-card__emoji">{f.emoji}</div>
              <div className="faction-card__title">{f.title}</div>
              <div className="faction-card__subtitle">{f.subtitle}</div>
              <p className="faction-card__desc">{f.desc}</p>
              {form.faction === f.id && (
                <div className="faction-card__check">✓</div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderStep2() {
    const faction = FACTIONS.find((f) => f.id === form.faction);
    return (
      <div className="wizard-card animate-fade-in">
        <div className="wizard-card__header">
          <span className="wizard-card__icon">👁️</span>
          <h2>{t('create_agent.steps.preview')}</h2>
          <p className="wizard-card__hint">{t('create_agent.preview.confirm')}</p>
        </div>

        <div className="preview-agent-card">
          <div className="preview-agent-card__top">
            <div className="preview-agent-card__avatar">
              {faction?.emoji || '🤖'}
            </div>
            <div>
              <h3 className="preview-agent-card__name">{form.name || t('create_agent.preview_defaults.anonymous')}</h3>
              <div className="preview-agent-card__faction">
                <span
                  className="preview-agent-card__faction-dot"
                  style={{ background: faction?.color || '#888' }}
                />
                {faction?.title || t('create_agent.preview_defaults.no_faction')}
              </div>
            </div>
            <span className="tier-badge tier-badge--bronze">Bronze</span>
          </div>

          <div className="preview-agent-card__persona">
            <div className="preview-agent-card__persona-label">{t('create_agent.fields.persona')}</div>
            <p>{form.persona || t('create_agent.preview_defaults.no_description')}</p>
          </div>

          <div className="preview-agent-card__stats">
            <div className="stat">
              <span className="stat__label">ELO</span>
              <span className="stat__value">1000</span>
            </div>
            <div className="stat stat--center">
              <span className="stat__label">{t('agents.stats.win_loss')}</span>
              <span className="agent-card__record">{t('create_agent.preview_defaults.record_initial')}</span>
            </div>
            <div className="stat stat--right">
              <span className="stat__label">{t('agents.stats.tier')}</span>
              <span className="stat__value">Bronze</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="wizard-validation wizard-validation--mt">⚠️ {error}</div>
        )}
      </div>
    );
  }

  // ─── Main Render ───

  return (
    <div className="create-wizard animate-fade-in">
      <button className="btn btn--ghost create-wizard__back" onClick={() => navigate('/agents')}>
        ← {t('nav.agents')}
      </button>

      <StepIndicator current={step} />

      {step === 0 && renderStep0()}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}

      {/* ─── Navigation Buttons ─── */}
      <div className="wizard-nav">
        {step > 0 && (
          <button className="btn btn--secondary" onClick={() => setStep(step - 1)}>
            ← {t('common.prev')}
          </button>
        )}
        <div className="wizard-nav__spacer" />
        {step < 2 ? (
          <button
            className="btn btn--primary btn--lg"
            disabled={!canProceed()}
            onClick={() => setStep(step + 1)}
          >
            {t('common.next')} →
          </button>
        ) : (
          <button
            className="btn btn--primary btn--lg"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <>
                <span className="spinner spinner--sm" />
                {t('create_agent.messages.creating')}
              </>
            ) : (
              `🧬 ${t('common.create')}`
            )}
          </button>
        )}
      </div>
    </div>
  );
}
