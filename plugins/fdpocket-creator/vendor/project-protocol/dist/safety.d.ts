import { z } from 'zod';
/**
 * ミニアプリの中の通報とブロック（compliance.md §4。App Store 4.7.1 / 1.2）。
 * - 通報は Host の通報画面（運営の Google フォームへの案内と、対象のコピー）を開くだけ。
 *   理由はフォームで書いてもらい、SDK からは受け取らない（bridge の `safety.report`）
 * - ブロックはスーパーアプリ全体で共通の `user_blocks`。ミニアプリは Project 内の User.id で指し、
 *   Gateway が Platform の users.id に写す（`/v1/safety/blocks`）
 */
/** 通報の対象（ZModel のモデル名と行の ID。Host が画面に出してコピーさせる） */
export declare const safetyReportTargetSchema: z.ZodObject<{
    model: z.ZodString;
    id: z.ZodString;
}, z.core.$strict>;
export type SafetyReportTarget = z.infer<typeof safetyReportTargetSchema>;
/** `POST /v1/safety/blocks` */
export declare const safetyBlockRequestSchema: z.ZodObject<{
    userId: z.ZodString;
}, z.core.$strict>;
export type SafetyBlockRequest = z.infer<typeof safetyBlockRequestSchema>;
/** `GET` / `POST /v1/safety/blocks` の応答（本人がブロックしている人の User.id。名前順） */
export declare const safetyBlocksResponseSchema: z.ZodObject<{
    userIds: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export type SafetyBlocksResponse = z.infer<typeof safetyBlocksResponseSchema>;
