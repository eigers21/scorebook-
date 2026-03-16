'use client';

// ========================================
// スコアシートセルコンポーネント
// 1打者×1打席分のダイヤモンド+走者パス線+結果記号をSVGで描画
// ========================================

import { PlateAppearanceEvent } from '@/types';

/** セルに表示するデータ */
export interface ScoreSheetCellData {
    /** 打席イベント */
    pa: PlateAppearanceEvent;
    /** この打席時点でのアウトカウント（打席結果適用後） */
    outCountAfter: number;
    /** 打者が最終的に到達した塁 (1=1塁, 2=2塁, 3=3塁, 4=得点) */
    batterReachedBase: number;
    /** 走者として得点したか */
    scored: boolean;
}

interface ScoreSheetCellProps {
    /** セルデータ（なければ空セル） */
    data?: ScoreSheetCellData;
    /** セルの幅 */
    width: number;
    /** セルの高さ */
    height: number;
}

/** 結果カテゴリからスコアシート用の短縮記号を生成 */
function getResultNotation(pa: PlateAppearanceEvent): { mark: string; code: string } {
    const cat = pa.result.category;
    const resultCode = pa.result.code;

    // 三振
    if (resultCode === 'K') return { mark: '', code: 'K' };
    if (resultCode === 'KK') return { mark: '', code: 'Ks' };

    // 四球
    if (resultCode === 'BB') return { mark: 'B', code: '' };

    // 死球
    if (resultCode === 'HBP') return { mark: '', code: 'DB' };

    // 犠打
    if (resultCode === 'SAC') return { mark: '', code: '犠' };
    // 犠飛
    if (resultCode === 'SF') return { mark: '', code: '犠飛' };

    // 本塁打
    if (resultCode.startsWith('HR')) return { mark: '●', code: 'HR' };

    // 安打系
    if (cat === 'hit') {
        // 打球方向の守備番号を取得
        const dir = resultCode.split('-')[1]; // L, C, R, IN
        const dirNum = dir === 'L' ? '7' : dir === 'C' ? '8' : dir === 'R' ? '9' : '';
        return { mark: '●', code: dirNum };
    }

    // ゴロアウト（例: GO-6 → 6-3のような記法、簡易的に守備番号を表示）
    if (resultCode.startsWith('GO-')) {
        const fielder = resultCode.split('-')[1];
        return { mark: '', code: fielder };
    }

    // フライアウト
    if (resultCode.startsWith('FO-')) {
        const fielder = resultCode.split('-')[1];
        return { mark: '', code: fielder };
    }

    // ライナーアウト
    if (resultCode.startsWith('LO-')) {
        const fielder = resultCode.split('-')[1];
        return { mark: '', code: fielder };
    }

    // 失策
    if (resultCode.startsWith('E-')) {
        const fielder = resultCode.split('-')[1];
        return { mark: 'E', code: fielder };
    }

    // 野選
    if (resultCode === 'FC') return { mark: '', code: 'FC' };

    // 打撃妨害
    if (resultCode === 'INT') return { mark: '', code: '妨' };

    return { mark: '', code: resultCode };
}

/** アウトカウントをローマ数字に変換 */
function toRoman(n: number): string {
    if (n === 1) return 'I';
    if (n === 2) return 'II';
    if (n === 3) return 'III';
    return String(n);
}

export default function ScoreSheetCell({ data, width, height }: ScoreSheetCellProps) {
    // 空セル
    if (!data) {
        return (
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                <rect x={0} y={0} width={width} height={height} fill="none" stroke="#888" strokeWidth={0.5} />
            </svg>
        );
    }

    const { pa, outCountAfter, batterReachedBase, scored } = data;
    const cat = pa.result.category;
    const isOut = cat === 'out' || cat === 'sacrifice_bunt' || cat === 'sacrifice_fly';
    const isHit = cat === 'hit';
    const isWalk = cat === 'walk' || cat === 'hit_by_pitch';
    const isError = cat === 'error';

    // ダイヤモンドの座標（セル中央にダイヤモンドを配置）
    const cx = width / 2;
    const cy = height / 2 - 2;
    const ds = Math.min(width, height) * 0.28; // ダイヤモンドサイズ

    // ダイヤモンドの4頂点 (本塁=下, 1塁=右, 2塁=上, 3塁=左)
    const home = { x: cx, y: cy + ds };
    const first = { x: cx + ds, y: cy };
    const second = { x: cx, y: cy - ds };
    const third = { x: cx - ds, y: cy };

    // 結果記号
    const { mark, code } = getResultNotation(pa);

    // 走者パス線を生成
    // 到達塁: 1=1塁, 2=2塁, 3=3塁, 4=得点（一周）
    const reachedBase = scored ? 4 : batterReachedBase;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* セル枠 */}
            <rect x={0} y={0} width={width} height={height} fill="none" stroke="#888" strokeWidth={0.5} />

            {/* ダイヤモンド（基本の薄い線） */}
            <line x1={home.x} y1={home.y} x2={first.x} y2={first.y} stroke="#999" strokeWidth={0.5} />
            <line x1={first.x} y1={first.y} x2={second.x} y2={second.y} stroke="#999" strokeWidth={0.5} />
            <line x1={second.x} y1={second.y} x2={third.x} y2={third.y} stroke="#999" strokeWidth={0.5} />
            <line x1={third.x} y1={third.y} x2={home.x} y2={home.y} stroke="#999" strokeWidth={0.5} />

            {/* 到達塁までの太い走者パス線 */}
            {reachedBase >= 1 && (
                <line
                    x1={home.x} y1={home.y} x2={first.x} y2={first.y}
                    stroke={isHit ? '#d00' : '#333'}
                    strokeWidth={isHit ? 2.5 : 1.5}
                />
            )}
            {reachedBase >= 2 && (
                <line
                    x1={first.x} y1={first.y} x2={second.x} y2={second.y}
                    stroke={isHit ? '#d00' : '#333'}
                    strokeWidth={isHit ? 2.5 : 1.5}
                />
            )}
            {reachedBase >= 3 && (
                <line
                    x1={second.x} y1={second.y} x2={third.x} y2={third.y}
                    stroke={isHit ? '#d00' : '#333'}
                    strokeWidth={isHit ? 2.5 : 1.5}
                />
            )}
            {reachedBase >= 4 && (
                <line
                    x1={third.x} y1={third.y} x2={home.x} y2={home.y}
                    stroke={isHit ? '#d00' : '#333'}
                    strokeWidth={isHit ? 2.5 : 1.5}
                />
            )}

            {/* 安打マーク（●） - ダイヤモンド中央 */}
            {isHit && (
                <circle cx={cx} cy={cy} r={ds * 0.22} fill="#d00" />
            )}

            {/* 四球のBマーク */}
            {mark === 'B' && (
                <text
                    x={cx} y={cy + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={ds * 0.7}
                    fontWeight="bold"
                    fill="#28a"
                >
                    B
                </text>
            )}

            {/* 三振のKマーク */}
            {(code === 'K' || code === 'Ks') && (
                <text
                    x={cx} y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={ds * 0.8}
                    fontWeight="bold"
                    fill="#333"
                >
                    {code === 'Ks' ? 'Ks' : 'K'}
                </text>
            )}

            {/* 失策のEマーク */}
            {mark === 'E' && (
                <text
                    x={cx} y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={ds * 0.65}
                    fontWeight="bold"
                    fill="#c70"
                >
                    E
                </text>
            )}

            {/* アウトカウント表示（ローマ数字） - ダイヤモンド上部 */}
            {isOut && outCountAfter > 0 && (
                <text
                    x={cx} y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={ds * 0.65}
                    fontWeight="bold"
                    fill="#333"
                >
                    {toRoman(outCountAfter)}
                </text>
            )}

            {/* 結果コード（下部に表示） */}
            {code && code !== 'K' && code !== 'Ks' && (
                <text
                    x={cx} y={height - 3}
                    textAnchor="middle"
                    fontSize={Math.min(9, width * 0.18)}
                    fill="#555"
                >
                    {code}
                </text>
            )}

            {/* 得点マーク（ホームへの到達を示す塗りつぶし円） */}
            {scored && (
                <circle
                    cx={home.x} cy={home.y}
                    r={2.5}
                    fill="#d00"
                    stroke="#d00"
                    strokeWidth={0.5}
                />
            )}
        </svg>
    );
}
