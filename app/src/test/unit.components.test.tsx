/**
 * Example-based unit tests — UI components
 * Feature: etfsignal-hackathon
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WalletGate } from '../components/WalletGate';
import { TradeModal } from '../components/TradeModal';
import { SignalPanel } from '../components/SignalPanel';
import type { MarketSignal, SignalDirection } from '../types';

// ─── Shared test fixtures ─────────────────────────────────────────────────────

function makeSignal(direction: SignalDirection): MarketSignal {
  return {
    direction,
    confidence: 75,
    headline: 'Test headline for unit test',
    summary: 'Test summary with specific numbers like $500M inflows.',
    keyFactors: ['Factor one', 'Factor two', 'Factor three'],
    tradeIdea: 'Long BTC on SoDEX testnet above $95k.',
    riskWarning: 'Fed policy may reverse this thesis.',
    entryZone: { low: 94000, high: 96000 },
    takeProfit: { price: 102000, pct: 7.5, rationale: 'ATH resistance zone' },
    stopLoss: { price: 90000, pct: -4.2, rationale: 'Prior consolidation support' },
    timestamp: new Date('2024-01-01T12:00:00Z'),
  };
}

const noop = () => {};
const asyncNoop = async () => {};

// ─── 18.1: WalletGate ────────────────────────────────────────────────────────
// Validates: Requirements 10.1, 10.2

describe('WalletGate', () => {
  it('renders lock screen and does not render children when connected=false', () => {
    render(
      <WalletGate connected={false} onConnect={noop}>
        <span>protected content</span>
      </WalletGate>,
    );

    expect(screen.getByText('Connect Wallet to Continue')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders children and hides lock screen when connected=true', () => {
    render(
      <WalletGate connected={true} onConnect={noop}>
        <span>protected content</span>
      </WalletGate>,
    );

    expect(screen.getByText('protected content')).toBeInTheDocument();
    expect(screen.queryByText('Connect Wallet to Continue')).not.toBeInTheDocument();
  });

  it('calls onConnect when the connect button is clicked', () => {
    const onConnect = vi.fn();
    render(
      <WalletGate connected={false} onConnect={onConnect}>
        <span>protected content</span>
      </WalletGate>,
    );

    fireEvent.click(screen.getByText('Connect Wallet to Continue'));
    expect(onConnect).toHaveBeenCalledOnce();
  });
});

// ─── 18.2: TradeModal ─────────────────────────────────────────────────────────
// Validates: Requirements 9.2, 9.7

describe('TradeModal', () => {
  const defaultProps = {
    signal: makeSignal('BULLISH'),
    side: 'BUY' as const,
    symbol: 'BTC-USDT',
    onConfirm: asyncNoop,
    onClose: noop,
  };

  it('confirm button is disabled before the acknowledgment checkbox is checked', () => {
    render(<TradeModal {...defaultProps} />);

    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('confirm button becomes enabled after checking the acknowledgment checkbox', () => {
    render(<TradeModal {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('confirm button is disabled again when acknowledgment checkbox is unchecked', () => {
    render(<TradeModal {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox); // check
    fireEvent.click(checkbox); // uncheck

    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('displays "Testnet" text prominently (Requirement 9.7)', () => {
    render(<TradeModal {...defaultProps} />);

    // "Testnet" appears in multiple places: the header subtitle, the risk paragraph,
    // and the acknowledgment text. Use getAllByText since multiple matches are expected.
    const testnetElements = screen.getAllByText(/testnet/i);
    expect(testnetElements.length).toBeGreaterThan(0);
  });

  it('works correctly for a SELL (Short) order', () => {
    render(<TradeModal {...defaultProps} side="SELL" signal={makeSignal('BEARISH')} />);

    expect(screen.getByText(/short/i, { selector: 'div.font-semibold' })).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    expect(confirmBtn).toBeDisabled();
  });
});

// ─── 18.3: SignalPanel ────────────────────────────────────────────────────────
// Validates: Requirements 3.8

describe('SignalPanel', () => {
  const defaultProps = {
    loading: false,
    onAnalyze: noop,
    activeTab: 'btc' as const,
    onTrade: noop,
    walletConnected: false,
    error: null,
  };

  it('renders "Not financial advice" for a BULLISH signal', () => {
    render(<SignalPanel {...defaultProps} signal={makeSignal('BULLISH')} />);
    expect(screen.getByText('Not financial advice')).toBeInTheDocument();
  });

  it('renders "Not financial advice" for a BEARISH signal', () => {
    render(<SignalPanel {...defaultProps} signal={makeSignal('BEARISH')} />);
    expect(screen.getByText('Not financial advice')).toBeInTheDocument();
  });

  it('renders "Not financial advice" for a NEUTRAL signal', () => {
    render(<SignalPanel {...defaultProps} signal={makeSignal('NEUTRAL')} />);
    expect(screen.getByText('Not financial advice')).toBeInTheDocument();
  });

  it('renders loading spinner and "Synthesizing signal..." when loading=true', () => {
    render(<SignalPanel {...defaultProps} signal={null} loading={true} />);
    expect(screen.getByText('Synthesizing signal…')).toBeInTheDocument();
  });

  it('renders error state and Retry button when error is set', () => {
    render(
      <SignalPanel
        {...defaultProps}
        signal={null}
        error="Claude API error: 500"
      />,
    );

    expect(screen.getByText('Claude API error: 500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders "Connect wallet to execute on SoDEX testnet" when wallet is not connected', () => {
    render(
      <SignalPanel {...defaultProps} signal={makeSignal('BULLISH')} walletConnected={false} />,
    );

    expect(screen.getByText(/connect wallet to execute/i)).toBeInTheDocument();
  });
});
