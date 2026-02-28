'use client';

// ========================================
// 確認モーダル - window.confirm() の代替
// ========================================

interface ConfirmModalProps {
    /** モーダル表示状態 */
    isOpen: boolean;
    /** タイトル */
    title: string;
    /** メッセージ */
    message: string;
    /** 確認ボタンテキスト */
    confirmText?: string;
    /** キャンセルボタンテキスト */
    cancelText?: string;
    /** 確認ボタンの色テーマ */
    variant?: 'danger' | 'primary' | 'success';
    /** 確認時コールバック */
    onConfirm: () => void;
    /** キャンセル時コールバック */
    onCancel: () => void;
}

/** 確認モーダルコンポーネント */
export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmText = '確認',
    cancelText = 'キャンセル',
    variant = 'primary',
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const variantStyles = {
        danger: {
            background: 'linear-gradient(135deg, var(--accent-red), #dc2626)',
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
        },
        primary: {
            background: 'linear-gradient(135deg, var(--accent-blue), #2563eb)',
            boxShadow: '0 4px 14px var(--accent-blue-glow)',
        },
        success: {
            background: 'linear-gradient(135deg, var(--accent-green), #16a34a)',
            boxShadow: '0 4px 14px var(--accent-green-glow)',
        },
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-2">{title}</h3>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                    {message}
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="btn-secondary flex-1"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 text-white font-semibold rounded-xl py-3 px-6 cursor-pointer transition-all"
                        style={variantStyles[variant]}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
