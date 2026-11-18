import {
  useState, useEffect, useCallback, useMemo, useRef,
  type ReactNode,
} from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { getSigner } from '@dynamic-labs/ethers-v6';
import type { JsonRpcSigner } from 'ethers';
import {
  fetchEtfMetrics, fetchNews, fetchHistoricalInflows, fetchPriceHistory,
  fetchSignalHistory,
} from '../services/sosovalue';
import { saveSignal, evaluatePendingSignals } from '../services/signalArchive';
import { getProfile } from '../services/profile';
import { getSeenAlertIds, markAlertsSeen } from '../services/alertsSeen';
import { deriveAlerts } from '../services/alerts';
import type { HistoricalInflow, PricePoint } from '../types';
import { computeSentiment } from '../services/sentiment';
import {
  analyzeMarket,
  getAiCircuitState,
  resetAiCircuitBreaker,
  type AnalysisStage,
} from '../services/ai';
import { placeSpotOrder, placePerpsOrder } from '../services/sodex';
import { ACTIVE_VALUECHAIN, getChainDisplayName, parseChainIdValue } from '../config/valuechain';
import {
  ensureWalletOnValueChain,
  getWalletChainId,
  isWalletLockedError,
  resolveConnectedProvider,
  WalletLockedError,
  WALLET_LOCKED_MESSAGE,
  type DynamicWalletLike,
} from '../services/walletNetwork';
import { notifyTelegramSubscribers, notifyTelegramTrade } from '../services/telegram';
import { saveTrade, getTradeHistory } from '../services/tradeHistory';
import { useLivePrices } from '../hooks/useLivePrices';
import { useConnectionStatus } from './connectionStatusStore';
import { DashboardContext, type DashboardContextValue } from './dashboardStore';
import type {
  EtfData, EtfType, NewsItem, MarketSignal, Alert, HistoricalSignal, TradeRecord,
  ActiveTab, WalletState, TradeOrder, OrderSide,
} from '../types';

/** Unwrap a PromiseSettledResult — safe in .tsx (no JSX-generic ambiguity). */
function settled<T>(r: PromiseSettledResult<T>): T | null {
  return r.status === 'fulfilled' ? r.value : null;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  // ── ETF data ────────────────────────────────────────────────────────────
  const [btcData,     setBtcData]     = useState<EtfData | null>(null);
  const [ethData,     setEthData]     = useState<EtfData | null>(null);
  const [btcHist,     setBtcHist]     = useState<HistoricalInflow[]>([]);
  const [ethHist,     setEthHist]     = useState<HistoricalInflow[]>([]);
  const [btcPrice,    setBtcPrice]    = useState<PricePoint[]>([]);
  const [ethPrice,    setEthPrice]    = useState<PricePoint[]>([]);
  const [alerts,      setAlerts]      = useState<Alert[]>([]);
  const [history,     setHistory]     = useState<HistoricalSignal[]>([]);
  const [news,        setNews]        = useState<NewsItem[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dataError,   setDataError]   = useState<string | null>(null);

  const [activeTab, setActiveTabState] = useState<ActiveTab>('btc');

  const [signal,        setSignal]        = useState<MarketSignal | null>(null);
  const [signalLoading, setSignalLoading] = useState(false);
  const [signalError,   setSignalError]   = useState<string | null>(null);
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage | null>(null);
  const [aiCircuitOpen, setAiCircuitOpen] = useState(false);
  const analyzeAbortRef = useRef<AbortController | null>(null);

  const setActiveTab = useCallback((tab: ActiveTab) => {
    setActiveTabState(tab);
    if (analyzeAbortRef.current) {
      analyzeAbortRef.current.abort();
      analyzeAbortRef.current = null;
    }
    setSignalLoading(false);
    setAnalysisStage(null);
    setSignal(null);
    setSignalError(null);
  }, []);

  useEffect(() => {
    return () => {
      analyzeAbortRef.current?.abort();
      analyzeAbortRef.current = null;
    };
  }, []);

  const [wallet,       setWallet]       = useState<WalletState>({ connected: false, address: null, network: null });
  const [signer,       setSigner]       = useState<JsonRpcSigner | null>(null);
  const [tradeModal,   setTradeModal]   = useState<{ side: OrderSide } | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>(() => getTradeHistory());

  // ── Dynamic wallet ───────────────────────────────────────────────────────
  const { primaryWallet, network: dynamicNetwork, handleLogOut, setShowAuthFlow } = useDynamicContext();
  const autoSwitchedWalletRef = useRef<string | null>(null);

  // Sync wallet state, create ethers signer, verify/switch chain to ValueChain, and track chainChanged
  useEffect(() => {
    let cancelled = false;
    const address = primaryWallet?.address ?? null;

    if (!primaryWallet || !address) {
      autoSwitchedWalletRef.current = null;
      queueMicrotask(() => {
        if (cancelled) return;
        setSigner(null);
        setWallet({ connected: false, address: null, network: null, chainId: null, chainName: null });
      });
      return () => {
        cancelled = true;
      };
    }

    const walletKey = `${primaryWallet.id ?? address}:${ACTIVE_VALUECHAIN.chainId}`;
    const shouldAutoSwitch = autoSwitchedWalletRef.current !== walletKey;
    if (shouldAutoSwitch) {
      autoSwitchedWalletRef.current = walletKey;
    }

    let providerCleanup: (() => void) | null = null;
    let connectorCleanup: (() => void) | null = null;

    const refreshSignerSafe = async (): Promise<JsonRpcSigner | null> => {
      try {
        const s = await getSigner(primaryWallet);
        if (!cancelled) setSigner(s);
        return s;
      } catch (err) {
        if (!cancelled) {
          setSigner(null);
          if (isWalletLockedError(err)) {
            setWallet(prev => ({
              ...prev,
              connected: true,
              address,
              networkStatus: 'locked',
              networkError: WALLET_LOCKED_MESSAGE,
            }));
          }
        }
        return null;
      }
    };

    const handleChainUpdate = async (rawChain: unknown) => {
      if (cancelled) return;
      const nextChainId = parseChainIdValue(rawChain);
      if (nextChainId === null) return;
      const onTarget = nextChainId === ACTIVE_VALUECHAIN.chainId;
      setWallet(prev => ({
        ...prev,
        connected: true,
        address,
        chainId: nextChainId,
        chainName: getChainDisplayName(nextChainId),
        networkStatus: onTarget ? 'matched' : 'wrong_network',
        networkError: onTarget ? null : prev.networkError,
        canAutoSwitch: onTarget ? true : (prev.canAutoSwitch ?? true),
      }));
      await refreshSignerSafe();
    };

    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      setWallet(prev => ({
        connected: true,
        address,
        network: ACTIVE_VALUECHAIN.id,
        chainId: prev.address === address ? (prev.chainId ?? null) : null,
        chainName: prev.address === address ? (prev.chainName ?? null) : null,
        networkStatus: prev.address === address && prev.networkStatus ? prev.networkStatus : 'unknown',
        networkError: null,
        canAutoSwitch: prev.address === address && prev.canAutoSwitch !== undefined ? prev.canAutoSwitch : true,
      }));

      const dynamicWallet = primaryWallet as unknown as DynamicWalletLike;
      const createdSigner = await refreshSignerSafe();
      if (cancelled) return;

      const chainInfo = await getWalletChainId({
        primaryWallet: dynamicWallet,
        signer: createdSigner,
      });
      if (cancelled) return;

      if (chainInfo.locked) {
        setSigner(null);
        setWallet(prev => ({
          ...prev,
          connected: true,
          address,
          chainId: null,
          chainName: null,
          networkStatus: 'locked',
          networkError: chainInfo.error ?? WALLET_LOCKED_MESSAGE,
        }));
      } else {
        const actualChainId = chainInfo.chainId;
        if (actualChainId === ACTIVE_VALUECHAIN.chainId) {
          setWallet({
            connected: true,
            address,
            network: ACTIVE_VALUECHAIN.id,
            chainId: ACTIVE_VALUECHAIN.chainId,
            chainName: ACTIVE_VALUECHAIN.name,
            networkStatus: 'matched',
            networkError: null,
            canAutoSwitch: true,
          });
        } else {
          setWallet({
            connected: true,
            address,
            network: ACTIVE_VALUECHAIN.id,
            chainId: actualChainId,
            chainName: actualChainId != null ? getChainDisplayName(actualChainId) : null,
            networkStatus: shouldAutoSwitch ? 'switching' : 'wrong_network',
            networkError: null,
            canAutoSwitch: true,
          });

          if (shouldAutoSwitch) {
            const res = await ensureWalletOnValueChain({
              primaryWallet: dynamicWallet,
              signer: createdSigner,
              targetConfig: ACTIVE_VALUECHAIN,
            });
            if (cancelled) return;

            if (res.ok) {
              await refreshSignerSafe();
              if (cancelled) return;
              setWallet({
                connected: true,
                address,
                network: ACTIVE_VALUECHAIN.id,
                chainId: ACTIVE_VALUECHAIN.chainId,
                chainName: ACTIVE_VALUECHAIN.name,
                networkStatus: 'matched',
                networkError: null,
                canAutoSwitch: true,
              });
            } else if (res.status === 'locked') {
              setSigner(null);
              setWallet({
                connected: true,
                address,
                network: ACTIVE_VALUECHAIN.id,
                chainId: null,
                chainName: null,
                networkStatus: 'locked',
                networkError: res.error ?? WALLET_LOCKED_MESSAGE,
                canAutoSwitch: true,
              });
            } else {
              setWallet({
                connected: true,
                address,
                network: ACTIVE_VALUECHAIN.id,
                chainId: res.chainId ?? actualChainId,
                chainName: (res.chainId ?? actualChainId) != null
                  ? getChainDisplayName(res.chainId ?? actualChainId)
                  : null,
                networkStatus: 'wrong_network',
                networkError: res.error ?? null,
                canAutoSwitch: res.canAutoSwitch,
              });
            }
          }
        }
      }

      // Listen for EIP-1193 chainChanged on THIS wallet's connected provider (not global window.ethereum)
      try {
        const provider = chainInfo.provider ?? await resolveConnectedProvider({
          primaryWallet: dynamicWallet,
          signer: createdSigner,
        });
        if (!cancelled && provider?.on) {
          const onProviderChainChanged = (nextChain: unknown) => {
            void handleChainUpdate(nextChain);
          };
          provider.on('chainChanged', onProviderChainChanged);
          providerCleanup = () => provider.removeListener?.('chainChanged', onProviderChainChanged);
        }
      } catch (err) {
        if (isWalletLockedError(err) && !cancelled) {
          setWallet(prev => ({
            ...prev,
            networkStatus: 'locked',
            networkError: WALLET_LOCKED_MESSAGE,
          }));
        }
      }

      // Also listen to Dynamic connector's chainChange event
      const connector = dynamicWallet.connector;
      if (!cancelled && connector?.on) {
        const onConnectorChainChange = (payload: { chain?: unknown }) => {
          void handleChainUpdate(payload?.chain);
        };
        connector.on('chainChange', onConnectorChainChange);
        connectorCleanup = () => {
          connector.off?.('chainChange', onConnectorChainChange);
          connector.removeListener?.('chainChange', onConnectorChainChange);
        };
      }
    })();

    return () => {
      cancelled = true;
      providerCleanup?.();
      connectorCleanup?.();
    };
  }, [primaryWallet]);

  // Keep real connected chain synced when Dynamic's reactive `network` value updates
  useEffect(() => {
    if (!primaryWallet || dynamicNetwork === undefined || dynamicNetwork === null) return;
    const parsed = parseChainIdValue(dynamicNetwork);
    if (parsed === null) return;
    const onTarget = parsed === ACTIVE_VALUECHAIN.chainId;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setWallet(prev => {
        if (!prev.connected || (prev.chainId === parsed && prev.networkStatus === (onTarget ? 'matched' : 'wrong_network'))) {
          return prev;
        }
        return {
          ...prev,
          chainId: parsed,
          chainName: getChainDisplayName(parsed),
          networkStatus: onTarget ? 'matched' : 'wrong_network',
          networkError: onTarget ? null : prev.networkError,
        };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [primaryWallet, dynamicNetwork]);

  // Handle NotUnlocked emitted by Dynamic connection lifecycle
  useEffect(() => {
    const onWalletLocked = (ev: Event) => {
      const msg = (ev as CustomEvent<string>).detail || WALLET_LOCKED_MESSAGE;
      setSigner(null);
      setWallet(prev => ({
        ...prev,
        networkStatus: 'locked',
        networkError: msg,
      }));
    };
    window.addEventListener('etfsignal:wallet-locked', onWalletLocked);
    return () => window.removeEventListener('etfsignal:wallet-locked', onWalletLocked);
  }, []);

  const switchToValueChain = useCallback(async (): Promise<boolean> => {
    if (!primaryWallet) return false;
    const dynamicWallet = primaryWallet as unknown as DynamicWalletLike;
    setWallet(prev => ({ ...prev, networkStatus: 'switching', networkError: null }));

    let activeSigner = signer;
    if (!activeSigner) {
      try {
        activeSigner = await getSigner(primaryWallet);
        setSigner(activeSigner);
      } catch (err) {
        if (isWalletLockedError(err)) {
          setSigner(null);
          setWallet(prev => ({
            ...prev,
            networkStatus: 'locked',
            networkError: WALLET_LOCKED_MESSAGE,
          }));
          return false;
        }
      }
    }

    const res = await ensureWalletOnValueChain({
      primaryWallet: dynamicWallet,
      signer: activeSigner,
      targetConfig: ACTIVE_VALUECHAIN,
    });

    if (res.ok) {
      try {
        const freshSigner = await getSigner(primaryWallet);
        setSigner(freshSigner);
      } catch (err) {
        if (isWalletLockedError(err)) {
          setSigner(null);
          setWallet(prev => ({
            ...prev,
            networkStatus: 'locked',
            networkError: WALLET_LOCKED_MESSAGE,
          }));
          return false;
        }
      }
      setWallet(prev => ({
        ...prev,
        chainId: ACTIVE_VALUECHAIN.chainId,
        chainName: ACTIVE_VALUECHAIN.name,
        networkStatus: 'matched',
        networkError: null,
        canAutoSwitch: true,
      }));
      return true;
    }

    if (res.status === 'locked') {
      setSigner(null);
      setWallet(prev => ({
        ...prev,
        networkStatus: 'locked',
        networkError: res.error ?? WALLET_LOCKED_MESSAGE,
      }));
      return false;
    }

    setWallet(prev => ({
      ...prev,
      chainId: res.chainId ?? prev.chainId ?? null,
      chainName: (res.chainId ?? prev.chainId) != null
        ? getChainDisplayName(res.chainId ?? prev.chainId)
        : prev.chainName ?? null,
      networkStatus: 'wrong_network',
      canAutoSwitch: res.canAutoSwitch,
      networkError: res.error ?? null,
    }));
    return false;
  }, [primaryWallet, signer]);

  const handleConnectWallet = useCallback(() => {
    setShowAuthFlow(true);
  }, [setShowAuthFlow]);

  const handleDisconnectWallet = useCallback(() => {
    handleLogOut();
  }, [handleLogOut]);

  // ── Display profile (per-wallet name/avatar, cosmetic only) ────────────────
  const [profileVersion, setProfileVersion] = useState(0);
  const profile = useMemo(
    () => (profileVersion >= 0 ? getProfile(wallet.address) : getProfile(wallet.address)),
    [wallet.address, profileVersion],
  );
  const refreshProfile = useCallback(() => setProfileVersion(v => v + 1), []);

  // ── Alerts: unread-since-last-visit badge ───────────────────────────────────
  const [seenAlertIds, setSeenAlertIds] = useState<string[]>(() => getSeenAlertIds());
  const unreadAlertCount = useMemo(
    () => alerts.filter(a => !seenAlertIds.includes(a.id)).length,
    [alerts, seenAlertIds],
  );
  const markAlertsAsSeen = useCallback(() => {
    const ids = alerts.map(a => a.id);
    markAlertsSeen(ids);
    setSeenAlertIds(ids);
  }, [alerts]);

  // ── Connection status ────────────────────────────────────────────────────
  const { setSourceStatus } = useConnectionStatus();

  // ── Live prices (Binance WebSocket) ─────────────────────────────────────
  const { BTC: liveBtcPx, ETH: liveEthPx, connected: liveConnected } = useLivePrices();

  // Map Binance WebSocket connection state to ConnectionStatusContext
  useEffect(() => {
    setSourceStatus('binance', liveConnected ? 'live' : 'error');
  }, [liveConnected, setSourceStatus]);

  // ── Data refresh ─────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    setDataError(null);
    try {
      // allSettled so a news/history failure never blocks ETF data + alerts
      const [btcR, ethR, newsR, bInfR, eInfR, bPxR, ePxR, histR] = await Promise.allSettled([
        fetchEtfMetrics('us-btc-spot'),
        fetchEtfMetrics('us-eth-spot'),
        fetchNews({ pageNum: 1, pageSize: 30 }),
        fetchHistoricalInflows('us-btc-spot', 14),
        fetchHistoricalInflows('us-eth-spot', 14),
        fetchPriceHistory('us-btc-spot', 14),
        fetchPriceHistory('us-eth-spot', 14),
        fetchSignalHistory(),
      ]);

      const btc  = settled(btcR);
      const eth  = settled(ethR);
      const bInf = settled(bInfR) ?? [];
      const eInf = settled(eInfR) ?? [];

      if (btc) { setBtcData(btc); }
      if (eth) { setEthData(eth); }
      setBtcHist(bInf); setEthHist(eInf);
      setBtcPrice(settled(bPxR) ?? []); setEthPrice(settled(ePxR) ?? []);
      setHistory(settled(histR) ?? []);

      // Alerts: derive whenever we have at least one ETF dataset
      if (btc || eth) {
        setAlerts(deriveAlerts(
          btc  ?? { totalNetAssets: { value: null, lastUpdateDate: '' }, totalNetAssetsPercentage: { value: null, lastUpdateDate: '' }, totalTokenHoldings: { value: null, lastUpdateDate: '' }, dailyNetInflow: { value: 0, lastUpdateDate: '' }, cumNetInflow: { value: null, lastUpdateDate: '' }, dailyTotalValueTraded: { value: null, lastUpdateDate: '' }, list: [] },
          eth  ?? { totalNetAssets: { value: null, lastUpdateDate: '' }, totalNetAssetsPercentage: { value: null, lastUpdateDate: '' }, totalTokenHoldings: { value: null, lastUpdateDate: '' }, dailyNetInflow: { value: 0, lastUpdateDate: '' }, cumNetInflow: { value: null, lastUpdateDate: '' }, dailyTotalValueTraded: { value: null, lastUpdateDate: '' }, list: [] },
          bInf,
        ));
      }

      const newsData = settled(newsR);
      if (newsData) setNews(newsData.list);

      setLastUpdated(new Date());

      // Status: live if both ETF feeds succeeded; error only if both failed
      const etfOk = btcR.status === 'fulfilled' || ethR.status === 'fulfilled';
      setSourceStatus('sosovalue', etfOk ? 'live' : 'error');

      if (!etfOk) {
        const firstErr = [btcR, ethR].find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        setDataError(firstErr?.reason instanceof Error ? firstErr.reason.message : 'Failed to load market data.');
      } else if (btcR.status === 'rejected') {
        setDataError('BTC ETF data temporarily unavailable — showing ETH data only.');
      } else if (ethR.status === 'rejected') {
        setDataError('ETH ETF data temporarily unavailable — showing BTC data only.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load market data.';
      console.error('Failed to load data:', err);
      setDataError(msg);
      setSourceStatus('sosovalue', 'error');
    } finally {
      setLoading(false);
    }
  }, [setSourceStatus]);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) void refresh();
    });
    const i = setInterval(refresh, 5 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(i);
    };
  }, [refresh]);

  const cancelAnalyze = useCallback(() => {
    if (analyzeAbortRef.current) {
      analyzeAbortRef.current.abort();
      analyzeAbortRef.current = null;
    }
    setSignalLoading(false);
    setAnalysisStage(null);
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────
  const activeData:  EtfData | null     = activeTab === 'btc' ? btcData  : ethData;
  const activeHist:  HistoricalInflow[] = activeTab === 'btc' ? btcHist  : ethHist;
  const activePrice: PricePoint[]       = activeTab === 'btc' ? btcPrice : ethPrice;
  const activeLabel: 'BTC' | 'ETH'     = activeTab === 'btc' ? 'BTC'    : 'ETH';
  const latestBtcPx = btcPrice[btcPrice.length - 1]?.price;
  const latestEthPx = ethPrice[ethPrice.length - 1]?.price;

  const sentiment = useMemo(
    () => computeSentiment(activeHist.map(h => h.inflow)),
    [activeHist],
  );

  // ── Signal persistence ────────────────────────────────────────────────────
  const persistSignal = useCallback((sig: MarketSignal, asset: 'BTC' | 'ETH') => {
    // Exclude fallback signals from AI performance/backtest history
    if (sig.source === 'fallback') return;

    const livePrice = asset === 'BTC'
      ? (liveBtcPx ?? latestBtcPx ?? undefined)
      : (liveEthPx ?? latestEthPx ?? undefined);

    const entry: HistoricalSignal = {
      id:         `sig-${Date.now()}`,
      asset,
      direction:  sig.direction,
      confidence: sig.confidence,
      headline:   sig.headline,
      timestamp:  Date.now(),
      entryPrice: livePrice,
      pnlReal:    false,
      source:     sig.source ?? 'ai',
      // Only direction-bearing signals with a known entry price are eligible
      // for real backtested evaluation; NEUTRAL signals stay legacy/unevaluated.
      ...(sig.direction !== 'NEUTRAL' && livePrice != null && {
        tpPrice: sig.takeProfit.price,
        slPrice: sig.stopLoss.price,
        outcome: 'PENDING' as const,
      }),
    };

    saveSignal(entry).catch(() => {});
  }, [liveBtcPx, latestBtcPx, liveEthPx, latestEthPx]);

  // ── Signal performance evaluation ────────────────────────────────────────
  // Evaluates PENDING signals ≥24h old against real Binance candles, on mount
  // and every 5 minutes thereafter.
  useEffect(() => {
    const evaluate = () => {
      evaluatePendingSignals()
        .then(fetchSignalHistory)
        .then(setHistory)
        .catch(() => {});
    };
    evaluate();
    const i = setInterval(evaluate, 5 * 60 * 1000);
    return () => clearInterval(i);
  }, []);

  // ── AI signal ────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    if (!activeData || signalLoading) return;

    if (analyzeAbortRef.current) {
      analyzeAbortRef.current.abort();
    }
    const controller = new AbortController();
    analyzeAbortRef.current = controller;

    setSignalLoading(true);
    setSignal(null);
    setSignalError(null);
    setAnalysisStage('fetching_data');
    try {
      const tMktStart = performance.now();
      const livePrice = activeTab === 'btc' ? (liveBtcPx ?? latestBtcPx) : (liveEthPx ?? latestEthPx);
      const etfType: EtfType = activeTab === 'btc' ? 'us-btc-spot' : 'us-eth-spot';

      // Requirement 2.10: track record from already-loaded real-evaluated AI signals (>=5 required, fallback excluded)
      const resolvedReal = history.filter(
        s => s.source !== 'fallback' && s.pnlReal === true && typeof s.pnlPct === 'number',
      );
      const backtestSummary = resolvedReal.length >= 5
        ? {
            hitRate: Math.round((resolvedReal.filter(s => s.outcome === 'HIT').length / resolvedReal.length) * 100),
            avgPnl: resolvedReal.reduce((a, s) => a + (s.pnlPct as number), 0) / resolvedReal.length,
            sampleSize: resolvedReal.length,
          }
        : undefined;
      const marketDataMs = Math.round(performance.now() - tMktStart);

      // Requirement 4.7: Fetch 90D inflows once (and derive 30D slice from it) with a 2.5s timeout
      // so slow historical endpoints never stall signal generation.
      const tSosoStart = performance.now();
      const flow90 = await Promise.race([
        fetchHistoricalInflows(etfType, 90),
        new Promise<typeof activeHist>((resolve) => setTimeout(() => resolve(activeHist), 2500)),
      ]);
      const sosoValueMs = Math.round(performance.now() - tSosoStart);

      if (controller.signal.aborted) return;

      setAnalysisStage('calculating_momentum');
      const flow30 = flow90.slice(-30);
      const flow30dTotal = flow30.length > 0 ? flow30.reduce((a, h) => a + h.inflow, 0) : undefined;
      const flow90dTotal = flow90.length > 0 ? flow90.reduce((a, h) => a + h.inflow, 0) : undefined;
      const inflows = (flow90.length > 0 ? flow90 : activeHist).map(h => h.inflow);

      const r = await analyzeMarket(activeLabel, activeData, news, livePrice, {
        backtestSummary,
        flow30dTotal,
        flow90dTotal,
        inflows,
        sosoValueMs,
        marketDataMs,
        onStageChange: setAnalysisStage,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      setSignal(r);
      setSignalLoading(false);

      if (r.source === 'fallback') {
        setSourceStatus('ai', 'error');
        setAiCircuitOpen(getAiCircuitState().isOpen);
      } else {
        setSourceStatus('ai', 'live');
        setAiCircuitOpen(false);
        // Non-blocking background persistence & Telegram broadcast (AI signals only)
        persistSignal(r, activeLabel);
        notifyTelegramSubscribers(r, activeLabel).catch(() => {});
        fetchSignalHistory().then(setHistory).catch(() => {});
      }
    } catch (err: unknown) {
      if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Agent analysis failed.';
      console.error(err);
      setSignalError(msg);
      setSourceStatus('ai', 'error');
    } finally {
      if (analyzeAbortRef.current === controller) {
        analyzeAbortRef.current = null;
        setSignalLoading(false);
      }
    }
  }, [activeData, activeLabel, activeTab, activeHist, liveBtcPx, latestBtcPx, liveEthPx, latestEthPx, news, persistSignal, setSourceStatus, history, signalLoading]);

  const handleRetryAi = useCallback(async () => {
    resetAiCircuitBreaker();
    setAiCircuitOpen(false);
    await handleAnalyze();
  }, [handleAnalyze]);

  // ── Trade modal ───────────────────────────────────────────────────────────
  const openTradeModal  = useCallback((side: OrderSide) => setTradeModal({ side }), []);
  const closeTradeModal = useCallback(() => setTradeModal(null), []);

  const refreshTradeHistory = useCallback(() => {
    setTradeHistory(getTradeHistory());
  }, []);

  const confirmTrade = useCallback(async (order: TradeOrder): Promise<{ orderId: string }> => {
    if (wallet.networkStatus === 'locked') {
      throw new WalletLockedError(wallet.networkError ?? WALLET_LOCKED_MESSAGE);
    }

    let activeSigner = signer;
    if (!activeSigner && primaryWallet) {
      try {
        activeSigner = await getSigner(primaryWallet);
        setSigner(activeSigner);
      } catch (err) {
        if (isWalletLockedError(err)) {
          setWallet(prev => ({
            ...prev,
            networkStatus: 'locked',
            networkError: WALLET_LOCKED_MESSAGE,
          }));
          throw new WalletLockedError(WALLET_LOCKED_MESSAGE);
        }
      }
    }
    if (!activeSigner) throw new Error('Wallet not connected');

    const walletOpts = { primaryWallet: primaryWallet as unknown as DynamicWalletLike | null };
    const r = order.marketType === 'futures'
      ? await placePerpsOrder(activeSigner, {
          symbol: order.symbol,
          side: order.side,
          leverage: order.leverage ?? 20,
          type: order.type,
          price: order.price,
          marginMode: order.marginMode,
          reduceOnly: order.reduceOnly,
          takeProfitPrice: order.takeProfitPrice,
          stopLossPrice: order.stopLossPrice,
          // TradeModal already converts any quote-currency perps order (MARKET
          // or LIMIT) into an exact base-asset quantity before calling
          // confirmTrade, so `order.currency` should always be the base asset
          // here — `funds` below is just a defensive fallback, not a live path.
          ...(order.currency === order.symbol.split('-')[0]
            ? { quantity: order.quantity }
            : { funds: order.quantity }),
        }, walletOpts)
      : await placeSpotOrder(activeSigner, 1, order, walletOpts);
    if (!r.success) {
      if (r.walletLocked) {
        setWallet(prev => ({
          ...prev,
          networkStatus: 'locked',
          networkError: r.error ?? WALLET_LOCKED_MESSAGE,
        }));
      } else if (r.wrongNetwork) {
        setWallet(prev => ({
          ...prev,
          chainId: r.actualChainId ?? prev.chainId ?? null,
          chainName: (r.actualChainId ?? prev.chainId) != null
            ? getChainDisplayName(r.actualChainId ?? prev.chainId)
            : prev.chainName ?? null,
          networkStatus: 'wrong_network',
          networkError: r.error ?? null,
        }));
      }
      const tradeErr = new Error(r.error || 'Order failed') as Error & {
        wrongNetwork?: boolean;
        walletLocked?: boolean;
        actualChainId?: number | null;
      };
      tradeErr.wrongNetwork = Boolean(r.wrongNetwork);
      tradeErr.walletLocked = Boolean(r.walletLocked);
      tradeErr.actualChainId = r.actualChainId;
      throw tradeErr;
    }

    // Use the real SoDEX order ID from the response, fall back to local timestamp
    const orderId = r.orderId ?? `etfsignal-${Date.now()}`;
    const record: TradeRecord = {
      id:        orderId,
      orderId,
      pair:      order.symbol,
      side:      order.side,
      type:      order.type,
      size:      order.quantity,
      currency:  order.currency,
      price:     order.price,
      timestamp:     Date.now(),
      status:        'submitted',
      asset:         order.symbol.startsWith('BTC') ? 'BTC' : 'ETH',
      marketType:    order.marketType,
      leverage:      order.leverage,
      marginMode:      order.marginMode,
      reduceOnly:      order.reduceOnly,
      takeProfitPrice: order.takeProfitPrice,
      stopLossPrice:   order.stopLossPrice,
      signal:        signal?.headline,
      walletAddress: wallet.address ?? undefined,
    };

    saveTrade(record);
    setTradeHistory(getTradeHistory());
    notifyTelegramTrade(record).catch(() => {});

    return { orderId };
  }, [signer, primaryWallet, wallet.address, wallet.networkStatus, wallet.networkError, signal]);

  // SoDEX testnet uses USDC as the quote currency (get from https://testnet.sodex.com → Faucet)
  const symbol = activeTab === 'btc' ? 'BTC-USDC' : 'ETH-USDC';

  const value: DashboardContextValue = {
    btcData, ethData, btcHist, ethHist, btcPrice, ethPrice,
    alerts, history, news, loading, lastUpdated, dataError,
    refresh,
    activeTab, setActiveTab, activeData, activeHist, activePrice,
    activeLabel, latestBtcPx, latestEthPx,
    liveBtcPx, liveEthPx, liveConnected,
    sentiment,
    signal, signalLoading, signalError, analysisStage, aiCircuitOpen, handleAnalyze, handleRetryAi, cancelAnalyze,
    wallet, signer,
    handleConnectWallet, handleDisconnectWallet, switchToValueChain,
    tradeModal, openTradeModal, closeTradeModal, confirmTrade,
    symbol,
    tradeHistory, refreshTradeHistory,
    profile, refreshProfile,
    unreadAlertCount, markAlertsAsSeen,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
