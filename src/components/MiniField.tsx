'use client';

// ========================================
// ミニグラウンドUI - ダイヤモンド型SVGでランナー表示
// ========================================

import { RunnerState, Base, RunnerEventKind, RUNNER_EVENT_LABELS, UUID } from '@/types';

interface MiniFieldProps {
    runners: RunnerState;
    outs: number;
    onBaseClick: (base: Base, runnerId: UUID) => void;
    getPlayerName: (id: UUID) => string;
}

export default function MiniField({ runners, outs, onBaseClick, getPlayerName }: MiniFieldProps) {
    // SVGの中心座標とサイズ
    const cx = 150;
    const cy = 150;
    const diamondSize = 80;

    // 各塁の座標（ダイヤモンド形状）
    const bases = {
        home: { x: cx, y: cy + diamondSize },
        first: { x: cx + diamondSize, y: cy },
        second: { x: cx, y: cy - diamondSize },
        third: { x: cx - diamondSize, y: cy },
    };

    // ランナーの描画色
    const runnerColor = '#3b82f6';
    const emptyBaseColor = '#334155';
    const baseStroke = '#64748b';

    return (
        <div className="glass-card p-4">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    グラウンド状況
                </h3>
                {/* アウトカウント表示 */}
                <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>OUT</span>
                    <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                            <div
                                key={i}
                                className="w-5 h-5 rounded-full border-2 transition-all duration-200"
                                style={{
                                    borderColor: i < outs ? 'var(--accent-red)' : 'var(--border-color)',
                                    background: i < outs ? 'var(--accent-red)' : 'transparent',
                                    boxShadow: i < outs ? '0 0 8px rgba(239, 68, 68, 0.4)' : 'none',
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* SVGフィールド */}
            <div className="flex justify-center">
                <svg width="300" height="260" viewBox="0 0 300 260" className="select-none">
                    {/* 外野の芝生（背景円弧） */}
                    <path
                        d={`M ${cx - 130} ${cy + 20} A 130 130 0 0 1 ${cx + 130} ${cy + 20}`}
                        fill="var(--field-green)"
                        opacity="0.3"
                    />

                    {/* 内野の土（ダイヤモンド内側） */}
                    <polygon
                        points={`${bases.home.x},${bases.home.y} ${bases.first.x},${bases.first.y} ${bases.second.x},${bases.second.y} ${bases.third.x},${bases.third.y}`}
                        fill="var(--field-green-light)"
                        opacity="0.2"
                    />

                    {/* 塁間の線 */}
                    <line x1={bases.home.x} y1={bases.home.y} x2={bases.first.x} y2={bases.first.y} stroke={baseStroke} strokeWidth="2" opacity="0.5" />
                    <line x1={bases.first.x} y1={bases.first.y} x2={bases.second.x} y2={bases.second.y} stroke={baseStroke} strokeWidth="2" opacity="0.5" />
                    <line x1={bases.second.x} y1={bases.second.y} x2={bases.third.x} y2={bases.third.y} stroke={baseStroke} strokeWidth="2" opacity="0.5" />
                    <line x1={bases.third.x} y1={bases.third.y} x2={bases.home.x} y2={bases.home.y} stroke={baseStroke} strokeWidth="2" opacity="0.5" />

                    {/* ホームベース（五角形） */}
                    <polygon
                        points={`${bases.home.x},${bases.home.y + 12} ${bases.home.x - 8},${bases.home.y + 4} ${bases.home.x - 8},${bases.home.y - 4} ${bases.home.x + 8},${bases.home.y - 4} ${bases.home.x + 8},${bases.home.y + 4}`}
                        fill="#f1f5f9"
                        stroke="#94a3b8"
                        strokeWidth="1"
                    />

                    {/* 一塁 */}
                    <g
                        onClick={() => runners.first && onBaseClick('first', runners.first)}
                        style={{ cursor: runners.first ? 'pointer' : 'default' }}
                    >
                        <rect
                            x={bases.first.x - 14}
                            y={bases.first.y - 14}
                            width="28"
                            height="28"
                            rx="4"
                            transform={`rotate(45 ${bases.first.x} ${bases.first.y})`}
                            fill={runners.first ? runnerColor : emptyBaseColor}
                            stroke={runners.first ? runnerColor : baseStroke}
                            strokeWidth="2"
                            style={{
                                transition: 'all 0.3s ease',
                                filter: runners.first ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' : 'none',
                            }}
                        />
                        {runners.first && (
                            <text
                                x={bases.first.x}
                                y={bases.first.y + 30}
                                textAnchor="middle"
                                fill="var(--text-primary)"
                                fontSize="10"
                                fontWeight="600"
                            >
                                {getPlayerName(runners.first)}
                            </text>
                        )}
                        <text
                            x={bases.first.x + 24}
                            y={bases.first.y - 14}
                            fill="var(--text-muted)"
                            fontSize="10"
                        >
                            1B
                        </text>
                    </g>

                    {/* 二塁 */}
                    <g
                        onClick={() => runners.second && onBaseClick('second', runners.second)}
                        style={{ cursor: runners.second ? 'pointer' : 'default' }}
                    >
                        <rect
                            x={bases.second.x - 14}
                            y={bases.second.y - 14}
                            width="28"
                            height="28"
                            rx="4"
                            transform={`rotate(45 ${bases.second.x} ${bases.second.y})`}
                            fill={runners.second ? runnerColor : emptyBaseColor}
                            stroke={runners.second ? runnerColor : baseStroke}
                            strokeWidth="2"
                            style={{
                                transition: 'all 0.3s ease',
                                filter: runners.second ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' : 'none',
                            }}
                        />
                        {runners.second && (
                            <text
                                x={bases.second.x}
                                y={bases.second.y - 24}
                                textAnchor="middle"
                                fill="var(--text-primary)"
                                fontSize="10"
                                fontWeight="600"
                            >
                                {getPlayerName(runners.second)}
                            </text>
                        )}
                        <text
                            x={bases.second.x + 24}
                            y={bases.second.y - 14}
                            fill="var(--text-muted)"
                            fontSize="10"
                        >
                            2B
                        </text>
                    </g>

                    {/* 三塁 */}
                    <g
                        onClick={() => runners.third && onBaseClick('third', runners.third)}
                        style={{ cursor: runners.third ? 'pointer' : 'default' }}
                    >
                        <rect
                            x={bases.third.x - 14}
                            y={bases.third.y - 14}
                            width="28"
                            height="28"
                            rx="4"
                            transform={`rotate(45 ${bases.third.x} ${bases.third.y})`}
                            fill={runners.third ? runnerColor : emptyBaseColor}
                            stroke={runners.third ? runnerColor : baseStroke}
                            strokeWidth="2"
                            style={{
                                transition: 'all 0.3s ease',
                                filter: runners.third ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))' : 'none',
                            }}
                        />
                        {runners.third && (
                            <text
                                x={bases.third.x}
                                y={bases.third.y + 30}
                                textAnchor="middle"
                                fill="var(--text-primary)"
                                fontSize="10"
                                fontWeight="600"
                            >
                                {getPlayerName(runners.third)}
                            </text>
                        )}
                        <text
                            x={bases.third.x - 34}
                            y={bases.third.y - 14}
                            fill="var(--text-muted)"
                            fontSize="10"
                        >
                            3B
                        </text>
                    </g>
                </svg>
            </div>

            {/* ランナー状況テキスト */}
            <div className="mt-2 flex flex-wrap gap-2 justify-center">
                {runners.first && (
                    <span className="badge badge-blue">1塁: {getPlayerName(runners.first)}</span>
                )}
                {runners.second && (
                    <span className="badge badge-green">2塁: {getPlayerName(runners.second)}</span>
                )}
                {runners.third && (
                    <span className="badge badge-amber">3塁: {getPlayerName(runners.third)}</span>
                )}
                {!runners.first && !runners.second && !runners.third && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>ランナーなし</span>
                )}
            </div>
        </div>
    );
}

// ========================================
// ランナーイベント選択モーダル
// ========================================
interface RunnerEventModalProps {
    isOpen: boolean;
    base: Base;
    runnerId: UUID;
    runnerName: string;
    onSelect: (eventKind: RunnerEventKind, toBase: Base | 'out' | 'score') => void;
    onClose: () => void;
}

export function RunnerEventModal({ isOpen, base, runnerId, runnerName, onSelect, onClose }: RunnerEventModalProps) {
    if (!isOpen) return null;

    // 各塁から可能なイベント
    type EventOption = {
        kind: RunnerEventKind;
        label: string;
        toBase: Base | 'out' | 'score';
        icon: string;
        color: string;
    };

    const getOptions = (): EventOption[] => {
        const options: EventOption[] = [];

        // 盗塁（次の塁へ）
        if (base === 'first') {
            options.push({ kind: 'stolen_base', label: '盗塁（二塁へ）', toBase: 'second', icon: '🏃', color: 'var(--accent-green)' });
        } else if (base === 'second') {
            options.push({ kind: 'stolen_base', label: '盗塁（三塁へ）', toBase: 'third', icon: '🏃', color: 'var(--accent-green)' });
        } else if (base === 'third') {
            options.push({ kind: 'stolen_base', label: '盗塁（本塁へ）', toBase: 'score', icon: '🏃', color: 'var(--accent-green)' });
        }

        // 盗塁死
        options.push({ kind: 'caught_stealing', label: '盗塁死', toBase: 'out', icon: '❌', color: 'var(--accent-red)' });

        // 牽制死
        options.push({ kind: 'pickoff', label: '牽制死', toBase: 'out', icon: '🚫', color: 'var(--accent-red)' });

        // 暴投進塁
        if (base === 'first') {
            options.push({ kind: 'wild_pitch', label: '暴投進塁（二塁へ）', toBase: 'second', icon: '⚾', color: 'var(--accent-amber)' });
        } else if (base === 'second') {
            options.push({ kind: 'wild_pitch', label: '暴投進塁（三塁へ）', toBase: 'third', icon: '⚾', color: 'var(--accent-amber)' });
        } else if (base === 'third') {
            options.push({ kind: 'wild_pitch', label: '暴投生還', toBase: 'score', icon: '⚾', color: 'var(--accent-amber)' });
        }

        // 捕逸進塁
        if (base === 'first') {
            options.push({ kind: 'passed_ball', label: '捕逸進塁（二塁へ）', toBase: 'second', icon: '🧤', color: 'var(--accent-amber)' });
        } else if (base === 'second') {
            options.push({ kind: 'passed_ball', label: '捕逸進塁（三塁へ）', toBase: 'third', icon: '🧤', color: 'var(--accent-amber)' });
        } else if (base === 'third') {
            options.push({ kind: 'passed_ball', label: '捕逸生還', toBase: 'score', icon: '🧤', color: 'var(--accent-amber)' });
        }

        // ボーク進塁
        if (base === 'first') {
            options.push({ kind: 'balk', label: 'ボーク（二塁へ）', toBase: 'second', icon: '⚠️', color: 'var(--accent-purple)' });
        } else if (base === 'second') {
            options.push({ kind: 'balk', label: 'ボーク（三塁へ）', toBase: 'third', icon: '⚠️', color: 'var(--accent-purple)' });
        } else if (base === 'third') {
            options.push({ kind: 'balk', label: 'ボーク（本塁へ）', toBase: 'score', icon: '⚠️', color: 'var(--accent-purple)' });
        }

        return options;
    };

    const options = getOptions();

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">
                        ランナーイベント
                    </h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                        ✕
                    </button>
                </div>

                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-semibold">{runnerName}</span>
                    {base === 'first' && '（一塁）'}
                    {base === 'second' && '（二塁）'}
                    {base === 'third' && '（三塁）'}
                </p>

                <div className="space-y-2">
                    {options.map((opt, i) => (
                        <button
                            key={i}
                            onClick={() => onSelect(opt.kind, opt.toBase)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02]"
                            style={{
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                            }}
                        >
                            <span className="text-xl">{opt.icon}</span>
                            <span className="font-medium">{opt.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
