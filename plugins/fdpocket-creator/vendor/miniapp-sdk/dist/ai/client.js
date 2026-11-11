import { AI_EMBEDDING_DIMENSIONS_MAX, AI_EMBEDDING_INPUTS_MAX, aiEmbeddingsResponse, aiResetResponse, aiTurnEvent, aiTurnRequestSchema, aiTurnResult, } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
import { gatewayBase, readResponse } from "../transport.js";
export function createAi(transport, gateway) {
    return {
        async chat({ onToken, signal, ...input }) {
            const parsed = aiTurnRequestSchema.safeParse({ ...input, stream: onToken !== undefined });
            if (!parsed.success)
                throw new SdkError('VALIDATION_FAILED', 'invalid ai.chat input');
            let response;
            try {
                response = await transport.fetch(`${gatewayBase(gateway)}/v1/ai/turns`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(parsed.data),
                    ...(signal ? { signal } : {}),
                });
            }
            catch (error) {
                // 止めたのは App。transport が届かない扱いにしたものを、止めた理由に戻す
                if (signal?.aborted)
                    throw signal.reason;
                throw error;
            }
            if (!onToken)
                return resultOf(await readResponse(response));
            return readStream(response, onToken, signal);
        },
        async reset(conversation) {
            const parsed = aiResetResponse.wire.safeParse(await transport.send(`/v1/ai/conversations/${encodeURIComponent(conversation)}/reset`, {
                method: 'POST',
            }));
            if (!parsed.success) {
                throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected ai reset response', {
                    retryable: true,
                });
            }
        },
        async embed(input, { signal, ...options } = {}) {
            const texts = typeof input === 'string' ? [input] : [...input];
            if (texts.length < 1 ||
                texts.length > AI_EMBEDDING_INPUTS_MAX ||
                texts.some((text) => text === '') ||
                (options.dimensions !== undefined &&
                    (!Number.isInteger(options.dimensions) ||
                        options.dimensions < 1 ||
                        options.dimensions > AI_EMBEDDING_DIMENSIONS_MAX))) {
                throw new SdkError('VALIDATION_FAILED', 'invalid ai.embed input');
            }
            let response;
            try {
                response = await transport.fetch(`${gatewayBase(gateway)}/v1/ai/openai/embeddings`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ input: texts, encoding_format: 'float', ...options }),
                    ...(signal ? { signal } : {}),
                });
            }
            catch (error) {
                if (signal?.aborted)
                    throw signal.reason;
                throw error;
            }
            const parsed = aiEmbeddingsResponse.safeParse(await readResponse(response));
            // 返ったベクトルの数が入力と違えば、取り違えて保存しないよう失敗にする
            if (!parsed.success || parsed.data.data.length !== texts.length) {
                throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected ai embeddings response', {
                    retryable: true,
                });
            }
            return {
                embeddings: [...parsed.data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding),
                model: parsed.data.model,
            };
        },
        openai() {
            return {
                baseURL: `${gatewayBase(gateway)}/v1/ai/openai`,
                apiKey: 'fdpocket',
                // OpenAI SDK・AI SDK・LangChain は (URL 文字列, init) で呼ぶ
                fetch: (input, init) => transport.forward(input instanceof Request ? input.url : String(input), init),
            };
        },
    };
}
function resultOf(body) {
    const parsed = aiTurnResult.wire.safeParse(body);
    if (!parsed.success) {
        throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected ai response', { retryable: true });
    }
    return parsed.data;
}
/** Gateway の SSE（`delta` → `done`、失敗は `error`）。`done` の無いまま終われば失敗 */
async function readStream(response, onToken, signal) {
    const reader = response.body?.getReader();
    if (!reader)
        throw new SdkError('GATEWAY_UNAVAILABLE', 'empty ai stream', { retryable: true });
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            let index = buffer.indexOf('\n\n');
            while (index >= 0) {
                const block = buffer.slice(0, index);
                buffer = buffer.slice(index + 2);
                index = buffer.indexOf('\n\n');
                const data = block
                    .split('\n')
                    .filter((line) => line.startsWith('data:'))
                    .map((line) => line.slice(5).trimStart())
                    .join('\n');
                if (!data)
                    continue;
                const raw = JSON.parse(data);
                const event = aiTurnEvent.wire.safeParse(raw);
                if (!event.success) {
                    // 後から足された種類の event は読み飛ばす（読む側は寛容。contract-compatibility.md §2）
                    if (isLaterEventType(raw))
                        continue;
                    throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected ai event', { retryable: true });
                }
                if (event.data.type === 'delta')
                    onToken(event.data.text);
                else if (event.data.type === 'done')
                    return event.data.result;
                else
                    throw new SdkError(event.data.code, event.data.message);
            }
        }
    }
    catch (error) {
        if (signal?.aborted)
            throw signal.reason;
        if (error instanceof SdkError)
            throw error;
        throw new SdkError('GATEWAY_UNAVAILABLE', 'ai stream was interrupted', {
            retryable: true,
            cause: error,
        });
    }
    finally {
        reader.releaseLock();
    }
    throw new SdkError('GATEWAY_UNAVAILABLE', 'ai stream ended without a result', {
        retryable: true,
    });
}
const KNOWN_EVENT_TYPES = new Set(['delta', 'done', 'error']);
/** `type` を持つが、この SDK が知らない種類（壊れた既知の event とは区別する） */
function isLaterEventType(raw) {
    if (typeof raw !== 'object' || raw === null || !('type' in raw))
        return false;
    return typeof raw.type === 'string' && !KNOWN_EVENT_TYPES.has(raw.type);
}
