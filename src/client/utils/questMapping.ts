
export const QUEST_ID_MAP: Record<string, string> = {
  daily_trade: 'quests.daily_trade_title',
  daily_debate: 'quests.daily_debate_title',
  first_win: 'quests.first_win_title',
};

export function getQuestTitleKey(questId: string): string {
  return QUEST_ID_MAP[questId] || 'quests.unknown_quest';
}
