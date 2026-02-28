'use client';

// ========================================
// イベントログ表示コンポーネント
// ========================================

import { GameEvent, Game, RUNNER_EVENT_LABELS } from '@/types';
import { getPlayerName } from '@/lib/gameEngine';

interface EventLogProps {
    events: GameEvent[];
    game: Game;
    onUndo: () => void;
}

export default function EventLog({ events, game, onUndo }: EventLogProps) {
    // 最新10件を逆順で表示
    const recentEvents = [...events].reverse().slice(0, 10);

    /** イベントの説明文を生成 */
    function describeEvent(event: GameEvent): string {
        const inningLabel = `${event.inning}回${event.halfInning === 'top' ? '表' : '裏'}`;

        switch (event.type) {
            case 'plate_appearance': {
                const batterName = getPlayerName(game, event.batterId);
                let desc = `${batterName}: ${event.result.label}`;
                if (event.rbiList.length > 0) {
                    desc += ` (${event.rbiList.length}打点)`;
                }
                return desc;
            }
            case 'runner_event': {
                const runnerName = getPlayerName(game, event.runnerId);
                return `${runnerName}: ${RUNNER_EVENT_LABELS[event.eventKind]}`;
            }
            case 'inning_change':
                return `→ ${event.newInning}回${event.newHalfInning === 'top' ? '表' : '裏'}`;
            case 'pitcher_change': {
                const outName = getPlayerName(game, event.outPitcherId);
                const inName = getPlayerName(game, event.inPitcherId);
                return `投手交代: ${outName} → ${inName}`;
            }
            default:
                return '不明なイベント';
        }
    }

    /** イベントのアイコンを取得 */
    function getEventIcon(event: GameEvent): string {
        switch (event.type) {
            case 'plate_appearance':
                if (event.result.category === 'hit') return '🏏';
                if (event.result.category === 'out') return '👊';
                if (event.result.category === 'walk' || event.result.category === 'hit_by_pitch') return '🚶';
                if (event.result.category === 'error') return '⚠️';
                return '⚾';
            case 'runner_event':
                if (event.eventKind === 'stolen_base') return '🏃';
                if (event.toBase === 'out') return '❌';
                return '➡️';
            case 'inning_change':
                return '🔄';
            case 'pitcher_change':
                return '🔁';
            default:
                return '⚾';
        }
    }

    /** イベントのイニングラベル */
    function getInningLabel(event: GameEvent): string {
        return `${event.inning}回${event.halfInning === 'top' ? '表' : '裏'}`;
    }

    return (
        <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    プレイ履歴
                </h3>
                {events.length > 0 && (
                    <button
                        onClick={onUndo}
                        className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                        style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: 'var(--accent-red)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}
                    >
                        ↩ 取消
                    </button>
                )}
            </div>

            {recentEvents.length === 0 ? (
                <p className="text-center text-xs py-4" style={{ color: 'var(--text-muted)' }}>
                    プレイ履歴はまだありません
                </p>
            ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {recentEvents.map((event, i) => (
                        <div
                            key={event.id}
                            className="flex items-center gap-2.5 p-2 rounded-lg transition-all"
                            style={{
                                background: i === 0 ? 'var(--accent-blue-glow)' : 'transparent',
                                opacity: i === 0 ? 1 : 0.7 + (1 - i / recentEvents.length) * 0.3,
                            }}
                        >
                            <span className="text-base flex-shrink-0">{getEventIcon(event)}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{describeEvent(event)}</p>
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                    {getInningLabel(event)}
                                    {event.type === 'plate_appearance' && ` / ${event.outs}アウト`}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
