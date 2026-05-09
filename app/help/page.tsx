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
                <p>お気に入りランキングは<strong>定期処理</strong>で集計・更新されます。</p>
            </div>
        ),
    },
    {
        id: "trend",
        title: "トレンド（ハッシュタグランキング）",
        content: (
            <div className="text-sm text-body space-y-1.5">
                <p>ハッシュタグのトレンドランキングは<strong>リアルタイム</strong>で更新されます。</p>
                <p>集計対象は直近2日間の投稿です。</p>
                <p className="text-xs text-neutral-secondary">同じハッシュタグを10分以内に連投しても、カウントは1回分のみ加算されます。</p>
            </div>
        ),
    },
    {
        id: "viral-ranking",
        title: "バイラルランキングのスコア算出",
        content: (
            <div className="text-sm text-body space-y-1.5">
                <p>バイラルランキングは<strong>コメント・お気に入り・バイラルの複合スコア</strong>で順位が決まります。</p>
                <p>集計対象は<strong>直近24時間以内に更新された投稿</strong>の上位100件です。</p>
                <p className="text-xs text-neutral-secondary">ランキングは約10分ごとに更新されます。</p>
            </div>
        ),
    },
    {
        id: "comment",
        title: "コメントと返信",
        content: (
            <div className="text-sm text-body space-y-1.5">
                <p>投稿に対して<strong>コメント</strong>（最大500文字）を投稿できます。</p>
                <p>コメント・返信にも<strong>お気に入り・バイラル</strong>のリアクションを付けられます。</p>
            </div>
        ),
    },
    {
        id: "notification",
        title: "通知が届くタイミング",
        content: (
            <div className="text-sm text-body space-y-1.5">
                <p>以下のイベントが発生すると通知が届きます。</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-neutral-secondary">
                    <li>自分の投稿がお気に入り・バイラルされた</li>
                    <li>自分の投稿にコメントされた</li>
                    <li>自分のコメントに返信された</li>
                    <li>自分のコメントがお気に入り・バイラルされた</li>
                </ul>
                <p className="text-xs text-neutral-secondary">自分自身の操作では通知は届きません。通知一覧を開くと、すべて既読になります。</p>
            </div>
        ),
    },
    {
        id: "follow",
        title: "フォローの仕組み",
        content: (
            <div className="text-sm text-body space-y-1.5">
                <p>フォローは<strong>一方向</strong>です。相手の承認なしにフォローできます。</p>
                <p>フォロー中のユーザーの投稿がタイムラインに表示されます。</p>
                <p>フォロー・フォロワーの一覧はプロフィール画面から確認できます。</p>
            </div>
        ),
    },
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
