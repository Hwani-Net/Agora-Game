import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchQuests, createBountyQuest } from '../api.js';
import { useAuthContext } from '../AuthContext.js';
import { useToast } from '../ToastContext.js';
import { supabase } from '../supabase.js';
import QuestProgressBar from '../components/QuestProgressBar.js';
import BountySubmissions from '../components/BountySubmissions.js';

interface Quest {
  id: string;
  type: string;
  title: string;
  description: string;
  reward_gold: number;
  status: string;
  created_at: string;
  creator_id?: string;
}

import { getQuestTitleKey } from '../utils/questMapping.js';

interface UserQuest {
  id: string;
  quest_id: string;
  progress: number;
  target: number;
  status: 'in_progress' | 'completed' | 'claimed';
  updated_at: string;
}

// Fixed Daily Quests Definition (for display info)
const DAILY_QUEST_DEFS: Record<string, { reward: number; icon: string }> = {
  daily_trade: { reward: 100, icon: '📈' },
  daily_debate: { reward: 50, icon: '🗳️' },
  first_win: { reward: 500, icon: '🏆' },
};


export default function QuestsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthContext();
  const { pushToast } = useToast();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'daily' | 'bounty'>('all');
  const [userQuests, setUserQuests] = useState<UserQuest[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [expandedQuestId, setExpandedQuestId] = useState<string | null>(null);

  // ─── Bounty Modal State ───
  const [showBountyModal, setShowBountyModal] = useState(false);
  const [bountyForm, setBountyForm] = useState({
    title: '',
    description: '',
    reward_gold: 100,
    difficulty: 'Normal',
    deadline_hours: 48,
  });
  const [bountySubmitting, setBountySubmitting] = useState(false);

  useEffect(() => {
    loadQuests();
  }, [filter]);

  useEffect(() => {
    if (user) fetchUserQuests();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ─── Realtime: Auto-detect quest progress ───
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('quest-page-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_quests', filter: `user_id=eq.${user.id}` }, () => {
        fetchUserQuests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quests' }, () => {
        loadQuests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadQuests() {
    setLoading(true);
    try {
      const data = await fetchQuests(filter === 'all' ? undefined : filter);
      setQuests(Array.isArray(data) ? (data as Quest[]) : []);
    } catch {
      setQuests([]);
    } finally {
      setLoading(false);
    }
  }

  // Check quest progress from DB
  async function fetchUserQuests() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_quests')
        .select('*')
        .eq('user_id', user.id);
      
      if (!error && data) {
        setUserQuests(data as UserQuest[]);
      }
    } catch {
      // ignore
    }
  }

  const handleDailyClaim = useCallback(async (uq: UserQuest) => {
    if (!user || claiming) return;
    setClaiming(uq.id);
    const def = DAILY_QUEST_DEFS[uq.quest_id];
    if (!def) return;

    try {
      // 1. Update user_quests status to 'claimed'
      const { error } = await supabase
        .from('user_quests')
        .update({ status: 'claimed', claimed_at: new Date().toISOString() })
        .eq('id', uq.id);
      
      if (error) throw error;

      // 2. Grant gold
      await supabase.from('gold_transactions').insert({
        user_id: user.id,
        amount: def.reward,
        type: 'quest_reward',
        description: `Daily Quest: ${uq.quest_id}`,
      });

      await supabase.rpc('add_gold', {
        p_user_id: user.id,
        p_amount: def.reward,
      });

      pushToast(t('quests.reward_claimed', { gold: def.reward }), 'success');
      fetchUserQuests();
    } catch {
      pushToast(t('common.error'), 'error');
    } finally {
      setClaiming(null);
    }
  }, [user, claiming, pushToast, t]);

  // Bounty Claim logic... (Needs refactoring if bounty flow is different, but keeping as is for backward compat)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleClaim = useCallback(async (quest: Quest) => {
    // ... Existing implementation for quests table ...
    if (!user || claiming) return;
    setClaiming(quest.id);
    try {
      // Update quest status in DB
      await supabase
        .from('quests')
        .update({ status: 'completed' })
        .eq('id', quest.id);

      // Grant gold reward
      await supabase
        .from('gold_transactions')
        .insert({
          user_id: user.id,
          amount: quest.reward_gold,
          type: 'quest_reward',
          description: `Quest: ${quest.title}`,
        });

      // Update user gold balance
      await supabase.rpc('add_gold', {
        p_user_id: user.id,
        p_amount: quest.reward_gold,
      });

      pushToast(t('quests.reward_claimed', { gold: quest.reward_gold }), 'success');
      loadQuests();
    } catch {
      pushToast(t('common.error'), 'error');
    } finally {
      setClaiming(null);
    }
  }, [user, claiming, pushToast, t]);

  // ─── Bounty Quest Creation ───
  async function handleBountySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (bountySubmitting) return;

    const goldBalance = user?.gold_balance ?? 0;
    if (bountyForm.reward_gold < 100) {
      pushToast(t('quests.bounty_form.min_reward'), 'error');
      return;
    }
    if (bountyForm.reward_gold > goldBalance) {
      pushToast(t('quests.bounty_form.not_enough_gold'), 'error');
      return;
    }

    setBountySubmitting(true);
    try {
      await createBountyQuest(bountyForm);
      pushToast(t('quests.bounty_form.success'), 'success');
      setShowBountyModal(false);
      setBountyForm({ title: '', description: '', reward_gold: 100, difficulty: 'Normal', deadline_hours: 48 });
      loadQuests();
    } catch {
      pushToast(t('quests.bounty_form.error'), 'error');
    } finally {
      setBountySubmitting(false);
    }
  }

  function statusBadge(status: string) {
    const statusLabel = t(`quests.status.${status}`, { defaultValue: status });
    return (
      <span className={`quest-badge quest-badge--${status}`}>
        {statusLabel}
      </span>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-header__title">{t('quests.title')}</h2>
          <p className="section-header__subtitle">{t('quests.subtitle')}</p>
        </div>
        {user && (
          <button
            className="btn btn--primary btn--sm"
            onClick={() => setShowBountyModal(true)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {t('quests.create_bounty')}
          </button>
        )}
      </div>

      {/* ─── Filter ─── */}
      <div className="quest-filters">
        {[
          { key: 'all' as const, label: t('quests.filters.all') },
          { key: 'daily' as const, label: t('quests.filters.daily') },
          { key: 'bounty' as const, label: t('quests.filters.bounty') },
        ].map((f) => (
          <button
            key={f.key}
            className={`btn ${filter === f.key ? 'btn--primary' : 'btn--secondary'} btn--sm`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-center">
          <div className="spinner" />
        </div>
      ) : quests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📋</div>
          <div className="empty-state__title">{t('quests.messages.no_quests')}</div>
          <p>{t('quests.messages.quest_hint')}</p>
        </div>
      ) : (
        <div className="quest-list">
          {/* 1. Daily Quests from user_quests */}
          {(filter === 'all' || filter === 'daily') && userQuests.map((uq) => {
             const def = DAILY_QUEST_DEFS[uq.quest_id];
             if (!def) return null; // Skip unknown
             const titleKey = getQuestTitleKey(uq.quest_id);
             const isComplete = uq.progress >= uq.target || uq.status === 'completed';
             const isClaimed = uq.status === 'claimed'; // DB status

             return (
              <div key={uq.id} className={`card quest-card${isClaimed ? ' quest-card--completed' : ''}`}>
                 <div className="quest-card__header">
                   <div className="quest-card__title-group">
                     <span className="quest-card__icon">{def.icon}</span>
                     <h3 className="quest-card__title">{t(titleKey)}</h3>
                   </div>
                   <div className="quest-card__meta">
                     {statusBadge(uq.status)}
                     <span className="quest-card__reward">{def.reward} G</span>
                   </div>
                 </div>
                 <p className="quest-card__desc">{t(`quests.desc_${uq.quest_id}`, { defaultValue: t(titleKey) })}</p>
                 
                 {user && !isClaimed && (
                   <QuestProgressBar current={uq.progress} target={uq.target} isComplete={isComplete} />
                 )}

                 {user && isComplete && !isClaimed && (
                   <button
                     className="quest-claim-btn"
                     onClick={() => handleDailyClaim(uq)}
                     disabled={claiming === uq.id}
                   >
                     {claiming === uq.id ? t('common.loading') : t('quests.claim_reward')}
                   </button>
                 )}
              </div>
             );
          })}

          {/* 2. Bounty Quests from quests table */}
          {(filter === 'all' || filter === 'bounty') && quests.filter(q => q.type === 'bounty').map((quest) => {
            const isOwner = user?.id === quest.creator_id;
            // Bounty logic remains same
            return (
              <div
                key={quest.id}
                className={`card quest-card${quest.status === 'completed' ? ' quest-card--completed' : ''}`}
                onClick={() => setExpandedQuestId(expandedQuestId === quest.id ? null : quest.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="quest-card__header">
                  <div className="quest-card__title-group">
                    <span className="quest-card__icon">💰</span>
                    <h3 className="quest-card__title">{quest.title}</h3>
                  </div>
                  <div className="quest-card__meta">
                    {statusBadge(quest.status)}
                    <span className="quest-card__reward">{quest.reward_gold.toLocaleString()} G</span>
                  </div>
                </div>
                <p className="quest-card__desc">{quest.description}</p>
                <div className="quest-card__date">
                  {new Date(quest.created_at).toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US')}
                </div>

                {/* Restore Claim Button for Bounty if needed (e.g. self-claim type) */}
                {user && quest.status === 'open' && isOwner && (
                   <button
                     className="quest-claim-btn"
                     onClick={(e) => { e.stopPropagation(); handleClaim(quest); }}
                     disabled={claiming === quest.id}
                     style={{ marginTop: 8 }}
                   >
                     {claiming === quest.id ? t('common.loading') : t('quests.claim_reward')}
                   </button>
                )}

                {expandedQuestId === quest.id && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <BountySubmissions questId={quest.id} isOwner={isOwner} onUpdate={loadQuests} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Bounty Creation Modal ─── */}
      {showBountyModal && (
        <div className="modal-overlay" onClick={() => setShowBountyModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ marginBottom: '1rem' }}>{t('quests.bounty_form.title')}</h3>
            <form onSubmit={handleBountySubmit}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  {t('quests.bounty_form.quest_title')}
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t('quests.bounty_form.quest_title_placeholder')}
                  value={bountyForm.title}
                  onChange={(e) => setBountyForm({ ...bountyForm, title: e.target.value })}
                  required
                  minLength={5}
                  maxLength={100}
                />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  {t('quests.bounty_form.quest_desc')}
                </label>
                <textarea
                  className="form-input"
                  placeholder={t('quests.bounty_form.quest_desc_placeholder')}
                  value={bountyForm.description}
                  onChange={(e) => setBountyForm({ ...bountyForm, description: e.target.value })}
                  required
                  minLength={10}
                  maxLength={500}
                  rows={3}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>
                    {t('quests.bounty_form.reward')}
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    min={100}
                    max={10000}
                    step={50}
                    value={bountyForm.reward_gold}
                    onChange={(e) => setBountyForm({ ...bountyForm, reward_gold: Number(e.target.value) })}
                    required
                  />
                  <small style={{ opacity: 0.7, fontSize: '0.75rem' }}>{t('quests.bounty_form.min_reward')}</small>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>
                    {t('quests.bounty_form.difficulty')}
                  </label>
                  <select
                    className="form-input"
                    value={bountyForm.difficulty}
                    onChange={(e) => setBountyForm({ ...bountyForm, difficulty: e.target.value })}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Normal">Normal</option>
                    <option value="Hard">Hard</option>
                    <option value="Insane">Insane</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  {t('quests.bounty_form.deadline')}
                </label>
                <select
                  className="form-input"
                  value={bountyForm.deadline_hours}
                  onChange={(e) => setBountyForm({ ...bountyForm, deadline_hours: Number(e.target.value) })}
                >
                  <option value={24}>{t('quests.bounty_form.deadline_24h')}</option>
                  <option value={48}>{t('quests.bounty_form.deadline_48h')}</option>
                  <option value={72}>{t('quests.bounty_form.deadline_72h')}</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setShowBountyModal(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn--primary btn--sm" disabled={bountySubmitting}>
                  {bountySubmitting ? t('common.loading') : t('quests.bounty_form.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

