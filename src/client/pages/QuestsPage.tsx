import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchQuests } from '../api.js';
import { useAuthContext } from '../AuthContext.js';
import { useToast } from '../ToastContext.js';
import { supabase } from '../supabase.js';
import QuestProgressBar from '../components/QuestProgressBar.js';

interface Quest {
  id: string;
  type: string;
  title: string;
  description: string;
  reward_gold: number;
  status: string;
  created_at: string;
}

// Map DB Korean titles to i18n keys
const QUEST_TITLE_MAP: Record<string, string> = {
  "첫 토론 관전": "watch_debate",
  "에이전트 응원": "cheer_agent",
  "신규 에이전트 생성": "create_agent",
  "주식 첫 거래": "first_trade",
};

// Quest completion conditions
const QUEST_TARGETS: Record<string, number> = {
  watch_debate: 1,
  cheer_agent: 1,
  create_agent: 1,
  first_trade: 1,
};

export default function QuestsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthContext();
  const { pushToast } = useToast();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'daily' | 'bounty'>('all');
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    loadQuests();
  }, [filter]);

  useEffect(() => {
    if (user) checkProgress();
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
  async function checkProgress() {
    if (!user) return;
    const prog: Record<string, number> = {};

    try {
      // Check create_agent: how many agents user created
      const { count: agentCount } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user.id);
      prog.create_agent = agentCount ?? 0;

      // Check first_trade: any stock ownership entries
      const { count: tradeCount } = await supabase
        .from('stock_ownership')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      prog.first_trade = tradeCount ?? 0;

      // watch_debate: check if user viewed any debate today (approximate: any debate exists)
      const { count: debateCount } = await supabase
        .from('debates')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0]);
      prog.watch_debate = debateCount && debateCount > 0 ? 1 : 0;

      // cheer_agent: count user's cheers from agent_cheers table
      const { count: cheerCount } = await supabase
        .from('agent_cheers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      prog.cheer_agent = cheerCount ?? 0;

    } catch {
      // Silently fail — progress stays at 0
    }

    setProgress(prog);
  }

  const handleClaim = useCallback(async (quest: Quest) => {
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
          {quests.map((quest) => {
            const questKey = QUEST_TITLE_MAP[quest.title];
            const title = questKey ? t(`quests.items.${questKey}.title`) : quest.title;
            const description = questKey ? t(`quests.items.${questKey}.desc`) : quest.description;
            const target = questKey ? (QUEST_TARGETS[questKey] ?? 1) : 1;
            const current = questKey ? (progress[questKey] ?? 0) : 0;
            const isComplete = current >= target;
            const isAlreadyClaimed = quest.status === 'completed';

            return (
              <div
                key={quest.id}
                className={`card${isAlreadyClaimed ? ' quest-card--completed' : ''}`}
              >
                <div className="quest-card__header">
                  <div className="quest-card__title-group">
                    <span className="quest-card__icon">{quest.type === 'daily' ? '🎯' : '💰'}</span>
                    <h3 className="quest-card__title">{title}</h3>
                  </div>
                  <div className="quest-card__meta">
                    {statusBadge(quest.status)}
                    <span className="quest-card__reward">
                      {quest.reward_gold.toLocaleString()} G
                    </span>
                  </div>
                </div>
                <p className="quest-card__desc">
                  {description}
                </p>

                {/* ─── Progress Bar ─── */}
                {user && !isAlreadyClaimed && (
                  <QuestProgressBar
                    current={Math.min(current, target)}
                    target={target}
                    isComplete={isComplete}
                  />
                )}

                {/* ─── Claim Button ─── */}
                {user && isComplete && !isAlreadyClaimed && (
                  <button
                    className="quest-claim-btn"
                    onClick={() => handleClaim(quest)}
                    disabled={claiming === quest.id}
                  >
                    {claiming === quest.id ? t('common.loading') : t('quests.claim_reward')}
                  </button>
                )}

                <div className="quest-card__date">
                  {new Date(quest.created_at).toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
