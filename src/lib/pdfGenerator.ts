// ========================================
// 伝統的スコアシート形式 PDF生成
// ========================================

import { jsPDF } from 'jspdf';
import {
    Game, GameState, GameEvent, PlateAppearanceEvent,
    BattingStats, PitchingStats, Player, UUID, HalfInning,
} from '@/types';
import {
    computeGameState, calculateBattingStats, calculatePitchingStats,
    getMyTeam, getOpponentTeam, getPlayerName,
} from '@/lib/gameEngine';

/** PDF出力用: 投球回数を表示形式に変換 */
function formatInningsPitched(ip: number): string {
    const full = Math.floor(ip);
    const frac = Math.round((ip - full) * 10);
    if (frac === 0) return `${full}`;
    return `${full} ${frac}/3`;
}

/** PDF出力用: 打率を表示形式に変換 */
function formatAverage(avg: number): string {
    if (avg === 0) return '---';
    return avg.toFixed(3).replace(/^0/, '');
}

/** スコアシートPDFを生成 */
export function generateScoreSheetPDF(game: Game): void {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
    });

    const pageWidth = 297;
    const pageHeight = 210;
    const margin = 10;

    const state = computeGameState(game);
    const myTeam = getMyTeam(game);
    const opponentTeam = getOpponentTeam(game);

    // フォント設定（標準フォント - 日本語はエンコード制約あり）
    doc.setFont('helvetica');

    // ========================================
    // ヘッダー
    // ========================================
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('BASEBALL SCOREBOOK', pageWidth / 2, margin + 5, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${game.date}  Venue: ${game.venue || '-'}`, pageWidth / 2, margin + 11, { align: 'center' });

    // チーム名とスコア
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const awayLabel = game.awayTeam.name;
    const homeLabel = game.homeTeam.name;
    doc.text(`${awayLabel}  ${state.score.away}  -  ${state.score.home}  ${homeLabel}`, pageWidth / 2, margin + 19, { align: 'center' });

    // ========================================
    // イニングスコアテーブル
    // ========================================
    const tableTop = margin + 24;
    const colWidth = 12;
    const rowHeight = 7;
    const teamColWidth = 40;
    const maxInnings = Math.max(game.innings, state.inningScores.home.length, state.inningScores.away.length, 7);
    const tableWidth = teamColWidth + (maxInnings + 3) * colWidth; // +3 = R, H, E
    const tableLeft = (pageWidth - tableWidth) / 2;

    // ヘッダー行
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.rect(tableLeft, tableTop, teamColWidth, rowHeight);
    doc.text('TEAM', tableLeft + 2, tableTop + 5);

    for (let i = 0; i < maxInnings; i++) {
        const x = tableLeft + teamColWidth + i * colWidth;
        doc.rect(x, tableTop, colWidth, rowHeight);
        doc.text(String(i + 1), x + colWidth / 2, tableTop + 5, { align: 'center' });
    }

    // R, H, E 列
    const rheCols = ['R', 'H', 'E'];
    for (let i = 0; i < rheCols.length; i++) {
        const x = tableLeft + teamColWidth + maxInnings * colWidth + i * colWidth;
        doc.rect(x, tableTop, colWidth, rowHeight);
        doc.text(rheCols[i], x + colWidth / 2, tableTop + 5, { align: 'center' });
    }

    // アウェイチーム行
    doc.setFont('helvetica', 'normal');
    const awayRow = tableTop + rowHeight;
    doc.rect(tableLeft, awayRow, teamColWidth, rowHeight);
    doc.text(awayLabel.substring(0, 12), tableLeft + 2, awayRow + 5);

    for (let i = 0; i < maxInnings; i++) {
        const x = tableLeft + teamColWidth + i * colWidth;
        doc.rect(x, awayRow, colWidth, rowHeight);
        const score = state.inningScores.away[i];
        doc.text(score !== undefined ? String(score) : '-', x + colWidth / 2, awayRow + 5, { align: 'center' });
    }

    // アウェイ R, H, E
    const awayHits = game.events.filter(
        (e): e is PlateAppearanceEvent =>
            e.type === 'plate_appearance' && e.halfInning === 'top' &&
            (e.result.category === 'hit')
    ).length;
    const awayRHE = [String(state.score.away), String(awayHits), '0'];
    for (let i = 0; i < awayRHE.length; i++) {
        const x = tableLeft + teamColWidth + maxInnings * colWidth + i * colWidth;
        doc.rect(x, awayRow, colWidth, rowHeight);
        doc.text(awayRHE[i], x + colWidth / 2, awayRow + 5, { align: 'center' });
    }

    // ホームチーム行
    const homeRow = awayRow + rowHeight;
    doc.rect(tableLeft, homeRow, teamColWidth, rowHeight);
    doc.text(homeLabel.substring(0, 12), tableLeft + 2, homeRow + 5);

    for (let i = 0; i < maxInnings; i++) {
        const x = tableLeft + teamColWidth + i * colWidth;
        doc.rect(x, homeRow, colWidth, rowHeight);
        const score = state.inningScores.home[i];
        doc.text(score !== undefined ? String(score) : '-', x + colWidth / 2, homeRow + 5, { align: 'center' });
    }

    const homeHits = game.events.filter(
        (e): e is PlateAppearanceEvent =>
            e.type === 'plate_appearance' && e.halfInning === 'bottom' &&
            (e.result.category === 'hit')
    ).length;
    const homeRHE = [String(state.score.home), String(homeHits), '0'];
    for (let i = 0; i < homeRHE.length; i++) {
        const x = tableLeft + teamColWidth + maxInnings * colWidth + i * colWidth;
        doc.rect(x, homeRow, colWidth, rowHeight);
        doc.text(homeRHE[i], x + colWidth / 2, homeRow + 5, { align: 'center' });
    }

    // ========================================
    // スコアシート（ダイヤモンド入り）
    // ========================================
    const sheetTop = homeRow + rowHeight + 8;
    const sheetLeft = margin;

    // 自チームの打席記録テーブル
    const paColW = 8;   // 各打席列の幅
    const nameColW = 30;  // 選手名列の幅
    const numColW = 8;   // 背番号列の幅
    const posColW = 8;   // 守備位置列の幅
    const paRowH = 18;  // 各打席行の高さ（ダイヤモンド描画用）
    const headerH = 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`${myTeam.name} - Batting Record`, sheetLeft, sheetTop - 1);

    // テーブルヘッダー
    const battingTableTop = sheetTop + 2;
    doc.setFontSize(6);
    doc.rect(sheetLeft, battingTableTop, numColW, headerH);
    doc.text('#', sheetLeft + numColW / 2, battingTableTop + 4.5, { align: 'center' });

    doc.rect(sheetLeft + numColW, battingTableTop, nameColW, headerH);
    doc.text('Name', sheetLeft + numColW + 2, battingTableTop + 4.5);

    doc.rect(sheetLeft + numColW + nameColW, battingTableTop, posColW, headerH);
    doc.text('Pos', sheetLeft + numColW + nameColW + posColW / 2, battingTableTop + 4.5, { align: 'center' });

    // 各イニング列ヘッダー
    const maxPACols = maxInnings + 2; // イニング数 + 余白
    for (let i = 0; i < maxPACols; i++) {
        const x = sheetLeft + numColW + nameColW + posColW + i * paColW;
        if (x + paColW > pageWidth - margin) break;
        doc.rect(x, battingTableTop, paColW, headerH);
        doc.text(String(i + 1), x + paColW / 2, battingTableTop + 4.5, { align: 'center' });
    }

    // 選手行
    doc.setFont('helvetica', 'normal');
    const myHalf: HalfInning = game.myTeamSide === 'home' ? 'bottom' : 'top';

    myTeam.battingOrder.forEach((playerId, rowIdx) => {
        const player = myTeam.players.find(p => p.id === playerId);
        if (!player) return;

        const y = battingTableTop + headerH + rowIdx * paRowH;
        if (y + paRowH > pageHeight - margin) return; // ページ溢れ防止

        // 背番号
        doc.rect(sheetLeft, y, numColW, paRowH);
        doc.setFontSize(7);
        doc.text(String(player.number), sheetLeft + numColW / 2, y + paRowH / 2 + 1.5, { align: 'center' });

        // 選手名
        doc.rect(sheetLeft + numColW, y, nameColW, paRowH);
        doc.setFontSize(7);
        doc.text(player.name.substring(0, 10), sheetLeft + numColW + 2, y + paRowH / 2 + 1.5);

        // 守備位置
        const posLabels: Record<string, string> = {
            pitcher: 'P', catcher: 'C', first: '1B', second: '2B',
            third: '3B', shortstop: 'SS', left: 'LF', center: 'CF', right: 'RF', dh: 'DH'
        };
        doc.rect(sheetLeft + numColW + nameColW, y, posColW, paRowH);
        doc.text(posLabels[player.position] || '?', sheetLeft + numColW + nameColW + posColW / 2, y + paRowH / 2 + 1.5, { align: 'center' });

        // この選手の打席結果を時系列順に取得
        const playerPAs = game.events.filter(
            (e): e is PlateAppearanceEvent =>
                e.type === 'plate_appearance' && e.batterId === playerId
        );

        playerPAs.forEach((pa, paIdx) => {
            const x = sheetLeft + numColW + nameColW + posColW + paIdx * paColW;
            if (x + paColW > pageWidth - margin) return;

            doc.rect(x, y, paColW, paRowH);

            // ダイヤモンドを描画
            const dcx = x + paColW / 2;
            const dcy = y + paRowH / 2 - 1;
            const ds = 3; // ダイヤモンドサイズ

            // ダイヤモンドの線
            doc.setLineWidth(0.2);
            doc.line(dcx, dcy - ds, dcx + ds, dcy);     // 二塁→一塁
            doc.line(dcx + ds, dcy, dcx, dcy + ds);      // 一塁→本塁
            doc.line(dcx, dcy + ds, dcx - ds, dcy);      // 本塁→三塁
            doc.line(dcx - ds, dcy, dcx, dcy - ds);      // 三塁→二塁

            // 安打の場合、到達した塁線を太く描画
            if (pa.result.category === 'hit') {
                doc.setLineWidth(0.8);
                const code = pa.result.code;
                // 一塁まで（単打以上）
                doc.line(dcx, dcy + ds, dcx + ds, dcy);
                if (code.startsWith('H2') || code.startsWith('H3') || code.startsWith('HR')) {
                    doc.line(dcx + ds, dcy, dcx, dcy - ds); // 二塁まで
                }
                if (code.startsWith('H3') || code.startsWith('HR')) {
                    doc.line(dcx, dcy - ds, dcx - ds, dcy); // 三塁まで
                }
                if (code.startsWith('HR')) {
                    doc.line(dcx - ds, dcy, dcx, dcy + ds); // 本塁まで
                }
                doc.setLineWidth(0.2);
            }

            // 結果テキスト
            doc.setFontSize(4.5);
            const shortLabel = pa.result.code.length > 5 ? pa.result.code.substring(0, 5) : pa.result.code;
            doc.text(shortLabel, dcx, y + paRowH - 2, { align: 'center' });
        });
    });

    // ========================================
    // 打撃成績テーブル（ページ2）
    // ========================================
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${myTeam.name} - Batting Statistics`, pageWidth / 2, margin + 8, { align: 'center' });

    const stats = calculateBattingStats(game.events, myTeam.players, myTeam.battingOrder);

    const statsTop = margin + 15;
    const statsRowH = 7;
    const statsCols = [
        { label: '#', w: 8 },
        { label: 'Name', w: 30 },
        { label: 'PA', w: 10 },
        { label: 'AB', w: 10 },
        { label: 'H', w: 10 },
        { label: '2B', w: 10 },
        { label: '3B', w: 10 },
        { label: 'HR', w: 10 },
        { label: 'RBI', w: 10 },
        { label: 'R', w: 10 },
        { label: 'BB', w: 10 },
        { label: 'K', w: 10 },
        { label: 'SB', w: 10 },
        { label: 'AVG', w: 14 },
        { label: 'OBP', w: 14 },
        { label: 'SLG', w: 14 },
    ];

    const statsTableWidth = statsCols.reduce((sum, c) => sum + c.w, 0);
    const statsLeft = (pageWidth - statsTableWidth) / 2;

    // ヘッダー
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    let cx = statsLeft;
    for (const col of statsCols) {
        doc.rect(cx, statsTop, col.w, statsRowH);
        doc.text(col.label, cx + col.w / 2, statsTop + 5, { align: 'center' });
        cx += col.w;
    }

    // データ行
    doc.setFont('helvetica', 'normal');
    stats.forEach((s, idx) => {
        const y = statsTop + statsRowH + idx * statsRowH;
        const player = myTeam.players.find(p => p.id === s.playerId);
        const values = [
            String(player?.number || ''),
            s.playerName.substring(0, 10),
            String(s.plateAppearances),
            String(s.atBats),
            String(s.hits),
            String(s.doubles),
            String(s.triples),
            String(s.homeRuns),
            String(s.rbiCount),
            String(s.runs),
            String(s.walks),
            String(s.strikeouts),
            String(s.stolenBases),
            formatAverage(s.battingAverage),
            formatAverage(s.onBasePercentage),
            formatAverage(s.sluggingPercentage),
        ];

        cx = statsLeft;
        values.forEach((v, colIdx) => {
            const col = statsCols[colIdx];
            doc.rect(cx, y, col.w, statsRowH);
            doc.setFontSize(6);
            if (colIdx === 1) {
                doc.text(v, cx + 2, y + 5); // 選手名は左寄せ
            } else {
                doc.text(v, cx + col.w / 2, y + 5, { align: 'center' });
            }
            cx += col.w;
        });
    });

    // ========================================
    // 投手成績テーブル
    // ========================================
    const pitchingStats = calculatePitchingStats(game);
    const pitchTop = statsTop + statsRowH + (stats.length + 2) * statsRowH;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${myTeam.name} - Pitching Statistics`, pageWidth / 2, pitchTop, { align: 'center' });

    const pitchTableTop = pitchTop + 5;
    const pitchCols = [
        { label: 'Name', w: 30 },
        { label: 'IP', w: 14 },
        { label: 'H', w: 10 },
        { label: 'R', w: 10 },
        { label: 'ER', w: 10 },
        { label: 'BB', w: 10 },
        { label: 'K', w: 10 },
    ];

    const pitchTableWidth = pitchCols.reduce((sum, c) => sum + c.w, 0);
    const pitchLeft = (pageWidth - pitchTableWidth) / 2;

    // ヘッダー
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    cx = pitchLeft;
    for (const col of pitchCols) {
        doc.rect(cx, pitchTableTop, col.w, statsRowH);
        doc.text(col.label, cx + col.w / 2, pitchTableTop + 5, { align: 'center' });
        cx += col.w;
    }

    // データ行
    doc.setFont('helvetica', 'normal');
    pitchingStats.forEach((p, idx) => {
        const y = pitchTableTop + statsRowH + idx * statsRowH;
        const values = [
            p.playerName.substring(0, 12),
            formatInningsPitched(p.inningsPitched),
            String(p.hits),
            String(p.runs),
            String(p.earnedRuns),
            String(p.walks),
            String(p.strikeouts),
        ];

        cx = pitchLeft;
        values.forEach((v, colIdx) => {
            const col = pitchCols[colIdx];
            doc.rect(cx, y, col.w, statsRowH);
            doc.setFontSize(6);
            if (colIdx === 0) {
                doc.text(v, cx + 2, y + 5); // 名前は左寄せ
            } else {
                doc.text(v, cx + col.w / 2, y + 5, { align: 'center' });
            }
            cx += col.w;
        });
    });

    // ========================================
    // フッター
    // ========================================
    doc.setFontSize(6);
    doc.setFont('helvetica', 'italic');
    doc.text('Generated by Baseball Scorebook App', pageWidth / 2, pageHeight - 5, { align: 'center' });

    // PDF保存
    const filename = `scorebook_${game.date}_${myTeam.name}_vs_${opponentTeam.name}.pdf`;
    doc.save(filename);
}
