'use client';

// ========================================
// トップページ - 試合一覧・新規作成
// 自チームのみ選手登録。相手チームは名前のみ。
// ========================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Game, Player, Position } from '@/types';
import { loadGames, saveGame, deleteGame, generateId } from '@/lib/storage';
import { createNewGame } from '@/lib/gameEngine';
import { computeGameState } from '@/lib/gameEngine';
import ConfirmModal from '@/components/ConfirmModal';

/** 試合作成用の選手入力行 */
interface PlayerInput {
  id: string;
  name: string;
  number: string;
  position: Position;
}

/** デフォルトの選手入力9人分 */
function createDefaultPlayers(): PlayerInput[] {
  const positions: Position[] = ['pitcher', 'catcher', 'shortstop', 'third', 'second', 'first', 'left', 'center', 'right'];
  return positions.map((pos, i) => ({
    id: generateId(),
    name: '',
    number: String(i + 1),
    position: pos,
  }));
}

export default function HomePage() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // フォーム状態
  const [myTeamName, setMyTeamName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [myPlayers, setMyPlayers] = useState<PlayerInput[]>(createDefaultPlayers());
  const [innings, setInnings] = useState(7);
  const [gameDate, setGameDate] = useState(new Date().toISOString().split('T')[0]);
  const [venue, setVenue] = useState('');
  const [isHome, setIsHome] = useState(true); // 自チームが後攻（ホーム）かどうか

  useEffect(() => {
    setGames(loadGames());
    setLoading(false);
  }, []);

  /** 選手入力を更新 */
  function updatePlayer(index: number, field: keyof PlayerInput, value: string) {
    setMyPlayers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  /** 試合作成 */
  function handleCreate() {
    if (!myTeamName.trim()) {
      alert('自チーム名を入力してください');
      return;
    }
    if (!opponentName.trim()) {
      alert('相手チーム名を入力してください');
      return;
    }

    // 名前が入力されている選手のみを登録
    const validPlayers = myPlayers.filter(p => p.name.trim());

    if (validPlayers.length < 1) {
      alert('最低1名の選手を入力してください');
      return;
    }

    const playerEntities: Player[] = validPlayers.map(p => ({
      id: p.id,
      name: p.name.trim(),
      number: parseInt(p.number) || 0,
      position: p.position,
    }));

    // 打順 = 入力順
    const battingOrder = playerEntities.map(p => p.id);

    // 先発投手 = ポジションがpitcherの最初の選手、なければ先頭
    const startingPitcher = playerEntities.find(p => p.position === 'pitcher')?.id || playerEntities[0].id;

    // 相手チームはダミー選手（投手1人）
    const opponentPitcherId = generateId();
    const opponentPlayers: Player[] = [
      { id: opponentPitcherId, name: '相手投手', number: 1, position: 'pitcher' },
    ];

    const game = createNewGame(
      isHome ? myTeamName.trim() : opponentName.trim(),   // ホームチーム
      isHome ? opponentName.trim() : myTeamName.trim(),    // アウェイチーム
      isHome ? playerEntities : opponentPlayers,            // ホーム選手
      isHome ? opponentPlayers : playerEntities,            // アウェイ選手
      isHome ? battingOrder : [opponentPitcherId],          // ホーム打順
      isHome ? [opponentPitcherId] : battingOrder,          // アウェイ打順
      isHome ? startingPitcher : opponentPitcherId,         // ホーム先発投手
      isHome ? opponentPitcherId : startingPitcher,         // アウェイ先発投手
      innings,
      gameDate,
      venue.trim(),
      myTeamName.trim(), // 自チーム名を保存
      isHome ? 'home' : 'away' // 自チームのサイド
    );

    saveGame(game);
    router.push(`/game/${game.id}`);
  }

  /** 試合削除 */
  function handleDelete(id: string, name: string) {
    setDeleteTarget({ id, name });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteGame(deleteTarget.id);
    setGames(loadGames());
    setDeleteTarget(null);
  }

  const positions: { value: Position; label: string }[] = [
    { value: 'pitcher', label: '投' },
    { value: 'catcher', label: '捕' },
    { value: 'first', label: '一' },
    { value: 'second', label: '二' },
    { value: 'third', label: '三' },
    { value: 'shortstop', label: '遊' },
    { value: 'left', label: '左' },
    { value: 'center', label: '中' },
    { value: 'right', label: '右' },
    { value: 'dh', label: 'DH' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="animate-pulse-glow w-16 h-16 rounded-full" style={{ background: 'var(--accent-blue-glow)' }} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-1">
          ⚾ スコアブック
        </h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          野球簡易記録・成績集計アプリ
        </p>
      </div>

      {/* 新規作成ボタン */}
      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary w-full mb-6 text-base py-4"
        >
          + 新しい試合を作成
        </button>
      )}

      {/* 試合作成フォーム */}
      {showCreate && (
        <div className="glass-card p-5 mb-6 animate-fade-in">
          <h2 className="text-lg font-bold mb-4">新しい試合</h2>

          {/* 試合情報 */}
          <div className="space-y-3 mb-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                  試合日
                </label>
                <input
                  type="date"
                  value={gameDate}
                  onChange={e => setGameDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                  イニング数
                </label>
                <select
                  value={innings}
                  onChange={e => setInnings(parseInt(e.target.value))}
                  className="input-field"
                >
                  <option value={5}>5回</option>
                  <option value={6}>6回</option>
                  <option value={7}>7回</option>
                  <option value={9}>9回</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                球場
              </label>
              <input
                type="text"
                placeholder="球場名（任意）"
                value={venue}
                onChange={e => setVenue(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* チーム名・先攻後攻 */}
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                自チーム名
              </label>
              <input
                type="text"
                placeholder="自分のチーム名"
                value={myTeamName}
                onChange={e => setMyTeamName(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                相手チーム名
              </label>
              <input
                type="text"
                placeholder="相手チーム名"
                value={opponentName}
                onChange={e => setOpponentName(e.target.value)}
                className="input-field"
              />
            </div>
            {/* 先攻/後攻 選択 */}
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                自チームの攻撃順
              </label>
              <div className="flex rounded-lg overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                <button
                  onClick={() => setIsHome(false)}
                  className="flex-1 py-2.5 text-sm font-semibold transition-all"
                  style={{
                    background: !isHome ? 'var(--accent-blue)' : 'transparent',
                    color: !isHome ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  先攻
                </button>
                <button
                  onClick={() => setIsHome(true)}
                  className="flex-1 py-2.5 text-sm font-semibold transition-all"
                  style={{
                    background: isHome ? 'var(--accent-green)' : 'transparent',
                    color: isHome ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  後攻
                </button>
              </div>
            </div>
          </div>

          {/* 打順ヘッダー */}
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
            自チーム打順・選手登録
          </p>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-[10px] w-5" style={{ color: 'var(--text-muted)' }}>打順</span>
            <span className="text-[10px] flex-1" style={{ color: 'var(--text-muted)' }}>選手名</span>
            <span className="text-[10px] w-14 text-center" style={{ color: 'var(--text-muted)' }}>背番号</span>
            <span className="text-[10px] w-16 text-center" style={{ color: 'var(--text-muted)' }}>守備</span>
          </div>

          {/* 選手フォーム */}
          <div className="space-y-2">
            {myPlayers.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-xs font-bold w-5 text-center" style={{ color: 'var(--text-muted)' }}>
                  {i + 1}
                </span>
                <input
                  type="text"
                  placeholder="選手名"
                  value={p.name}
                  onChange={e => updatePlayer(i, 'name', e.target.value)}
                  className="input-field flex-1"
                  style={{ padding: '8px 10px', fontSize: '13px' }}
                />
                <input
                  type="number"
                  placeholder="#"
                  value={p.number}
                  onChange={e => updatePlayer(i, 'number', e.target.value)}
                  className="input-field w-14 text-center"
                  style={{ padding: '8px 4px', fontSize: '13px' }}
                />
                <select
                  value={p.position}
                  onChange={e => updatePlayer(i, 'position', e.target.value as Position)}
                  className="input-field w-16 text-center"
                  style={{ padding: '8px 2px', fontSize: '12px' }}
                >
                  {positions.map(pos => (
                    <option key={pos.value} value={pos.value}>{pos.label}</option>
                  ))}
                </select>
              </div>
            ))}
            {/* 選手追加ボタン */}
            <button
              onClick={() => {
                setMyPlayers(prev => [...prev, {
                  id: generateId(),
                  name: '',
                  number: String(prev.length + 1),
                  position: 'dh' as Position,
                }]);
              }}
              className="w-full text-xs py-2 rounded-lg transition-all"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px dashed var(--border-color)',
              }}
            >
              + 選手を追加
            </button>
          </div>

          {/* ボタン */}
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setShowCreate(false)}
              className="btn-secondary flex-1"
            >
              キャンセル
            </button>
            <button
              onClick={handleCreate}
              className="btn-success flex-1"
            >
              試合開始 ⚾
            </button>
          </div>
        </div>
      )}

      {/* 試合一覧 */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          試合一覧
        </h2>

        {games.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-3xl mb-3">⚾</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              まだ試合がありません
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              「新しい試合を作成」ボタンから始めましょう
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {games.map(game => {
              const state = computeGameState(game);
              return (
                <div
                  key={game.id}
                  className="glass-card p-4 cursor-pointer transition-all hover:scale-[1.01]"
                  onClick={() => router.push(`/game/${game.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {game.date} {game.venue && `@ ${game.venue}`}
                    </span>
                    <span className={`badge ${game.status === 'finished' ? 'badge-green' :
                      game.status === 'in_progress' ? 'badge-amber' : 'badge-blue'
                      }`}>
                      {game.status === 'finished' ? '終了' :
                        game.status === 'in_progress' ? '試合中' : '準備中'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{game.awayTeam.name}</p>
                        <span className="font-bold font-mono text-lg" style={{ color: 'var(--accent-blue)' }}>{state.score.away}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{game.homeTeam.name}</p>
                        <span className="font-bold font-mono text-lg" style={{ color: 'var(--accent-green)' }}>{state.score.home}</span>
                      </div>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(game.id, `${game.awayTeam.name} vs ${game.homeTeam.name}`);
                      }}
                      className="ml-3 text-xs px-3 py-2 rounded-lg font-bold"
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)', border: '1px solid rgba(239, 68, 68, 0.25)' }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 削除確認モーダル */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="試合の削除"
        message={`「${deleteTarget?.name || ''}」を削除しますか？この操作は取り消しできません。`}
        variant="danger"
        confirmText="削除する"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
