/**
 * Centralized branding configuration for ETFSignalAI's AI identity: "The Agent".
 * Underlying model integration remains Google Gemini (via /api/analyze).
 */

export const AGENT_BRANDING = {
  name: 'The Agent',
  subtitle: 'AI Market Intelligence',
  fullTitle: 'The Agent · AI Market Intelligence',
  askTitle: 'Ask The Agent',
  analysisLabel: 'Agent Analysis',
  insightsLabel: 'Agent Market Intelligence',
  signalsLabel: 'The Agent Signals',
  welcomeMessage:
    "Hi! I'm The Agent, ETFSignalAI's market intelligence assistant. I analyze institutional ETF flows, market trends, and trading signals to help you make more informed decisions.",
} as const;
