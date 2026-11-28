// 試用データ。2 つを書き分ける。
// - default の seed(context): 初期化だけ（ワークスペースとメンバー）。DB client は受け取らず、計画を返す。
// - samples(context): 画面で見るための行。主な一覧のモデルは 20〜40 行、状態は全種類、日付は今日の前後に散らす。
//   同じ key の行は、新しい版の samples で上書きされる。data に id は書かない。
// testIdentities の slot は admin/member/anonymous 以外。利用者とロールは Platform が作る。
// Task は見本。作るアプリの業務モデルと、その業界の本物らしい言葉に置き換える。
import type { SamplePlan, SchemaType, SeedContext, SeedPlan, TestIdentity } from "@workspace/sdk"

export const testIdentities = [
  { slot: "alice", roles: [], displayName: "Alice" },
  { slot: "bob", roles: [], displayName: "Bob" },
] satisfies TestIdentity[]

export default async function seed(context: SeedContext): Promise<SeedPlan<SchemaType>> {
  const workspaceId = await context.id("sample-workspace")
  return {
    version: 1,
    operations: [
      { model: "workspace", operation: "create", args: { data: { id: workspaceId, name: "サンプルのチーム" } } },
      { model: "membership", operation: "createMany", args: { data: [
        { workspaceId, userId: context.users.alice!.id, role: "owner" },
        { workspaceId, userId: context.users.bob!.id, role: "editor" },
      ] } },
    ],
  }
}

const DAY = 24 * 60 * 60 * 1000

// [key, タイトル, 状態, 期限（今日から何日後。null は期限なし）, 担当]
const TASKS: [string, string, "todo" | "doing" | "done", number | null, "alice" | "bob"][] = [
  ["t01", "見積書を A 社へ送る", "todo", 0, "alice"],
  ["t02", "定例会議の議事録をまとめる", "doing", 0, "bob"],
  ["t03", "請求書の金額を経理と突き合わせる", "todo", 1, "alice"],
  ["t04", "新しいメンバーのアカウントを用意する", "done", -2, "bob"],
  ["t05", "来月の展示会の出展申込書を提出する（締切が近いので先に担当者へ確認してから、必要書類をすべてそろえて送る）", "todo", 3, "alice"],
  ["t06", "問い合わせフォームの返信テンプレートを直す", "doing", 2, "bob"],
  ["t07", "取引先リストの重複を整理する", "todo", -1, "alice"],
  ["t08", "四半期の売上レポートを作る", "doing", 5, "alice"],
  ["t09", "社内ポータルのお知らせを更新する", "done", -5, "bob"],
  ["t10", "契約書の更新日を確認する", "todo", 7, "bob"],
  ["t11", "備品の発注をまとめる", "done", -3, "alice"],
  ["t12", "B 社との打ち合わせ日程を調整する", "todo", 1, "bob"],
  ["t13", "経費精算の差し戻しを直す", "doing", -1, "alice"],
  ["t14", "研修資料のスライドを見直す", "todo", 10, "bob"],
  ["t15", "顧客アンケートの結果を集計する", "doing", 4, "bob"],
  ["t16", "ウェブサイトの料金ページの誤字を直す", "done", -7, "alice"],
  ["t17", "年末の休業日を取引先へ知らせる", "todo", 14, "alice"],
  ["t18", "倉庫の在庫数を棚卸しと照合する", "todo", null, "bob"],
  ["t19", "採用面接の評価シートを提出する", "done", -1, "bob"],
  ["t20", "C 社の提案書の初稿を書く", "doing", 6, "alice"],
  ["t21", "セキュリティ研修の受講状況を確認する", "todo", 21, "bob"],
  ["t22", "会議室の予約ルールを共有する", "done", -10, "alice"],
  ["t23", "サポート窓口の対応時間を見直す", "todo", null, "alice"],
  ["t24", "月次の KPI をダッシュボードに反映する", "doing", 0, "bob"],
]

export async function samples(context: SeedContext): Promise<SamplePlan<SchemaType>> {
  const workspaceId = await context.id("sample-workspace")
  const now = new Date(context.initializedAt).getTime()
  return {
    version: 2,
    rows: TASKS.map(([key, title, status, dueInDays, owner], index) => ({
      model: "task",
      key,
      data: {
        title,
        status,
        dueAt: dueInDays === null ? null : new Date(now + dueInDays * DAY).toISOString(),
        // 新しい順に並ぶよう、作成日時を少しずつずらす
        createdAt: new Date(now - (index + 1) * 3 * 60 * 60 * 1000).toISOString(),
        ownerId: context.users[owner]!.id,
        workspaceId,
      },
    })),
  }
}
