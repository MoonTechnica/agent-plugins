import { z } from 'zod';
/**
 * ミニアプリの中の通報とブロック（compliance.md §4。App Store 4.7.1 / 1.2）。
 * - 通報は Host の通報画面（運営の Google フォームへの案内と、対象のコピー）を開くだけ。
 *   理由はフォームで書いてもらい、SDK からは受け取らない（bridge の `safety.report`）
 * - ブロックはスーパーアプリ全体で共通の `user_blocks`。ミニアプリは Project 内の User.id で指し、
 *   Gateway が Platform の users.id に写す（`/v1/safety/blocks`）
 */
/** 通報の対象（ZModel のモデル名と行の ID。Host が画面に出してコピーさせる） */
export const safetyReportTargetSchema = z.strictObject({
    model: z
        .string()
        .max(64)
        .regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    /** 通報の窓口に `{projectId}:{model}:{id}` で添えるので 128 まで */
    id: z.string().min(1).max(128),
});
/** `POST /v1/safety/blocks` */
export const safetyBlockRequestSchema = z.strictObject({
    /** Project 内の User.id */
    userId: z.string().min(1).max(255),
});
/** `GET` / `POST /v1/safety/blocks` の応答（本人がブロックしている人の User.id。名前順） */
export const safetyBlocksResponseSchema = z.strictObject({
    userIds: z.array(z.string()),
});
