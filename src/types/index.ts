// ========================================
// 野球スコアブック - 型定義
// ========================================

/** UUID文字列型 */
export type UUID = string;

// ========================================
// 守備位置
// ========================================
export type Position =
  | 'pitcher'    // 投手(1)
  | 'catcher'    // 捕手(2)
  | 'first'      // 一塁手(3)
  | 'second'     // 二塁手(4)
  | 'third'      // 三塁手(5)
  | 'shortstop'  // 遊撃手(6)
  | 'left'       // 左翼手(7)
  | 'center'     // 中堅手(8)
  | 'right'      // 右翼手(9)
  | 'dh';        // 指名打者

/** 守備位置の番号マッピング */
export const POSITION_NUMBERS: Record<Position, number> = {
  pitcher: 1,
  catcher: 2,
  first: 3,
  second: 4,
  third: 5,
  shortstop: 6,
  left: 7,
  center: 8,
  right: 9,
  dh: 0,
};

/** 守備位置の日本語名 */
export const POSITION_LABELS: Record<Position, string> = {
  pitcher: '投手',
  catcher: '捕手',
  first: '一塁手',
  second: '二塁手',
  third: '三塁手',
  shortstop: '遊撃手',
  left: '左翼手',
  center: '中堅手',
  right: '右翼手',
  dh: '指名打者',
};

// ========================================
// 塁
// ========================================
export type Base = 'first' | 'second' | 'third' | 'home';

// ========================================
// 選手
// ========================================
export interface Player {
  id: UUID;
  name: string;
  number: number;       // 背番号
  position: Position;   // 守備位置
}

// ========================================
// チーム
// ========================================
export interface Team {
  id: UUID;
  name: string;
  players: Player[];           // 登録選手一覧
  battingOrder: UUID[];        // 打順（player.id の配列、最大9人）
  startingPitcher: UUID;       // 先発投手の player.id
}

// ========================================
// 試合
// ========================================
export interface Game {
  id: UUID;
  date: string;                // 試合日 (YYYY-MM-DD)
  venue: string;               // 球場名
  homeTeam: Team;              // ホームチーム
  awayTeam: Team;              // アウェイチーム
  innings: number;             // 規定イニング数 (7 or 9)
  status: GameStatus;
  events: GameEvent[];         // イベントログ（時系列順）
  myTeamName: string;          // 自チーム名
  myTeamSide: 'home' | 'away'; // 自チームのサイド
  opponentScoreByInning: number[]; // 相手チームのイニング別手動入力得点
  createdAt: string;           // ISO 8601
  updatedAt: string;           // ISO 8601
}

export type GameStatus = 'preparing' | 'in_progress' | 'finished';

// ========================================
// イベント - 心臓部
// ========================================

/** 全イベント共通フィールド */
export interface BaseEvent {
  id: UUID;
  timestamp: string;            // ISO 8601
  inning: number;               // イニング番号 (1~)
  halfInning: HalfInning;       // 表/裏
  outs: number;                 // イベント発生時のアウト数 (0-2)
}

export type HalfInning = 'top' | 'bottom';

/** イベント種別の判別用ユニオン型 */
export type GameEvent =
  | PlateAppearanceEvent
  | RunnerEvent
  | InningEvent
  | PitcherChangeEvent;

export type GameEventType = 'plate_appearance' | 'runner_event' | 'inning_change' | 'pitcher_change';

// ---- 打席イベント ----
export interface PlateAppearanceEvent extends BaseEvent {
  type: 'plate_appearance';
  batterId: UUID;               // 打者
  pitcherId: UUID;              // 投手
  orderInInning: number;        // イニング内打席序数（スコアシート描画用）
  result: PlateAppearanceResult;
  rbiList: RBI[];               // 打点
  runnerMovements: RunnerMovement[];  // 打席に伴う走者の動き
}

/** 打席結果 */
export interface PlateAppearanceResult {
  category: ResultCategory;     // 大分類
  code: string;                 // 結果コード（例: "GO-6", "H1-L"）
  label: string;                // 表示用（例: "遊ゴロ", "左安打"）
}

/** 打席結果カテゴリ */
export type ResultCategory =
  | 'hit'              // 安打
  | 'out'              // アウト
  | 'error'            // 失策
  | 'fielders_choice'  // 野選
  | 'walk'             // 四球
  | 'hit_by_pitch'     // 死球
  | 'sacrifice_bunt'   // 犠打
  | 'sacrifice_fly'    // 犠飛
  | 'interference';    // 打撃妨害

/** 走者の動き（打席結果に伴う） */
export interface RunnerMovement {
  runnerId: UUID;
  fromBase: Base;
  toBase: Base | 'out' | 'score';
  reason: 'batted_ball' | 'force' | 'tag' | 'error';
}

/** 打点記録 */
export interface RBI {
  runnerId: UUID;        // 生還した走者
  earned: boolean;       // 打点として計上するか
}

// ---- ランナーイベント（打席間に発生） ----
export interface RunnerEvent extends BaseEvent {
  type: 'runner_event';
  runnerId: UUID;
  eventKind: RunnerEventKind;
  fromBase: Base;
  toBase: Base | 'out' | 'score';
}

export type RunnerEventKind =
  | 'stolen_base'       // 盗塁
  | 'caught_stealing'   // 盗塁死
  | 'pickoff'           // 牽制死
  | 'wild_pitch'        // 暴投進塁
  | 'passed_ball'       // 捕逸進塁
  | 'balk'              // ボーク進塁
  | 'advance';          // その他進塁

/** ランナーイベントの日本語名 */
export const RUNNER_EVENT_LABELS: Record<RunnerEventKind, string> = {
  stolen_base: '盗塁',
  caught_stealing: '盗塁死',
  pickoff: '牽制死',
  wild_pitch: '暴投進塁',
  passed_ball: '捕逸進塁',
  balk: 'ボーク進塁',
  advance: 'その他進塁',
};

// ---- イニング区切りイベント ----
export interface InningEvent extends BaseEvent {
  type: 'inning_change';
  newInning: number;
  newHalfInning: HalfInning;
}

// ---- 投手交代イベント ----
export interface PitcherChangeEvent extends BaseEvent {
  type: 'pitcher_change';
  teamId: UUID;
  outPitcherId: UUID;
  inPitcherId: UUID;
}

// ========================================
// 試合状態（イベントログから算出される現在の状態）
// ========================================
export interface GameState {
  inning: number;
  halfInning: HalfInning;
  outs: number;
  runners: RunnerState;         // 現在の塁上走者
  score: { home: number; away: number };
  inningScores: { home: number[]; away: number[] };  // イニング別得点
  currentBatterIndex: { home: number; away: number }; // 現在の打順インデックス
  currentPitcher: { home: UUID; away: UUID };          // 現在の投手
  isGameOver: boolean;
}

/** 塁上の走者状態 */
export interface RunnerState {
  first: UUID | null;
  second: UUID | null;
  third: UUID | null;
}

// ========================================
// 打撃成績
// ========================================
export interface BattingStats {
  playerId: UUID;
  playerName: string;
  plateAppearances: number;   // 打席数
  atBats: number;             // 打数
  hits: number;               // 安打数
  doubles: number;            // 二塁打
  triples: number;            // 三塁打
  homeRuns: number;           // 本塁打
  rbiCount: number;           // 打点
  runs: number;               // 得点
  walks: number;              // 四球
  hitByPitch: number;         // 死球
  strikeouts: number;         // 三振
  sacrificeBunts: number;     // 犠打
  sacrificeFlies: number;     // 犠飛
  stolenBases: number;        // 盗塁
  battingAverage: number;     // 打率
  onBasePercentage: number;   // 出塁率
  sluggingPercentage: number; // 長打率
}

// ========================================
// 投手成績（簡易版）
// ========================================
export interface PitchingStats {
  playerId: UUID;
  playerName: string;
  inningsPitched: number;     // 投球回数
  earnedRuns: number;         // 自責点
  runs: number;               // 失点
  hits: number;               // 被安打
  walks: number;              // 与四球
  strikeouts: number;         // 奪三振
}
