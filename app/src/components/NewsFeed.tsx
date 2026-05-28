import { ChevronUp, ChevronDown, Minus } from 'lucide-react';
import type { NewsItem } from '../types';
import { NEWS_CATEGORY_MAP } from '../types';
import { getNewsTitle } from '../services/sosovalue';

interface NewsFeedProps {
  news: NewsItem[];
  loading: boolean;
}

// ─── Sentiment analysis (keyword-based) ──────────────────────────────────
type Sentiment = 'positive' | 'neutral' | 'negative';

const POSITIVE_WORDS = [
  'surges','surge','rises','rise','bullish','inflow','inflows','record','gains','gain',
  'approval','milestone','growth','rally','soars','soar','hits','high','strong','boosts',
  'boost','positive','expands','launch','launches','leading','tops','crosses','adds',
];
const NEGATIVE_WORDS = [
  'falls','fall','drops','drop','bearish','outflow','outflows','decline','declines',
  'loss','crash','crashes','concern','concerns','risk','risks','regulation','ban',
  'warns','warning','lawsuit','sell','selling','weak','tumbles','tumble','slides',
  'retreats','retreat','plunges','plunge','fears','fear',
];

function getSentiment(title: string): Sentiment {
  const lower = title.toLowerCase();
  const pos = POSITIVE_WORDS.filter(w => lower.includes(w)).length;
  const neg = NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

const SENTIMENT_ICONS: Record<Sentiment, React.ElementType> = {
  positive: ChevronUp,
  neutral:  Minus,
  negative: ChevronDown,
};

const SENTIMENT_STYLES: Record<Sentiment, { label: string; color: string; bg: string }> = {
  positive: { label: 'Positive', color: '#34D399', bg: 'rgba(52,211,153,0.1)'  },
  neutral:  { label: 'Neutral',  color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
  negative: { label: 'Negative', color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
};

const CATEGORY_COLORS: Record<number, string> = {
  1: '#60A5FA',  // News — blue
  2: '#A78BFA',  // Research — purple
  3: '#34D399',  // Institution — green
  4: '#94A3B8',  // Insights — gray
  5: '#F59E0B',  // Macro News — amber
  6: '#C084FC',  // Macro Research — violet
  7: '#38BDF8',  // Tweet — sky
  9: '#F87171',  // Price Alert — red
  10: '#4ADE80', // On-Chain — green
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

export function NewsFeed({ news, loading }: NewsFeedProps) {
  return (
    <div
      style={{ background: 'var(--brand-card)', border: '1px solid var(--brand-border)' }}
      className="rounded-xl flex flex-col"
    >
      <div
        style={{ borderBottom: '1px solid var(--brand-border)' }}
        className="px-4 py-3 flex items-center justify-between"
      >
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Market News</h3>
        <span className="text-xs text-slate-500">{news.length} items</span>
      </div>

      <div className="overflow-y-auto max-h-96 divide-y divide-white/5">
        {loading
          ? Array(6).fill(0).map((_, i) => (
              <div key={i} className="p-4 flex gap-3">
                <div className="shimmer h-3 w-12 rounded mt-1 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="shimmer h-3 w-full rounded" />
                  <div className="shimmer h-3 w-2/3 rounded" />
                </div>
              </div>
            ))
          : news.map(item => {
              const title = getNewsTitle(item);
              const categoryColor = CATEGORY_COLORS[item.category] || '#94A3B8';
              const categoryLabel = NEWS_CATEGORY_MAP[item.category] || 'Other';
              const sentiment = getSentiment(title);
              const sentStyle = SENTIMENT_STYLES[sentiment];
              const SentIcon = SENTIMENT_ICONS[sentiment];
              return (
                <a
                  key={item.id}
                  href={item.sourceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-4 hover:bg-white/5 transition-colors group"
                >
                  <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5 min-w-16">
                    <span
                      style={{ color: categoryColor, background: `${categoryColor}20`, border: `1px solid ${categoryColor}40` }}
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                    >
                      {categoryLabel}
                    </span>
                    {/* Sentiment badge */}
                    <span
                      style={{ color: sentStyle.color, background: sentStyle.bg }}
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold flex items-center gap-0.5"
                    >
                      <SentIcon size={10} />
                      {sentStyle.label}
                    </span>
                    <span className="text-xs text-slate-600">{timeAgo(item.releaseTime)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 group-hover:text-white transition-colors line-clamp-2 leading-snug">
                      {title}
                    </p>
                    {item.tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {item.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-xs text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </a>
              );
            })
        }
      </div>
    </div>
  );
}
