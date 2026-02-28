// ========================================
// 打席結果マスターデータ
// ========================================

import { ResultCategory } from '@/types';

/** 打席結果の選択肢 */
export interface ResultOption {
    code: string;           // 結果コード
    label: string;          // 表示用テキスト
    category: ResultCategory;
    hitBases?: number;      // 安打の場合の到達塁数 (1=単打, 2=二塁打, 3=三塁打, 4=本塁打)
    isOut?: boolean;        // アウトになるか
    isAtBat?: boolean;      // 打数にカウントするか
}

/** 守備位置番号から日本語略称を取得 */
const FIELDER_NAMES: Record<number, string> = {
    1: '投',
    2: '捕',
    3: '一',
    4: '二',
    5: '三',
    6: '遊',
    7: '左',
    8: '中',
    9: '右',
};

/** 打球方向 */
const DIRECTIONS: { code: string; label: string }[] = [
    { code: 'L', label: '左' },
    { code: 'C', label: '中' },
    { code: 'R', label: '右' },
];

// ========================================
// カテゴリ別の選択肢を生成
// ========================================

/** 安打の選択肢 */
export const HIT_OPTIONS: ResultOption[] = [
    // 単打
    ...DIRECTIONS.map(d => ({
        code: `H1-${d.code}`,
        label: `${d.label}安打`,
        category: 'hit' as ResultCategory,
        hitBases: 1,
        isOut: false,
        isAtBat: true,
    })),
    { code: 'H1-IN', label: '内野安打', category: 'hit', hitBases: 1, isOut: false, isAtBat: true },
    // 二塁打
    ...DIRECTIONS.map(d => ({
        code: `H2-${d.code}`,
        label: `${d.label}二塁打`,
        category: 'hit' as ResultCategory,
        hitBases: 2,
        isOut: false,
        isAtBat: true,
    })),
    // 三塁打
    ...DIRECTIONS.map(d => ({
        code: `H3-${d.code}`,
        label: `${d.label}三塁打`,
        category: 'hit' as ResultCategory,
        hitBases: 3,
        isOut: false,
        isAtBat: true,
    })),
    // 本塁打
    ...DIRECTIONS.map(d => ({
        code: `HR-${d.code}`,
        label: `${d.label}本塁打`,
        category: 'hit' as ResultCategory,
        hitBases: 4,
        isOut: false,
        isAtBat: true,
    })),
];

/** ゴロアウトの選択肢 */
export const GROUNDOUT_OPTIONS: ResultOption[] = Array.from({ length: 6 }, (_, i) => ({
    code: `GO-${i + 1}`,
    label: `${FIELDER_NAMES[i + 1]}ゴロ`,
    category: 'out' as ResultCategory,
    isOut: true,
    isAtBat: true,
}));

/** フライアウトの選択肢 */
export const FLYOUT_OPTIONS: ResultOption[] = Array.from({ length: 9 }, (_, i) => ({
    code: `FO-${i + 1}`,
    label: `${FIELDER_NAMES[i + 1]}飛`,
    category: 'out' as ResultCategory,
    isOut: true,
    isAtBat: true,
}));

/** ライナーアウトの選択肢 */
export const LINEOUT_OPTIONS: ResultOption[] = Array.from({ length: 9 }, (_, i) => ({
    code: `LO-${i + 1}`,
    label: `${FIELDER_NAMES[i + 1]}直`,
    category: 'out' as ResultCategory,
    isOut: true,
    isAtBat: true,
}));

/** 三振の選択肢 */
export const STRIKEOUT_OPTIONS: ResultOption[] = [
    { code: 'K', label: '三振', category: 'out', isOut: true, isAtBat: true },
    { code: 'KK', label: '見逃し三振', category: 'out', isOut: true, isAtBat: true },
];

/** 四死球の選択肢 */
export const WALK_OPTIONS: ResultOption[] = [
    { code: 'BB', label: '四球', category: 'walk', isOut: false, isAtBat: false },
    { code: 'HBP', label: '死球', category: 'hit_by_pitch', isOut: false, isAtBat: false },
];

/** 犠打・犠飛の選択肢 */
export const SACRIFICE_OPTIONS: ResultOption[] = [
    { code: 'SAC', label: '犠打', category: 'sacrifice_bunt', isOut: true, isAtBat: false },
    { code: 'SF', label: '犠飛', category: 'sacrifice_fly', isOut: true, isAtBat: false },
];

/** 失策の選択肢 */
export const ERROR_OPTIONS: ResultOption[] = Array.from({ length: 9 }, (_, i) => ({
    code: `E-${i + 1}`,
    label: `${FIELDER_NAMES[i + 1]}失`,
    category: 'error' as ResultCategory,
    isOut: false,
    isAtBat: true,
}));

/** 野選の選択肢 */
export const FIELDERS_CHOICE_OPTIONS: ResultOption[] = [
    { code: 'FC', label: '野選', category: 'fielders_choice', isOut: false, isAtBat: true },
];

/** 打撃妨害 */
export const INTERFERENCE_OPTIONS: ResultOption[] = [
    { code: 'INT', label: '打撃妨害', category: 'interference', isOut: false, isAtBat: false },
];

// ========================================
// カテゴリ一覧（UI表示用）
// ========================================
export interface ResultCategoryGroup {
    id: string;
    label: string;
    icon: string;
    options: ResultOption[];
}

/** 打席結果のカテゴリグループ一覧 */
export const RESULT_CATEGORIES: ResultCategoryGroup[] = [
    { id: 'hit', label: '安打', icon: '🏏', options: HIT_OPTIONS },
    { id: 'groundout', label: 'ゴロ', icon: '⬇️', options: GROUNDOUT_OPTIONS },
    { id: 'flyout', label: 'フライ', icon: '⬆️', options: FLYOUT_OPTIONS },
    { id: 'lineout', label: 'ライナー', icon: '➡️', options: LINEOUT_OPTIONS },
    { id: 'strikeout', label: '三振', icon: '❌', options: STRIKEOUT_OPTIONS },
    { id: 'walk', label: '四死球', icon: '🚶', options: WALK_OPTIONS },
    { id: 'sacrifice', label: '犠打/犠飛', icon: '🤝', options: SACRIFICE_OPTIONS },
    { id: 'error', label: '失策', icon: '⚠️', options: ERROR_OPTIONS },
    { id: 'fc', label: '野選', icon: '🔄', options: FIELDERS_CHOICE_OPTIONS },
    { id: 'interference', label: '妨害', icon: '🚫', options: INTERFERENCE_OPTIONS },
];

/** 全打席結果の選択肢（フラット） */
export const ALL_RESULT_OPTIONS: ResultOption[] = RESULT_CATEGORIES.flatMap(c => c.options);

/** コードから結果オプションを検索 */
export function findResultOption(code: string): ResultOption | undefined {
    return ALL_RESULT_OPTIONS.find(o => o.code === code);
}
