// ========================================
// データ永続化（localStorage）
// ========================================

import { Game } from '@/types';

const STORAGE_KEY = 'scorebook_games';

/** 全試合データを取得 */
export function loadGames(): Game[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        console.error('データの読み込みに失敗しました');
        return [];
    }
}

/** 全試合データを保存 */
export function saveGames(games: Game[]): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
    } catch {
        console.error('データの保存に失敗しました');
    }
}

/** 試合をIDで取得 */
export function loadGameById(id: string): Game | undefined {
    const games = loadGames();
    return games.find(g => g.id === id);
}

/** 試合を保存（新規または更新） */
export function saveGame(game: Game): void {
    const games = loadGames();
    const index = games.findIndex(g => g.id === game.id);
    if (index >= 0) {
        games[index] = { ...game, updatedAt: new Date().toISOString() };
    } else {
        games.push(game);
    }
    saveGames(games);
}

/** 試合を削除 */
export function deleteGame(id: string): void {
    const games = loadGames();
    saveGames(games.filter(g => g.id !== id));
}

/** UUID生成 */
export function generateId(): string {
    return crypto.randomUUID();
}
