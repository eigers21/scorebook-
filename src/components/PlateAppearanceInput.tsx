'use client';

// ========================================
// 打席結果入力コンポーネント - 2段階選択UI
// ========================================

import { useState } from 'react';
import { RESULT_CATEGORIES, ResultCategoryGroup, ResultOption } from '@/data/masterData';

interface PlateAppearanceInputProps {
    batterName: string;
    batterNumber: number;
    onSelect: (result: ResultOption) => void;
    onCancel: () => void;
}

export default function PlateAppearanceInput({
    batterName,
    batterNumber,
    onSelect,
    onCancel,
}: PlateAppearanceInputProps) {
    const [selectedCategory, setSelectedCategory] = useState<ResultCategoryGroup | null>(null);

    return (
        <div className="glass-card p-4 animate-fade-in">
            {/* ヘッダー：打者情報 */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                        style={{
                            background: 'linear-gradient(135deg, var(--accent-blue), #2563eb)',
                            boxShadow: '0 0 12px var(--accent-blue-glow)',
                        }}
                    >
                        {batterNumber}
                    </div>
                    <div>
                        <p className="font-bold text-base">{batterName}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>打席結果を選択</p>
                    </div>
                </div>
                <button
                    onClick={onCancel}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    キャンセル
                </button>
            </div>

            {/* ステップ1: カテゴリ選択 */}
            {!selectedCategory && (
                <div>
                    <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                        結果カテゴリを選択
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {RESULT_CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat)}
                                className="category-btn"
                            >
                                <span className="text-xl">{cat.icon}</span>
                                <span className="text-xs">{cat.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ステップ2: 詳細選択 */}
            {selectedCategory && (
                <div className="animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                            style={{ background: 'var(--bg-tertiary)' }}
                        >
                            ←
                        </button>
                        <p className="text-sm font-semibold">
                            {selectedCategory.icon} {selectedCategory.label}
                        </p>
                    </div>

                    <div className="selection-grid">
                        {selectedCategory.options.map(opt => (
                            <button
                                key={opt.code}
                                onClick={() => onSelect(opt)}
                                className="selection-btn"
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
