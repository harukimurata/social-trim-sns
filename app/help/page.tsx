"use client";

import { Accordion } from "@/app/components/Accordion";

const helpItems = [
    {
        id: "auto-delete",
        title: "投稿の自動削除（7日）",
        content: (
            <div className="text-sm text-body space-y-1.5">
                <p>投稿は<strong>最終更新日時から7日後</strong>に自動削除されます。</p>
                <p>投稿を編集すると7日のカウントがリセットされます。</p>
                <p className="text-xs text-neutral-secondary">削除タイミングには最大48時間の遅延が生じる場合があります。</p>
            </div>
        ),
    },
    {
        id: "protect",
        title: "投稿の保護（最大5件）",
        content: (
            <div className="text-sm text-body space-y-1.5">
                <p>削除したくない投稿を<strong>最大5件</strong>まで保護できます。保護された投稿は自動削除の対象外になります。</p>
                <p>保護の設定・解除はいつでも可能です。すでに5件保護中の場合、解除してから新たな保護を設定してください。</p>
            </div>
        ),
    },
    {
        id: "edit",
        title: "投稿の編集は1回のみ",
        content: (
            <div className="text-sm text-body space-y-1.5">
                <p>投稿の編集は<strong>1回のみ</strong>可能です。編集後は再編集できません。</p>
                <p>編集済みの投稿は詳細画面で編集前・後の内容を両方確認できます。</p>
            </div>
        ),
    },
    {
        id: "hashtag",
        title: "ハッシュタグは最大4つ",
        content: (
            <div className="text-sm text-body">
                <p>1投稿につきハッシュタグを<strong>最大4つ</strong>まで付与できます。</p>
            </div>
        ),
    },
    {
        id: "reactions",
        title: "リアクション（お気に入り・バイラル）",
        content: (
            <div className="text-sm text-body space-y-1.5">
                <p><strong>お気に入り</strong>：投稿をお気に入り登録するリアクションです。</p>
                <p><strong>バイラル</strong>：投稿を自分のフォロワーへ再共有するリアクションです。</p>
            </div>
        ),
    },
    {
        id: "favorite-ranking",
        title: "お気に入りランキングの集計と集計周期",
        content: (
            <div className="text-sm text-body">
                <p>お気に入りランキングは<strong>定期バッチ処理</strong>で集計・更新されます。リアルタイムには反映されません。</p>
            </div>
        ),
    },
    {
        id: "trend",
        title: "トレンド（ハッシュタグランキング）",
        content: (
            <div className="text-sm text-body space-y-1.5">
                <p>ハッシュタグのトレンドランキングは<strong>リアルタイム</strong>で更新されます。</p>
                <p>集計対象は直近の投稿です。</p>
            </div>
        ),
    }
];

export default function Help() {
    return (
        <main className="w-full max-w-[600px]">
            <div className="px-1 py-3 mb-4 border-b border-default">
                <h1 className="text-lg font-semibold text-heading">ヘルプ</h1>
            </div>
            <Accordion items={helpItems} />
        </main>
    );
}
