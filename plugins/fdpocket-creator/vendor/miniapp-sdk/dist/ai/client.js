import { aiResetResponseSchema, aiTurnEventSchema, aiTurnRequestSchema, aiTurnResultSchema, } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
import { readResponse } from "../transport.js";
export function createAi(transport, gateway) {
    const base = gateway.replace(/\/+$/, '');
    return {
        async chat({ onToken, signal, ...input }) {
            const parsed = aiTurnRequestSchema.safeParse({ ...input, stream: onToken !== undefined });
            if (!parsed.success)
                throw new SdkError('VALIDATION_FAILED', 'invalid ai.chat input');
            let response;
            try {
                response = await transport.fetch(`${base}/v1/ai/turns`, {
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
            const parsed = aiResetResponseSchema.safeParse(await transport.send(`/v1/ai/conversations/${encodeURIComponent(conversation)}/reset`, {
                method: 'POST',
            }));
            if (!parsed.success) {
                throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected ai reset response', {
                    retryable: true,
                });
            }
        },
        openai() {
            return {
                baseURL: `${base}/v1/ai/openai`,
                apiKey: 'fdpocket',
                // OpenAI SDK・AI SDK・LangChain は (URL 文字列, init) で呼ぶ
                fetch: (input, init) => transport.forward(input instanceof Request ? input.url : String(input), init),
            };
        },
    };
}
function resultOf(body) {
    const parsed = aiTurnResultSchema.safeParse(body);
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
                const event = aiTurnEventSchema.safeParse(JSON.parse(data));
                if (!event.success) {
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
