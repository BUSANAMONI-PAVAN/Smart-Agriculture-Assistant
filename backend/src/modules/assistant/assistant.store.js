const chatHistoryStore = new Map();

export function saveAssistantTurn(userId = 'anonymous', turn = {}) {
  const rows = chatHistoryStore.get(userId) || [];
  rows.unshift({
    id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
    question: String(turn.question || ''),
    answer: String(turn.answer || ''),
    confidence: Number(turn.confidence || 0),
    createdAt: new Date().toISOString(),
  });
  chatHistoryStore.set(userId, rows.slice(0, 40));
}

export function getAssistantHistory(userId = 'anonymous') {
  return chatHistoryStore.get(userId) || [];
}
