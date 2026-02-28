'use client';

// ========================================
// スコアボード - イニングごとの得点表示
// ========================================

import { Game, GameState } from '@/types';

interface ScoreboardProps {
    game: Game;
    gameState: GameState;
}

export default function Scoreboard({ game, gameState }: ScoreboardProps) {
    const maxInnings = Math.max(
        game.innings,
        gameState.inningScores.home.length,
        gameState.inningScores.away.length
    );

    return (
        <div className="glass-card p-4 overflow-x-auto">
            <table className="w-full text-center text-sm" style={{ minWidth: '320px' }}>
                <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                        <th className="text-left py-2 px-2 font-medium text-xs w-24">チーム</th>
                        {Array.from({ length: maxInnings }, (_, i) => (
                            <th key={i} className="py-2 px-1 font-medium text-xs w-8">
                                {i + 1}
                            </th>
                        ))}
                        <th className="py-2 px-2 font-bold text-xs w-10" style={{ color: 'var(--accent-blue)' }}>
                            計
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {/* アウェイチーム（先攻） */}
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td className="text-left py-2.5 px-2 font-semibold text-sm truncate max-w-[96px]">
                            {game.awayTeam.name}
                        </td>
                        {Array.from({ length: maxInnings }, (_, i) => {
                            const score = gameState.inningScores.away[i];
                            const isCurrent = gameState.inning === i + 1 && gameState.halfInning === 'top';
                            return (
                                <td
                                    key={i}
                                    className="py-2.5 px-1 font-mono"
                                    style={{
                                        color: isCurrent ? 'var(--accent-blue)' : 'var(--text-primary)',
                                        fontWeight: isCurrent ? 700 : 400,
                                        background: isCurrent ? 'var(--accent-blue-glow)' : 'transparent',
                                        borderRadius: '6px',
                                    }}
                                >
                                    {score !== undefined ? score : '-'}
                                </td>
                            );
                        })}
                        <td
                            className="py-2.5 px-2 font-bold font-mono text-base"
                            style={{ color: 'var(--accent-blue)' }}
                        >
                            {gameState.score.away}
                        </td>
                    </tr>

                    {/* ホームチーム（後攻） */}
                    <tr>
                        <td className="text-left py-2.5 px-2 font-semibold text-sm truncate max-w-[96px]">
                            {game.homeTeam.name}
                        </td>
                        {Array.from({ length: maxInnings }, (_, i) => {
                            const score = gameState.inningScores.home[i];
                            const isCurrent = gameState.inning === i + 1 && gameState.halfInning === 'bottom';
                            return (
                                <td
                                    key={i}
                                    className="py-2.5 px-1 font-mono"
                                    style={{
                                        color: isCurrent ? 'var(--accent-green)' : 'var(--text-primary)',
                                        fontWeight: isCurrent ? 700 : 400,
                                        background: isCurrent ? 'var(--accent-green-glow)' : 'transparent',
                                        borderRadius: '6px',
                                    }}
                                >
                                    {score !== undefined ? score : '-'}
                                </td>
                            );
                        })}
                        <td
                            className="py-2.5 px-2 font-bold font-mono text-base"
                            style={{ color: 'var(--accent-green)' }}
                        >
                            {gameState.score.home}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
