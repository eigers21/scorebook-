// ========================================
// ゲームエンジン - イベントログから試合状態を計算
// ========================================

import {
    Game, GameEvent, GameState, RunnerState, PlateAppearanceEvent,
    RunnerEvent, PitcherChangeEvent, Team, Player, UUID, HalfInning, Base,
    PlateAppearanceResult, RunnerMovement, RBI, RunnerEventKind,
    BattingStats, PitchingStats,
} from '@/types';
import { findResultOption } from '@/data/masterData';
import { generateId } from '@/lib/storage';

// ========================================
// 試合状態の計算
// ========================================

/** 初期状態を生成 */
export function createInitialState(game: Game): GameState {
    return {
        inning: 1,
        halfInning: 'top',
        outs: 0,
        runners: { first: null, second: null, third: null },
        score: { home: 0, away: 0 },
        inningScores: { home: [], away: [] },
        currentBatterIndex: { home: 0, away: 0 },
        currentPitcher: {
            home: game.homeTeam.startingPitcher,
            away: game.awayTeam.startingPitcher,
        },
        isGameOver: false,
    };
}

/** イベントログから現在の試合状態を計算 */
export function computeGameState(game: Game): GameState {
    let state = createInitialState(game);

    for (const event of game.events) {
        state = applyEvent(state, event, game);
    }

    return state;
}

/** 単一のイベントを状態に適用 */
function applyEvent(state: GameState, event: GameEvent, game: Game): GameState {
    switch (event.type) {
        case 'plate_appearance':
            return applyPlateAppearance(state, event, game);
        case 'runner_event':
            return applyRunnerEvent(state, event);
        case 'inning_change':
            return {
                ...state,
                inning: event.newInning,
                halfInning: event.newHalfInning,
                outs: 0,
                runners: { first: null, second: null, third: null },
            };
        case 'pitcher_change':
            return applyPitcherChange(state, event);
        default:
            return state;
    }
}

/** 打席結果を適用 */
function applyPlateAppearance(
    state: GameState,
    event: PlateAppearanceEvent,
    game: Game
): GameState {
    const newState = { ...state };
    const resultOpt = findResultOption(event.result.code);
    const scoreSide = state.halfInning === 'top' ? 'away' : 'home';
    const batterSide = state.halfInning === 'top' ? 'away' : 'home';

    // 新しいrunnersコピー
    let runners: RunnerState = { ...state.runners };

    // 走者の動きを適用
    let runsScored = 0;
    let outsAdded = 0;

    for (const movement of event.runnerMovements) {
        // 出発塁をクリア
        if (movement.fromBase !== 'home') {
            runners = clearBase(runners, movement.fromBase);
        }
        // 到着先を設定
        if (movement.toBase === 'score') {
            runsScored++;
        } else if (movement.toBase === 'out') {
            outsAdded++;
        } else if (movement.toBase !== 'home') {
            runners = setBase(runners, movement.toBase, movement.runnerId);
        }
    }

    // 打者自身の処理
    if (resultOpt?.isOut) {
        outsAdded++;
    } else if (resultOpt) {
        // 打者が塁に出る場合
        if (resultOpt.hitBases === 4) {
            // 本塁打：打者自身も得点
            runsScored++;
        } else if (resultOpt.hitBases) {
            // 安打：hitBasesに応じた塁に配置
            const baseName = hitBasesToBase(resultOpt.hitBases);
            if (baseName) {
                runners = setBase(runners, baseName, event.batterId);
            }
        } else if (resultOpt.category === 'walk' || resultOpt.category === 'hit_by_pitch') {
            // 四死球：一塁へ
            runners = setBase(runners, 'first', event.batterId);
        } else if (resultOpt.category === 'error' || resultOpt.category === 'fielders_choice') {
            // 失策・野選：一塁へ
            runners = setBase(runners, 'first', event.batterId);
        } else if (resultOpt.category === 'interference') {
            // 打撃妨害：一塁へ
            runners = setBase(runners, 'first', event.batterId);
        }
    }

    // スコア更新
    const newScore = { ...state.score };
    newScore[scoreSide] += runsScored;

    // イニングスコア更新
    const newInningScores = {
        home: [...state.inningScores.home],
        away: [...state.inningScores.away],
    };
    const inningIdx = state.inning - 1;
    while (newInningScores[scoreSide].length <= inningIdx) {
        newInningScores[scoreSide].push(0);
    }
    newInningScores[scoreSide][inningIdx] += runsScored;

    // アウト数更新
    const newOuts = state.outs + outsAdded;

    // 打順進める
    const newBatterIndex = { ...state.currentBatterIndex };
    const team = batterSide === 'home' ? game.homeTeam : game.awayTeam;
    newBatterIndex[batterSide] = (state.currentBatterIndex[batterSide] + 1) % team.battingOrder.length;

    return {
        ...newState,
        runners,
        score: newScore,
        inningScores: newInningScores,
        outs: Math.min(newOuts, 3),
        currentBatterIndex: newBatterIndex,
        currentPitcher: state.currentPitcher,
        isGameOver: state.isGameOver,
    };
}

/** ランナーイベントを適用 */
function applyRunnerEvent(state: GameState, event: RunnerEvent): GameState {
    let runners = { ...state.runners };
    let newOuts = state.outs;
    let runsScored = 0;
    const scoreSide = state.halfInning === 'top' ? 'away' : 'home';

    // 出発塁をクリア
    if (event.fromBase !== 'home') {
        runners = clearBase(runners, event.fromBase);
    }

    // 到着先を設定
    if (event.toBase === 'score') {
        runsScored++;
    } else if (event.toBase === 'out') {
        newOuts++;
    } else if (event.toBase !== 'home') {
        runners = setBase(runners, event.toBase, event.runnerId);
    }

    const newScore = { ...state.score };
    newScore[scoreSide] += runsScored;

    const newInningScores = {
        home: [...state.inningScores.home],
        away: [...state.inningScores.away],
    };
    const inningIdx = state.inning - 1;
    while (newInningScores[scoreSide].length <= inningIdx) {
        newInningScores[scoreSide].push(0);
    }
    newInningScores[scoreSide][inningIdx] += runsScored;

    return {
        ...state,
        runners,
        outs: Math.min(newOuts, 3),
        score: newScore,
        inningScores: newInningScores,
    };
}

/** 投手交代を適用 */
function applyPitcherChange(state: GameState, event: PitcherChangeEvent): GameState {
    // 投手交代は攻撃側のチームの投手が交代（= 守備側の投手）
    // teamIdから判別
    const newPitcher = { ...state.currentPitcher };
    // 簡略化: イベントに記録されたチームの投手を更新
    // homeTeamの投手が交代 = awayが攻撃中
    // ここではevent内のteamIdは使わず、inPitcherIdで更新
    if (state.halfInning === 'top') {
        newPitcher.home = event.inPitcherId;
    } else {
        newPitcher.away = event.inPitcherId;
    }

    return {
        ...state,
        currentPitcher: newPitcher,
    };
}

// ========================================
// イベント生成ヘルパー
// ========================================

/** 打席結果イベントを生成 */
export function createPlateAppearanceEvent(
    state: GameState,
    batterId: UUID,
    pitcherId: UUID,
    resultCode: string,
    resultLabel: string,
    resultCategory: string,
    runnerMovements: RunnerMovement[],
    rbiList: RBI[],
    orderInInning: number
): PlateAppearanceEvent {
    return {
        id: generateId(),
        type: 'plate_appearance',
        timestamp: new Date().toISOString(),
        inning: state.inning,
        halfInning: state.halfInning,
        outs: state.outs,
        batterId,
        pitcherId,
        orderInInning,
        result: {
            category: resultCategory as PlateAppearanceResult['category'],
            code: resultCode,
            label: resultLabel,
        },
        rbiList,
        runnerMovements,
    };
}

/** ランナーイベントを生成 */
export function createRunnerEvent(
    state: GameState,
    runnerId: UUID,
    eventKind: RunnerEventKind,
    fromBase: Base,
    toBase: Base | 'out' | 'score'
): RunnerEvent {
    return {
        id: generateId(),
        type: 'runner_event',
        timestamp: new Date().toISOString(),
        inning: state.inning,
        halfInning: state.halfInning,
        outs: state.outs,
        runnerId,
        eventKind,
        fromBase,
        toBase,
    };
}

/** イニング交代イベントを生成 */
export function createInningChangeEvent(
    state: GameState,
    newInning: number,
    newHalfInning: HalfInning
): GameEvent {
    return {
        id: generateId(),
        type: 'inning_change',
        timestamp: new Date().toISOString(),
        inning: state.inning,
        halfInning: state.halfInning,
        outs: state.outs,
        newInning,
        newHalfInning,
    };
}

/** 投手交代イベントを生成 */
export function createPitcherChangeEvent(
    state: GameState,
    teamId: UUID,
    outPitcherId: UUID,
    inPitcherId: UUID
): PitcherChangeEvent {
    return {
        id: generateId(),
        type: 'pitcher_change',
        timestamp: new Date().toISOString(),
        inning: state.inning,
        halfInning: state.halfInning,
        outs: state.outs,
        teamId,
        outPitcherId,
        inPitcherId,
    };
}

// ========================================
// 自動イニング交代判定
// ========================================

/** 3アウトでイニング交代が必要かどうかを判定 */
export function shouldChangeInning(state: GameState): boolean {
    return state.outs >= 3;
}

/** 次のイニング情報を取得 */
export function getNextInning(state: GameState, game: Game): { inning: number; halfInning: HalfInning } | null {
    if (state.halfInning === 'top') {
        return { inning: state.inning, halfInning: 'bottom' };
    } else {
        // 裏が終了 → 次のイニング表へ
        if (state.inning >= game.innings) {
            // 最終イニング終了 → 試合終了の可能性
            return null;
        }
        return { inning: state.inning + 1, halfInning: 'top' };
    }
}

// ========================================
// 成績集計
// ========================================

/** 打撃成績を集計 */
export function calculateBattingStats(events: GameEvent[], players: Player[], teamBattingOrder: UUID[]): BattingStats[] {
    return teamBattingOrder.map(playerId => {
        const player = players.find(p => p.id === playerId);
        const playerName = player?.name || '不明';

        // この選手の打席イベントを抽出
        const paEvents = events.filter(
            (e): e is PlateAppearanceEvent => e.type === 'plate_appearance' && e.batterId === playerId
        );

        // ランナーイベントから盗塁を集計
        const stolenBases = events.filter(
            (e): e is RunnerEvent => e.type === 'runner_event' && e.runnerId === playerId && e.eventKind === 'stolen_base'
        ).length;

        // 得点（走者として生還した回数）
        const runsAsRunner = events.reduce((count, e) => {
            if (e.type === 'plate_appearance') {
                return count + e.runnerMovements.filter(m => m.runnerId === playerId && m.toBase === 'score').length
                    + e.rbiList.filter(r => r.runnerId === playerId).length;
            }
            if (e.type === 'runner_event' && e.runnerId === playerId && e.toBase === 'score') {
                return count + 1;
            }
            return count;
        }, 0);

        // 本塁打での得点
        const homeRunsScored = paEvents.filter(e => {
            const opt = findResultOption(e.result.code);
            return opt?.hitBases === 4;
        }).length;

        const runs = runsAsRunner + homeRunsScored;

        let plateAppearances = 0;
        let atBats = 0;
        let hits = 0;
        let doubles = 0;
        let triples = 0;
        let homeRuns = 0;
        let rbiCount = 0;
        let walks = 0;
        let hitByPitch = 0;
        let strikeouts = 0;
        let sacrificeBunts = 0;
        let sacrificeFlies = 0;

        for (const pa of paEvents) {
            plateAppearances++;
            const opt = findResultOption(pa.result.code);

            if (opt?.isAtBat) atBats++;

            if (opt?.category === 'hit' || pa.result.category === 'hit') {
                hits++;
                if (opt?.hitBases === 2) doubles++;
                if (opt?.hitBases === 3) triples++;
                if (opt?.hitBases === 4) homeRuns++;
            }

            if (pa.result.category === 'walk') walks++;
            if (pa.result.category === 'hit_by_pitch') hitByPitch++;
            if (pa.result.code === 'K' || pa.result.code === 'KK') strikeouts++;
            if (pa.result.category === 'sacrifice_bunt') sacrificeBunts++;
            if (pa.result.category === 'sacrifice_fly') sacrificeFlies++;

            rbiCount += pa.rbiList.filter(r => r.earned).length;
        }

        const battingAverage = atBats > 0 ? hits / atBats : 0;
        const onBasePercentage = (atBats + walks + hitByPitch + sacrificeFlies) > 0
            ? (hits + walks + hitByPitch) / (atBats + walks + hitByPitch + sacrificeFlies)
            : 0;
        const totalBases = (hits - doubles - triples - homeRuns) + (doubles * 2) + (triples * 3) + (homeRuns * 4);
        const sluggingPercentage = atBats > 0 ? totalBases / atBats : 0;

        return {
            playerId,
            playerName,
            plateAppearances,
            atBats,
            hits,
            doubles,
            triples,
            homeRuns,
            rbiCount,
            runs,
            walks,
            hitByPitch,
            strikeouts,
            sacrificeBunts,
            sacrificeFlies,
            stolenBases,
            battingAverage,
            onBasePercentage,
            sluggingPercentage,
        };
    });
}

// ========================================
// ユーティリティ
// ========================================

/** 塁をクリア */
function clearBase(runners: RunnerState, base: Base): RunnerState {
    const newRunners = { ...runners };
    if (base === 'first') newRunners.first = null;
    if (base === 'second') newRunners.second = null;
    if (base === 'third') newRunners.third = null;
    return newRunners;
}

/** 塁に走者をセット */
function setBase(runners: RunnerState, base: Base, runnerId: UUID): RunnerState {
    const newRunners = { ...runners };
    if (base === 'first') newRunners.first = runnerId;
    if (base === 'second') newRunners.second = runnerId;
    if (base === 'third') newRunners.third = runnerId;
    return newRunners;
}

/** 安打のhitBases数から到達塁を取得 */
function hitBasesToBase(hitBases: number): Base | null {
    switch (hitBases) {
        case 1: return 'first';
        case 2: return 'second';
        case 3: return 'third';
        default: return null;
    }
}

/** 現在の打者IDを取得 */
export function getCurrentBatterId(state: GameState, game: Game): UUID {
    const side = state.halfInning === 'top' ? 'away' : 'home';
    const team = side === 'home' ? game.homeTeam : game.awayTeam;
    return team.battingOrder[state.currentBatterIndex[side]];
}

/** 現在の投手IDを取得 */
export function getCurrentPitcherId(state: GameState): UUID {
    // 攻撃チームの反対が守備チーム（投手）
    return state.halfInning === 'top' ? state.currentPitcher.home : state.currentPitcher.away;
}

/** 現在の攻撃チームを取得 */
export function getOffenseTeam(game: Game, state: GameState): Team {
    return state.halfInning === 'top' ? game.awayTeam : game.homeTeam;
}

/** 現在の守備チームを取得 */
export function getDefenseTeam(game: Game, state: GameState): Team {
    return state.halfInning === 'top' ? game.homeTeam : game.awayTeam;
}

/** 選手名を取得 */
export function getPlayerName(game: Game, playerId: UUID): string {
    const allPlayers = [...game.homeTeam.players, ...game.awayTeam.players];
    return allPlayers.find(p => p.id === playerId)?.name || '不明';
}

/** 打順番号を取得（1始まり） */
export function getBattingOrderNumber(game: Game, state: GameState, playerId: UUID): number {
    const team = getOffenseTeam(game, state);
    const idx = team.battingOrder.indexOf(playerId);
    return idx >= 0 ? idx + 1 : 0;
}

/** 新しい試合を作成 */
export function createNewGame(
    homeTeamName: string,
    awayTeamName: string,
    homePlayers: Player[],
    awayPlayers: Player[],
    homeBattingOrder: UUID[],
    awayBattingOrder: UUID[],
    homeStartingPitcher: UUID,
    awayStartingPitcher: UUID,
    innings: number = 9,
    date?: string,
    venue?: string,
    myTeamName?: string,
    myTeamSide?: 'home' | 'away'
): Game {
    const now = new Date().toISOString();
    return {
        id: generateId(),
        date: date || new Date().toISOString().split('T')[0],
        venue: venue || '',
        homeTeam: {
            id: generateId(),
            name: homeTeamName,
            players: homePlayers,
            battingOrder: homeBattingOrder,
            startingPitcher: homeStartingPitcher,
        },
        awayTeam: {
            id: generateId(),
            name: awayTeamName,
            players: awayPlayers,
            battingOrder: awayBattingOrder,
            startingPitcher: awayStartingPitcher,
        },
        innings,
        status: 'preparing',
        events: [],
        myTeamName: myTeamName || homeTeamName,
        myTeamSide: myTeamSide || 'home',
        opponentScoreByInning: [],
        createdAt: now,
        updatedAt: now,
    };
}

// ========================================
// 投手成績集計
// ========================================

/** 自チーム投手の成績を集計 */
export function calculatePitchingStats(game: Game): PitchingStats[] {
    const myTeam = game.myTeamSide === 'home' ? game.homeTeam : game.awayTeam;
    // 自チームが守備する半イニング（相手チームの攻撃）
    const defensiveHalf: HalfInning = game.myTeamSide === 'home' ? 'top' : 'bottom';

    // 投手一覧を特定（先発 + 交代投手）
    const pitcherIds: UUID[] = [myTeam.startingPitcher];
    for (const event of game.events) {
        if (event.type === 'pitcher_change' && !pitcherIds.includes(event.inPitcherId)) {
            // 自チームの投手交代のみ
            const isMyTeamPitcherChange = myTeam.players.some(p => p.id === event.inPitcherId);
            if (isMyTeamPitcherChange) {
                pitcherIds.push(event.inPitcherId);
            }
        }
    }

    return pitcherIds.map(pitcherId => {
        const player = myTeam.players.find(p => p.id === pitcherId);
        const playerName = player?.name || '不明';

        // この投手が投げた打席イベント（相手チームの攻撃時）
        const paEvents = game.events.filter(
            (e): e is PlateAppearanceEvent =>
                e.type === 'plate_appearance' &&
                e.pitcherId === pitcherId &&
                e.halfInning === defensiveHalf
        );

        let hits = 0;
        let walks = 0;
        let strikeouts = 0;
        let outsRecorded = 0;

        for (const pa of paEvents) {
            const opt = findResultOption(pa.result.code);
            if (opt?.category === 'hit' || pa.result.category === 'hit') hits++;
            if (pa.result.category === 'walk') walks++;
            if (pa.result.category === 'hit_by_pitch') walks++; // 与四死球に含める
            if (pa.result.code === 'K' || pa.result.code === 'KK') strikeouts++;
            if (opt?.isOut) outsRecorded++;
            // ランナーアウトも加算
            outsRecorded += pa.runnerMovements.filter(m => m.toBase === 'out').length;
        }

        // この投手の時のランナーイベントアウトも加算
        const runnerOuts = game.events.filter(
            (e): e is RunnerEvent =>
                e.type === 'runner_event' &&
                e.halfInning === defensiveHalf &&
                e.toBase === 'out'
        );
        // ランナーイベントのアウトは、その時の投手に帰属
        // 簡略版: イベント時の投手IDで判別は複雑なので、全体のアウト数を使用

        // 投球回数 = アウト数 / 3（小数表記）
        const fullInnings = Math.floor(outsRecorded / 3);
        const remainingOuts = outsRecorded % 3;
        const inningsPitched = fullInnings + (remainingOuts / 10); // 表示用: 5.1 = 5回1/3

        // 失点・自責点（相手チームの得点から算出）
        // 簡略版: この投手の時に入った得点を集計
        let runs = 0;
        for (const pa of paEvents) {
            runs += pa.runnerMovements.filter(m => m.toBase === 'score').length;
            if (findResultOption(pa.result.code)?.hitBases === 4) runs++; // 本塁打
        }

        return {
            playerId: pitcherId,
            playerName,
            inningsPitched,
            earnedRuns: runs, // 簡略版: 失点=自責点として扱う
            runs,
            hits,
            walks,
            strikeouts,
        };
    });
}

/** 自チーム取得ヘルパー */
export function getMyTeam(game: Game): Team {
    return game.myTeamSide === 'home' ? game.homeTeam : game.awayTeam;
}

/** 相手チーム取得ヘルパー */
export function getOpponentTeam(game: Game): Team {
    return game.myTeamSide === 'home' ? game.awayTeam : game.homeTeam;
}
