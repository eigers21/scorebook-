'use client';

// ========================================
// メインスコア記録画面 - 自チームの打席入力・ランナー管理
// 相手チームの得点は手動入力
// ========================================

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
    Game, GameState, GameEvent, Base, UUID, RunnerEventKind,
    PlateAppearanceEvent, RunnerMovement, RBI, RunnerState,
    BattingStats, PitchingStats, HalfInning,
} from '@/types';
import {
    computeGameState, getCurrentBatterId, getCurrentPitcherId,
    getPlayerName, getOffenseTeam, getDefenseTeam, getBattingOrderNumber,
    createPlateAppearanceEvent, createRunnerEvent, createInningChangeEvent,
    shouldChangeInning, getNextInning,
    calculateBattingStats, calculatePitchingStats,
    getMyTeam, getOpponentTeam,
} from '@/lib/gameEngine';
import { loadGameById, saveGame } from '@/lib/storage';
import { ResultOption, findResultOption } from '@/data/masterData';
import MiniField, { RunnerEventModal } from '@/components/MiniField';
import PlateAppearanceInput from '@/components/PlateAppearanceInput';
import Scoreboard from '@/components/Scoreboard';
import EventLog from '@/components/EventLog';
import ConfirmModal from '@/components/ConfirmModal';

/** ページコンポーネント */
export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [game, setGame] = useState<Game | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [showPAInput, setShowPAInput] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [showOpponentScore, setShowOpponentScore] = useState(false);
    const [opponentInningScore, setOpponentInningScore] = useState('');
    const [opponentInningIdx, setOpponentInningIdx] = useState(0);
    const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'danger' | 'primary' | 'success';
        confirmText: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', variant: 'primary', confirmText: '確認', onConfirm: () => { } });

    // フィードバック表示用
    const showFeedback = (message: string, type: 'success' | 'info' = 'success') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 4000);
    };

    // 確認モーダル表示用
    const showConfirm = (title: string, message: string, onConfirm: () => void, variant: 'danger' | 'primary' | 'success' = 'primary', confirmText = '確認') => {
        setConfirmModal({ isOpen: true, title, message, variant, confirmText, onConfirm });
    };
    const closeConfirm = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };

    // ランナーイベントモーダル
    const [runnerModal, setRunnerModal] = useState<{
        isOpen: boolean;
        base: Base;
        runnerId: UUID;
    }>({ isOpen: false, base: 'first', runnerId: '' });

    /** 試合データ読み込み */
    useEffect(() => {
        const loaded = loadGameById(resolvedParams.id);
        if (loaded) {
            // 後方互換: 古いデータにmyTeamNameがない場合のフォールバック
            if (!loaded.myTeamName) {
                loaded.myTeamName = loaded.homeTeam.name;
                loaded.myTeamSide = 'home';
            }
            if (!loaded.opponentScoreByInning) {
                loaded.opponentScoreByInning = [];
            }
            setGame(loaded);
            setGameState(computeGameState(loaded));
        }
    }, [resolvedParams.id]);

    /** 試合データ保存＋状態更新 */
    const updateGame = useCallback((updatedGame: Game) => {
        setGame(updatedGame);
        setGameState(computeGameState(updatedGame));
        saveGame(updatedGame);
    }, []);

    /** イベント追加 */
    const addEvent = useCallback((event: GameEvent) => {
        if (!game) return;
        const updatedGame: Game = {
            ...game,
            status: 'in_progress',
            events: [...game.events, event],
            updatedAt: new Date().toISOString(),
        };
        updateGame(updatedGame);
    }, [game, updateGame]);

    /** Undo: 最後のイベント取り消し */
    const handleUndo = useCallback(() => {
        if (!game || game.events.length === 0) return;
        showConfirm('操作の取り消し', '直前の操作を取り消しますか？', () => {
            const updatedGame: Game = {
                ...game,
                events: game.events.slice(0, -1),
                updatedAt: new Date().toISOString(),
            };
            updateGame(updatedGame);
            closeConfirm();
            showFeedback('取り消しました。', 'info');
        }, 'danger', '取り消す');
    }, [game, updateGame]);

    /** 塁タップ → ランナーイベントモーダル */
    const handleBaseClick = useCallback((base: Base, runnerId: UUID) => {
        setRunnerModal({ isOpen: true, base, runnerId });
    }, []);

    /** ランナーイベント選択 */
    const handleRunnerEvent = useCallback((eventKind: RunnerEventKind, toBase: Base | 'out' | 'score') => {
        if (!gameState) return;
        const event = createRunnerEvent(
            gameState,
            runnerModal.runnerId,
            eventKind,
            runnerModal.base,
            toBase
        );
        addEvent(event);
        setRunnerModal({ isOpen: false, base: 'first', runnerId: '' });
        setTimeout(() => checkInningChange(), 100);
    }, [gameState, runnerModal, addEvent]);

    /** 打席結果選択 */
    const handlePASelect = useCallback((result: ResultOption) => {
        if (!game || !gameState) return;

        const runners = gameState.runners;
        const hasRunners = runners.first || runners.second || runners.third;

        if (hasRunners && (result.category === 'hit' || result.category === 'out' || result.category === 'error' || result.category === 'fielders_choice')) {
            startRunnerMovement(result);
        } else {
            submitPlateAppearance(result, [], []);
        }
    }, [game, gameState]);

    /** ランナー走塁入力開始 */
    function startRunnerMovement(result: ResultOption) {
        if (!gameState) return;
        const movements: RunnerMovement[] = [];
        const rbiList: RBI[] = [];

        if (result.category === 'walk' || result.category === 'hit_by_pitch') {
            autoForceAdvance(gameState.runners, movements, rbiList);
            submitPlateAppearance(result, movements, rbiList);
            return;
        }
        if (result.hitBases === 4) {
            autoHomeRun(gameState.runners, movements, rbiList);
            submitPlateAppearance(result, movements, rbiList);
            return;
        }
        if (result.category === 'hit' && result.hitBases) {
            autoHitAdvance(gameState.runners, result.hitBases, movements, rbiList);
            submitPlateAppearance(result, movements, rbiList);
            return;
        }
        submitPlateAppearance(result, movements, rbiList);
    }

    function autoForceAdvance(runners: RunnerState, movements: RunnerMovement[], rbiList: RBI[]) {
        if (runners.first) {
            if (runners.second) {
                if (runners.third) {
                    movements.push({ runnerId: runners.third, fromBase: 'third', toBase: 'score', reason: 'force' });
                    rbiList.push({ runnerId: runners.third, earned: true });
                }
                movements.push({ runnerId: runners.second, fromBase: 'second', toBase: 'third', reason: 'force' });
            }
            movements.push({ runnerId: runners.first, fromBase: 'first', toBase: 'second', reason: 'force' });
        }
    }

    function autoHomeRun(runners: RunnerState, movements: RunnerMovement[], rbiList: RBI[]) {
        if (runners.third) {
            movements.push({ runnerId: runners.third, fromBase: 'third', toBase: 'score', reason: 'batted_ball' });
            rbiList.push({ runnerId: runners.third, earned: true });
        }
        if (runners.second) {
            movements.push({ runnerId: runners.second, fromBase: 'second', toBase: 'score', reason: 'batted_ball' });
            rbiList.push({ runnerId: runners.second, earned: true });
        }
        if (runners.first) {
            movements.push({ runnerId: runners.first, fromBase: 'first', toBase: 'score', reason: 'batted_ball' });
            rbiList.push({ runnerId: runners.first, earned: true });
        }
    }

    function autoHitAdvance(runners: RunnerState, hitBases: number, movements: RunnerMovement[], rbiList: RBI[]) {
        if (runners.third) {
            movements.push({ runnerId: runners.third, fromBase: 'third', toBase: 'score', reason: 'batted_ball' });
            rbiList.push({ runnerId: runners.third, earned: true });
        }
        if (runners.second) {
            if (hitBases >= 2) {
                movements.push({ runnerId: runners.second, fromBase: 'second', toBase: 'score', reason: 'batted_ball' });
                rbiList.push({ runnerId: runners.second, earned: true });
            } else {
                movements.push({ runnerId: runners.second, fromBase: 'second', toBase: 'third', reason: 'batted_ball' });
            }
        }
        if (runners.first) {
            if (hitBases >= 3) {
                movements.push({ runnerId: runners.first, fromBase: 'first', toBase: 'score', reason: 'batted_ball' });
                rbiList.push({ runnerId: runners.first, earned: true });
            } else if (hitBases >= 2) {
                movements.push({ runnerId: runners.first, fromBase: 'first', toBase: 'third', reason: 'batted_ball' });
            } else {
                movements.push({ runnerId: runners.first, fromBase: 'first', toBase: 'second', reason: 'batted_ball' });
            }
        }
    }

    function submitPlateAppearance(result: ResultOption, runnerMovements: RunnerMovement[], rbiList: RBI[]) {
        if (!game || !gameState) return;

        const batterId = getCurrentBatterId(gameState, game);
        const pitcherId = getCurrentPitcherId(gameState);

        const orderInInning = game.events.filter(
            e => e.type === 'plate_appearance' && e.inning === gameState.inning && e.halfInning === gameState.halfInning
        ).length + 1;

        const event = createPlateAppearanceEvent(
            gameState,
            batterId,
            pitcherId,
            result.code,
            result.label,
            result.category,
            runnerMovements,
            rbiList,
            orderInInning
        );

        addEvent(event);
        setShowPAInput(false);
        setTimeout(() => checkInningChange(), 100);
    }

    function checkInningChange() {
        if (!game) return;
        const latestGame = loadGameById(resolvedParams.id);
        if (!latestGame) return;
        const latestState = computeGameState(latestGame);

        if (shouldChangeInning(latestState)) {
            const next = getNextInning(latestState, latestGame);
            if (next) {
                const event = createInningChangeEvent(latestState, next.inning, next.halfInning);
                const updatedGame: Game = {
                    ...latestGame,
                    events: [...latestGame.events, event],
                    updatedAt: new Date().toISOString(),
                };
                updateGame(updatedGame);
            } else {
                const updatedGame: Game = {
                    ...latestGame,
                    status: 'finished',
                    updatedAt: new Date().toISOString(),
                };
                updateGame(updatedGame);
            }
        }
    }

    /** 試合終了 */
    function handleFinishGame() {
        if (!game) return;
        showConfirm(
            '試合終了',
            '試合を終了しますか？成績が確定されます。',
            () => {
                updateGame({ ...game, status: 'finished', updatedAt: new Date().toISOString() });
                closeConfirm();
                showFeedback('試合を終了しました。', 'info');
            },
            'danger',
            '終了する'
        );
    }

    /** 相手チーム得点の入力 */
    function handleOpponentScoreSubmit() {
        if (!game) return;
        const score = parseInt(opponentInningScore) || 0;
        const updatedScores = [...(game.opponentScoreByInning || [])];
        while (updatedScores.length <= opponentInningIdx) {
            updatedScores.push(0);
        }
        updatedScores[opponentInningIdx] = score;
        updateGame({ ...game, opponentScoreByInning: updatedScores, updatedAt: new Date().toISOString() });
        setShowOpponentScore(false);
        setOpponentInningScore('');
    }

    /** PDF出力 */
    async function handleExportPDF() {
        if (!game) return;
        showFeedback('PDFを作成中...', 'info');
        try {
            const { generateScoreSheetPDF } = await import('@/lib/pdfGenerator');
            generateScoreSheetPDF(game);
            showFeedback('PDFを保存しました。ブラウザのダウンロードフォルダを確認してください。');
        } catch (error) {
            console.error(error);
            showFeedback('PDF作成に失敗しました。', 'info');
        }
    }

    // ========================================
    // 描画
    // ========================================

    if (!game || !gameState) {
        return (
            <div className="flex items-center justify-center min-h-dvh">
                <div className="animate-pulse-glow w-16 h-16 rounded-full" style={{ background: 'var(--accent-blue-glow)' }} />
            </div>
        );
    }

    const myTeam = getMyTeam(game);
    const opponentTeam = getOpponentTeam(game);
    const myHalf: HalfInning = game.myTeamSide === 'home' ? 'bottom' : 'top';
    const isMyTeamBatting = gameState.halfInning === myHalf;
    const isFinished = game.status === 'finished';

    const currentBatterId = isMyTeamBatting ? getCurrentBatterId(gameState, game) : null;
    const currentBatter = currentBatterId
        ? [...game.homeTeam.players, ...game.awayTeam.players].find(p => p.id === currentBatterId)
        : null;
    const offenseTeam = getOffenseTeam(game, gameState);

    // 成績
    const battingStats = calculateBattingStats(game.events, myTeam.players, myTeam.battingOrder);
    const pitchingStats = calculatePitchingStats(game);

    // 相手チームの合計得点
    const opponentTotalScore = (game.opponentScoreByInning || []).reduce((s, v) => s + v, 0);
    // 自チームの得点
    const myScore = game.myTeamSide === 'home' ? gameState.score.home : gameState.score.away;

    return (
        <div className="max-w-lg mx-auto px-4 py-4 pb-32">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={() => router.push('/')}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm"
                    style={{ background: 'var(--bg-tertiary)' }}
                >
                    ←
                </button>
                <div className="text-center">
                    <p className="font-bold text-sm">
                        {gameState.inning}回{gameState.halfInning === 'top' ? '表' : '裏'}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {game.date} {game.venue && `@ ${game.venue}`}
                    </p>
                </div>
                <div className="flex gap-2">
                    {!isFinished && (
                        <button
                            onClick={handleFinishGame}
                            className="text-xs px-3 py-2 rounded-lg font-bold"
                            style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                        >
                            終了
                        </button>
                    )}
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className="text-xs px-3 py-2 rounded-lg font-bold"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                    >
                        {showStats ? '記録' : '成績'}
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="text-xs px-3 py-2 rounded-lg font-bold"
                        style={{ background: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-purple)', border: '1px solid rgba(168, 85, 247, 0.3)' }}
                    >
                        PDF
                    </button>
                </div>
            </div>

            {/* フィードバックトースト */}
            {feedback && (
                <div
                    className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl shadow-2xl animate-fade-in text-sm font-bold flex items-center gap-2"
                    style={{
                        background: feedback.type === 'success' ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)',
                        width: 'calc(100% - 32px)',
                        maxWidth: '400px'
                    }}
                >
                    {feedback.type === 'success' ? '✅' : 'ℹ️'} {feedback.message}
                </div>
            )}

            {/* スコアボード */}
            <div className="glass-card p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{game.myTeamSide === 'away' ? '先攻' : '後攻'}</p>
                        <p className="font-bold text-sm">{myTeam.name}</p>
                    </div>
                    <div className="text-center px-4">
                        <p className="font-bold font-mono text-2xl" style={{ color: 'var(--accent-blue)' }}>
                            {myScore}
                        </p>
                    </div>
                    <div className="text-center px-2">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>-</p>
                    </div>
                    <div className="text-center px-4">
                        <p className="font-bold font-mono text-2xl" style={{ color: 'var(--accent-red)' }}>
                            {opponentTotalScore}
                        </p>
                    </div>
                    <div className="flex-1 text-right">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{game.myTeamSide === 'away' ? '後攻' : '先攻'}</p>
                        <p className="font-bold text-sm">{opponentTeam.name}</p>
                    </div>
                </div>
                {/* 相手得点入力ボタン */}
                {!isFinished && (
                    <button
                        onClick={() => {
                            setOpponentInningIdx(gameState.inning - 1);
                            setShowOpponentScore(true);
                        }}
                        className="w-full text-xs py-2 mt-1 rounded-lg transition-all"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)' }}
                    >
                        相手チーム得点を入力
                    </button>
                )}
            </div>

            {/* 成績表示モード */}
            {showStats && (
                <div className="space-y-4 animate-fade-in">
                    {/* 打撃成績 */}
                    <div className="glass-card p-4">
                        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--accent-blue)' }}>
                            {myTeam.name} 打撃成績
                        </h3>
                        <StatsTable stats={battingStats} />
                    </div>

                    {/* 投手成績 */}
                    <div className="glass-card p-4">
                        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--accent-green)' }}>
                            {myTeam.name} 投手成績
                        </h3>
                        <PitchingStatsTable stats={pitchingStats} />
                    </div>
                </div>
            )}

            {/* 記録モード */}
            {!showStats && (
                <>
                    {/* ミニグラウンド（自チーム攻撃時のみランナー表示） */}
                    {isMyTeamBatting && (
                        <div className="mb-4">
                            <MiniField
                                runners={gameState.runners}
                                outs={gameState.outs}
                                onBaseClick={handleBaseClick}
                                getPlayerName={(id) => getPlayerName(game, id)}
                            />
                        </div>
                    )}

                    {/* 相手チーム攻撃中の表示 */}
                    {!isMyTeamBatting && !isFinished && (
                        <div className="glass-card p-6 text-center mb-4">
                            <p className="text-lg mb-1">🛡️</p>
                            <p className="font-semibold text-sm mb-1">守備中</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {opponentTeam.name}の攻撃
                            </p>
                            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                                {gameState.inning}回{gameState.halfInning === 'top' ? '表' : '裏'} / {gameState.outs}アウト
                            </p>
                            {/* 相手の攻撃を終了する（= イニング交代）ボタン */}
                            <button
                                onClick={() => {
                                    if (!game || !gameState) return;
                                    const next = getNextInning(gameState, game);
                                    if (next) {
                                        const event = createInningChangeEvent(gameState, next.inning, next.halfInning);
                                        addEvent(event);
                                    }
                                }}
                                className="btn-secondary mt-3 text-xs px-6 py-2"
                            >
                                相手の攻撃終了 →
                            </button>
                        </div>
                    )}

                    {/* 自チーム攻撃時: 打者情報 & 打席入力ボタン */}
                    {isMyTeamBatting && !isFinished && !showPAInput && currentBatter && (
                        <div className="glass-card p-4 mb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm"
                                        style={{
                                            background: 'linear-gradient(135deg, var(--accent-blue), #2563eb)',
                                        }}
                                    >
                                        {currentBatter.number}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">{currentBatter.name}</p>
                                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                            {getBattingOrderNumber(game, gameState, currentBatterId!)}番 / {myTeam.name}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowPAInput(true)}
                                    className="btn-primary text-sm py-2.5 px-5"
                                >
                                    打席入力
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 試合終了表示 */}
                    {isFinished && (
                        <div className="glass-card p-6 text-center mb-4">
                            <p className="text-2xl mb-2">🏁</p>
                            <p className="font-bold text-lg mb-1">試合終了</p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {myTeam.name} {myScore} - {opponentTotalScore} {opponentTeam.name}
                            </p>
                            <button
                                onClick={handleExportPDF}
                                className="btn-primary mt-4 text-sm py-2.5 px-6"
                            >
                                📄 スコアシートPDF出力
                            </button>
                        </div>
                    )}

                    {/* 打席入力UI */}
                    {showPAInput && currentBatter && (
                        <div className="mb-4">
                            <PlateAppearanceInput
                                batterName={currentBatter.name}
                                batterNumber={currentBatter.number}
                                onSelect={handlePASelect}
                                onCancel={() => setShowPAInput(false)}
                            />
                        </div>
                    )}

                    {/* イベントログ */}
                    <EventLog
                        events={game.events}
                        game={game}
                        onUndo={handleUndo}
                    />
                </>
            )}

            {/* ランナーイベントモーダル */}
            <RunnerEventModal
                isOpen={runnerModal.isOpen}
                base={runnerModal.base}
                runnerId={runnerModal.runnerId}
                runnerName={game ? getPlayerName(game, runnerModal.runnerId) : ''}
                onSelect={handleRunnerEvent}
                onClose={() => setRunnerModal({ isOpen: false, base: 'first', runnerId: '' })}
            />

            {/* 相手得点入力モーダル */}
            {showOpponentScore && (
                <div className="modal-overlay" onClick={() => setShowOpponentScore(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4">相手チーム得点入力</h3>
                        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                            {opponentInningIdx + 1}回の {opponentTeam.name} の得点
                        </p>
                        <input
                            type="number"
                            value={opponentInningScore}
                            onChange={e => setOpponentInningScore(e.target.value)}
                            placeholder="得点数"
                            className="input-field mb-4"
                            min="0"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowOpponentScore(false)} className="btn-secondary flex-1">
                                キャンセル
                            </button>
                            <button onClick={handleOpponentScoreSubmit} className="btn-primary flex-1">
                                確定
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 確認モーダル（window.confirm() の代替） */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
                confirmText={confirmModal.confirmText}
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirm}
            />
        </div>
    );
}

// ========================================
// 打撃成績テーブル
// ========================================
function StatsTable({ stats }: { stats: BattingStats[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: '400px' }}>
                <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                        <th className="text-left py-1.5 px-1">選手</th>
                        <th className="py-1.5 px-1">打席</th>
                        <th className="py-1.5 px-1">打数</th>
                        <th className="py-1.5 px-1">安打</th>
                        <th className="py-1.5 px-1">打点</th>
                        <th className="py-1.5 px-1">四球</th>
                        <th className="py-1.5 px-1">三振</th>
                        <th className="py-1.5 px-1">盗塁</th>
                        <th className="py-1.5 px-1">打率</th>
                    </tr>
                </thead>
                <tbody>
                    {stats.map(s => (
                        <tr key={s.playerId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td className="text-left py-1.5 px-1 font-medium">{s.playerName}</td>
                            <td className="text-center py-1.5 px-1">{s.plateAppearances}</td>
                            <td className="text-center py-1.5 px-1">{s.atBats}</td>
                            <td className="text-center py-1.5 px-1 font-semibold" style={{ color: s.hits > 0 ? 'var(--accent-blue)' : undefined }}>{s.hits}</td>
                            <td className="text-center py-1.5 px-1">{s.rbiCount}</td>
                            <td className="text-center py-1.5 px-1">{s.walks}</td>
                            <td className="text-center py-1.5 px-1">{s.strikeouts}</td>
                            <td className="text-center py-1.5 px-1">{s.stolenBases}</td>
                            <td className="text-center py-1.5 px-1 font-mono">
                                {s.atBats > 0 ? s.battingAverage.toFixed(3).replace(/^0/, '') : '---'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ========================================
// 投手成績テーブル
// ========================================
function PitchingStatsTable({ stats }: { stats: PitchingStats[] }) {
    function formatIP(ip: number): string {
        const full = Math.floor(ip);
        const frac = Math.round((ip - full) * 10);
        if (frac === 0) return `${full}.0`;
        return `${full}.${frac}`;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: '300px' }}>
                <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                        <th className="text-left py-1.5 px-1">投手</th>
                        <th className="py-1.5 px-1">投球回</th>
                        <th className="py-1.5 px-1">被安打</th>
                        <th className="py-1.5 px-1">奪三振</th>
                        <th className="py-1.5 px-1">与四死球</th>
                        <th className="py-1.5 px-1">失点</th>
                        <th className="py-1.5 px-1">自責点</th>
                    </tr>
                </thead>
                <tbody>
                    {stats.map(s => (
                        <tr key={s.playerId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td className="text-left py-1.5 px-1 font-medium">{s.playerName}</td>
                            <td className="text-center py-1.5 px-1 font-mono">{formatIP(s.inningsPitched)}</td>
                            <td className="text-center py-1.5 px-1">{s.hits}</td>
                            <td className="text-center py-1.5 px-1 font-semibold" style={{ color: s.strikeouts > 0 ? 'var(--accent-green)' : undefined }}>{s.strikeouts}</td>
                            <td className="text-center py-1.5 px-1">{s.walks}</td>
                            <td className="text-center py-1.5 px-1">{s.runs}</td>
                            <td className="text-center py-1.5 px-1">{s.earnedRuns}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
