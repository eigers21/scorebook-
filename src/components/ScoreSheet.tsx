'use client';

// ========================================
// 伝統的スコアシートテーブル表示コンポーネント
// 参考画像に基づき、打順×イニングのグリッドにダイヤモンド+記号を描画
// ========================================

import { Game, GameState, PlateAppearanceEvent, HalfInning } from '@/types';
import { computeGameState, getMyTeam, getOpponentTeam, createInitialState, getPlayerName } from '@/lib/gameEngine';
import { findResultOption } from '@/data/masterData';
import ScoreSheetCell, { ScoreSheetCellData } from './ScoreSheetCell';

interface ScoreSheetProps {
    game: Game;
    onClose: () => void;
}

/** 守備位置の表示用マッピング */
const POS_LABELS: Record<string, string> = {
    pitcher: '投', catcher: '捕', first: '一', second: '二',
    third: '三', shortstop: '遊', left: '左', center: '中', right: '右', dh: 'DH',
};

/** 打者が到達した塁を計算する */
function getBatterReachedBase(pa: PlateAppearanceEvent): number {
    const opt = findResultOption(pa.result.code);
    if (!opt) return 0;

    if (opt.isOut) return 0;

    // 安打
    if (opt.hitBases) return opt.hitBases;

    // 四球、死球、失策、妨害、野選 → 1塁
    if (opt.category === 'walk' || opt.category === 'hit_by_pitch' ||
        opt.category === 'error' || opt.category === 'fielders_choice' ||
        opt.category === 'interference') {
        return 1;
    }

    return 0;
}

/** 各打席時点で打者がのちに得点したかを判定（簡易実装） */
function didBatterScore(game: Game, pa: PlateAppearanceEvent): boolean {
    // 本塁打は即得点
    if (pa.result.code.startsWith('HR')) return true;

    // この打者がその後のランナーイベントで得点したかをチェック
    const myHalf: HalfInning = game.myTeamSide === 'home' ? 'bottom' : 'top';
    const paIndex = game.events.indexOf(pa);
    if (paIndex < 0) return false;

    // この打席以降のイベントを確認
    for (let i = paIndex + 1; i < game.events.length; i++) {
        const ev = game.events[i];
        // イニング変わったら終了
        if (ev.type === 'inning_change') break;
        // 別半イニングのイベントは無視
        if (ev.inning !== pa.inning || ev.halfInning !== pa.halfInning) break;

        // ランナーイベントでこの打者が得点
        if (ev.type === 'runner_event' && ev.runnerId === pa.batterId && ev.toBase === 'score') {
            return true;
        }
        // 次の打席でのrunnerMovementsでこの打者が得点
        if (ev.type === 'plate_appearance') {
            for (const rm of ev.runnerMovements) {
                if (rm.runnerId === pa.batterId && rm.toBase === 'score') {
                    return true;
                }
            }
        }
    }
    return false;
}

/** イニングスコアの各行集計 */
function getInningStats(game: Game, half: HalfInning, inning: number) {
    const pas = game.events.filter(
        (e): e is PlateAppearanceEvent =>
            e.type === 'plate_appearance' && e.halfInning === half && e.inning === inning
    );

    const hits = pas.filter(p => p.result.category === 'hit').length;
    const walks = pas.filter(p => p.result.category === 'walk' || p.result.category === 'hit_by_pitch').length;
    const strikeouts = pas.filter(p => p.result.code === 'K' || p.result.code === 'KK').length;

    return { hits, walks, strikeouts };
}

export default function ScoreSheet({ game, onClose }: ScoreSheetProps) {
    const state = computeGameState(game);
    const myTeam = getMyTeam(game);
    const opponentTeam = getOpponentTeam(game);
    const myHalf: HalfInning = game.myTeamSide === 'home' ? 'bottom' : 'top';

    const maxInnings = Math.max(
        game.innings,
        state.inningScores.home.length,
        state.inningScores.away.length,
        7
    );

    // 各打者の全打席イベントをイニング順にグループ化
    const battingData: Map<string, PlateAppearanceEvent[]> = new Map();
    myTeam.battingOrder.forEach(playerId => {
        const pas = game.events.filter(
            (e): e is PlateAppearanceEvent =>
                e.type === 'plate_appearance' && e.batterId === playerId && e.halfInning === myHalf
        );
        battingData.set(playerId, pas);
    });

    // アウトカウントを計算するため、全打席を時系列で辿る
    const allPAs = game.events.filter(
        (e): e is PlateAppearanceEvent =>
            e.type === 'plate_appearance' && e.halfInning === myHalf
    );

    // 各打席の時点でのアウトカウントを記録
    const outCountMap = new Map<string, number>();
    let currentOuts = 0;
    let currentInning = 0;
    for (const pa of allPAs) {
        if (pa.inning !== currentInning) {
            currentOuts = 0;
            currentInning = pa.inning;
        }
        const opt = findResultOption(pa.result.code);
        if (opt?.isOut) {
            currentOuts++;
        }
        // runnerMovements内のアウトもカウント
        for (const rm of pa.runnerMovements) {
            if (rm.toBase === 'out') currentOuts++;
        }
        outCountMap.set(pa.id, currentOuts);
    }

    // セルサイズ
    const cellW = 52;
    const cellH = 60;
    const nameColW = 48;
    const numColW = 28;
    const posColW = 28;
    const orderColW = 24;
    const headerH = 28;

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        >
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                    style={{ background: 'var(--bg-tertiary)' }}
                >
                    ←
                </button>
                <div className="text-center">
                    <p className="font-bold text-sm">スコアシート</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {myTeam.name} ({game.myTeamSide === 'away' ? '先攻' : '後攻'})
                    </p>
                </div>
                <div className="w-8" />
            </div>

            {/* イニングスコアバー */}
            <div className="px-4 py-2 border-b overflow-x-auto" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
                <table className="text-xs" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                    <thead>
                        <tr>
                            <th className="px-2 py-1 text-left border" style={{ borderColor: '#666', minWidth: '60px' }}>チーム</th>
                            {Array.from({ length: maxInnings }, (_, i) => (
                                <th key={i} className="px-2 py-1 text-center border" style={{ borderColor: '#666', minWidth: '24px' }}>
                                    {i + 1}
                                </th>
                            ))}
                            <th className="px-2 py-1 text-center border font-bold" style={{ borderColor: '#666', background: 'rgba(255,255,255,0.05)' }}>R</th>
                            <th className="px-2 py-1 text-center border font-bold" style={{ borderColor: '#666', background: 'rgba(255,255,255,0.05)' }}>H</th>
                            <th className="px-2 py-1 text-center border font-bold" style={{ borderColor: '#666', background: 'rgba(255,255,255,0.05)' }}>E</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* 先攻チーム */}
                        <tr>
                            <td className="px-2 py-1 border font-medium" style={{ borderColor: '#666' }}>
                                {game.myTeamSide === 'away' ? myTeam.name : opponentTeam.name}
                            </td>
                            {Array.from({ length: maxInnings }, (_, i) => (
                                <td key={i} className="px-2 py-1 text-center border" style={{ borderColor: '#666' }}>
                                    {state.inningScores.away[i] !== undefined ? state.inningScores.away[i] : ''}
                                </td>
                            ))}
                            <td className="px-2 py-1 text-center border font-bold" style={{ borderColor: '#666', background: 'rgba(255,255,255,0.05)' }}>
                                {state.score.away}
                            </td>
                            <td className="px-2 py-1 text-center border" style={{ borderColor: '#666', background: 'rgba(255,255,255,0.05)' }}>
                                {game.events.filter((e): e is PlateAppearanceEvent => e.type === 'plate_appearance' && e.halfInning === 'top' && e.result.category === 'hit').length}
                            </td>
                            <td className="px-2 py-1 text-center border" style={{ borderColor: '#666', background: 'rgba(255,255,255,0.05)' }}>0</td>
                        </tr>
                        {/* 後攻チーム */}
                        <tr>
                            <td className="px-2 py-1 border font-medium" style={{ borderColor: '#666' }}>
                                {game.myTeamSide === 'home' ? myTeam.name : opponentTeam.name}
                            </td>
                            {Array.from({ length: maxInnings }, (_, i) => (
                                <td key={i} className="px-2 py-1 text-center border" style={{ borderColor: '#666' }}>
                                    {state.inningScores.home[i] !== undefined ? state.inningScores.home[i] : ''}
                                </td>
                            ))}
                            <td className="px-2 py-1 text-center border font-bold" style={{ borderColor: '#666', background: 'rgba(255,255,255,0.05)' }}>
                                {state.score.home}
                            </td>
                            <td className="px-2 py-1 text-center border" style={{ borderColor: '#666', background: 'rgba(255,255,255,0.05)' }}>
                                {game.events.filter((e): e is PlateAppearanceEvent => e.type === 'plate_appearance' && e.halfInning === 'bottom' && e.result.category === 'hit').length}
                            </td>
                            <td className="px-2 py-1 text-center border" style={{ borderColor: '#666', background: 'rgba(255,255,255,0.05)' }}>0</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* スコアシート本体（横スクロール対応） */}
            <div className="flex-1 overflow-auto">
                <table style={{ borderCollapse: 'collapse', minWidth: `${orderColW + nameColW + numColW + posColW + maxInnings * cellW}px` }}>
                    {/* テーブルヘッダー */}
                    <thead>
                        <tr>
                            <th
                                className="text-xs font-bold text-center border sticky left-0 z-10"
                                style={{ width: orderColW, height: headerH, borderColor: '#555', background: '#2a3a2a', color: '#9c9' }}
                            >
                                打順
                            </th>
                            <th
                                className="text-xs font-bold text-center border sticky z-10"
                                style={{ width: nameColW, height: headerH, borderColor: '#555', background: '#2a3a2a', color: '#9c9', left: orderColW }}
                            >
                                名前
                            </th>
                            <th
                                className="text-xs font-bold text-center border sticky z-10"
                                style={{ width: numColW, height: headerH, borderColor: '#555', background: '#2a3a2a', color: '#9c9', left: orderColW + nameColW }}
                            >
                                背番号
                            </th>
                            <th
                                className="text-xs font-bold text-center border sticky z-10"
                                style={{ width: posColW, height: headerH, borderColor: '#555', background: '#2a3a2a', color: '#9c9', left: orderColW + nameColW + numColW }}
                            >
                                守備
                            </th>
                            {Array.from({ length: maxInnings }, (_, i) => (
                                <th
                                    key={i}
                                    className="text-sm font-bold text-center border"
                                    style={{ width: cellW, height: headerH, borderColor: '#555', background: '#2a3a2a', color: '#9c9' }}
                                >
                                    {i + 1}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {myTeam.battingOrder.map((playerId, rowIdx) => {
                            const player = myTeam.players.find(p => p.id === playerId);
                            if (!player) return null;

                            const playerPAs = battingData.get(playerId) || [];

                            return (
                                <tr key={playerId}>
                                    {/* 打順 */}
                                    <td
                                        className="text-sm font-bold text-center border sticky left-0 z-10"
                                        style={{ width: orderColW, height: cellH, borderColor: '#555', background: '#1a2a1a', color: '#8b8' }}
                                    >
                                        {rowIdx + 1}
                                    </td>
                                    {/* 名前 */}
                                    <td
                                        className="text-xs font-medium border sticky z-10 px-1"
                                        style={{ width: nameColW, height: cellH, borderColor: '#555', background: '#1a2a1a', color: '#ddd', left: orderColW }}
                                    >
                                        {player.name}
                                    </td>
                                    {/* 背番号 */}
                                    <td
                                        className="text-xs text-center border sticky z-10"
                                        style={{ width: numColW, height: cellH, borderColor: '#555', background: '#1a2a1a', color: '#ddd', left: orderColW + nameColW }}
                                    >
                                        {player.number}
                                    </td>
                                    {/* 守備位置 */}
                                    <td
                                        className="text-xs text-center border sticky z-10"
                                        style={{ width: posColW, height: cellH, borderColor: '#555', background: '#1a2a1a', color: '#ddd', left: orderColW + nameColW + numColW }}
                                    >
                                        {POS_LABELS[player.position] || '?'}
                                    </td>
                                    {/* 各イニングのセル */}
                                    {Array.from({ length: maxInnings }, (_, inningIdx) => {
                                        // このイニングでのこの打者の打席を取得
                                        const pa = playerPAs.find(p => p.inning === inningIdx + 1);

                                        let cellData: ScoreSheetCellData | undefined;
                                        if (pa) {
                                            const outCount = outCountMap.get(pa.id) || 0;
                                            cellData = {
                                                pa,
                                                outCountAfter: outCount,
                                                batterReachedBase: getBatterReachedBase(pa),
                                                scored: didBatterScore(game, pa),
                                            };
                                        }

                                        return (
                                            <td
                                                key={inningIdx}
                                                className="p-0 border"
                                                style={{
                                                    width: cellW,
                                                    height: cellH,
                                                    borderColor: '#555',
                                                    background: pa ? '#f5f0e6' : '#faf8f2',
                                                }}
                                            >
                                                <ScoreSheetCell
                                                    data={cellData}
                                                    width={cellW}
                                                    height={cellH}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}

                        {/* イニング集計行 */}
                        <tr>
                            <td
                                colSpan={4}
                                className="text-xs font-bold text-right px-2 border sticky left-0 z-10"
                                style={{ borderColor: '#555', background: '#2a3a2a', color: '#9c9', height: '24px' }}
                            >
                                安打/四死/三振
                            </td>
                            {Array.from({ length: maxInnings }, (_, i) => {
                                const stats = getInningStats(game, myHalf, i + 1);
                                return (
                                    <td
                                        key={i}
                                        className="text-xs text-center border"
                                        style={{ borderColor: '#555', background: '#2a3a2a', color: '#ccc' }}
                                    >
                                        {stats.hits}/{stats.walks}/{stats.strikeouts}
                                    </td>
                                );
                            })}
                        </tr>
                        <tr>
                            <td
                                colSpan={4}
                                className="text-xs font-bold text-right px-2 border sticky left-0 z-10"
                                style={{ borderColor: '#555', background: '#2a3a2a', color: '#9c9', height: '24px' }}
                            >
                                得点
                            </td>
                            {Array.from({ length: maxInnings }, (_, i) => {
                                const side = game.myTeamSide === 'home' ? 'home' : 'away';
                                const runs = state.inningScores[side][i];
                                return (
                                    <td
                                        key={i}
                                        className="text-sm font-bold text-center border"
                                        style={{ borderColor: '#555', background: '#2a3a2a', color: runs ? '#ff6' : '#888' }}
                                    >
                                        {runs !== undefined ? runs : ''}
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
