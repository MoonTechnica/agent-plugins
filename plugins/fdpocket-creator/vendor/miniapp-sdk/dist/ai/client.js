import { AI_EMBEDDING_DIMENSIONS_MAX, AI_EMBEDDING_INPUTS_MAX, AI_RERANK_DOCUMENT_CHARS_MAX, AI_RERANK_DOCUMENTS_MAX, AI_SPEECH_INPUT_CHARS_MAX, AI_SPEECH_INSTRUCTIONS_CHARS_MAX, AI_TRANSCRIPTION_KEYTERMS_MAX, AI_TRANSCRIPTION_MAX_BYTES, aiEmbeddingsResponse, aiRerankResponse, aiResetResponse, aiTranscriptionResponse, aiTurnEvent, aiTurnRequestSchema, aiTurnResult, } from '@workspace/project-protocol';
import { SdkError } from "../errors.js";
import { gatewayBase, readResponse } from "../transport.js";
export function createAi(transport, gateway) {
    /** Gateway へ 1 回送る。`signal` で待つのをやめたときは、transport の失敗ではなく止めた理由を投げる */
    async function post(path, init, signal) {
        try {
            return await transport.fetch(`${gatewayBase(gateway)}${path}`, {
                method: 'POST',
                ...init,
                ...(signal ? { signal } : {}),
            });
        }
        catch (error) {
            if (signal?.aborted)
                throw signal.reason;
            throw error;
        }
    }
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
            const response = await post('/v1/ai/openai/embeddings', {
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ input: texts, encoding_format: 'float', ...options }),
            }, signal);
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
        async transcribe({ audio, signal, keyterms, diarize, ...options }) {
            const isFile = !(audio instanceof Blob);
            if ((!isFile && (audio.size === 0 || audio.size > AI_TRANSCRIPTION_MAX_BYTES)) ||
                (isFile && !/^[0-9a-f-]{36}$/i.test(audio.fileId)) ||
                (keyterms !== undefined && keyterms.length > AI_TRANSCRIPTION_KEYTERMS_MAX)) {
                throw new SdkError('VALIDATION_FAILED', 'invalid ai.transcribe input');
            }
            const fields = { ...options, ...(diarize === undefined ? {} : { diarize }) };
            let init;
            if (isFile) {
                // Storage の音声は、Gateway が read ポリシーで確かめて読む（Blob を載せ直さない）
                init = {
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        ...fields,
                        file: `fdpocket-file:${audio.fileId}`,
                        ...(keyterms ? { keyterms } : {}),
                        ...(diarize ? { response_format: 'verbose_json' } : {}),
                    }),
                };
            }
            else {
                // OpenAI の `audio/transcriptions` と同じ multipart（content-type は境界つきで fetch が付ける）
                const form = new FormData();
                form.set('file', audio, audio instanceof File ? audio.name : 'audio');
                for (const [key, value] of Object.entries(fields)) {
                    if (value !== undefined)
                        form.set(key, String(value));
                }
                for (const term of keyterms ?? [])
                    form.append('keyterms[]', term);
                if (diarize)
                    form.set('response_format', 'verbose_json');
                init = { body: form };
            }
            const parsed = aiTranscriptionResponse.safeParse(await readResponse(await post('/v1/ai/openai/audio/transcriptions', init, signal)));
            if (!parsed.success) {
                throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected ai transcription response', {
                    retryable: true,
                });
            }
            const { text, language, duration, segments } = parsed.data;
            return {
                text,
                ...(language === undefined ? {} : { language }),
                ...(duration === undefined ? {} : { duration }),
                ...(segments === undefined ? {} : { segments }),
            };
        },
        async speak({ text, voice, model, format, speed, instructions, signal }) {
            if (text === '' ||
                text.length > AI_SPEECH_INPUT_CHARS_MAX ||
                voice === '' ||
                (instructions !== undefined &&
                    (instructions === '' || instructions.length > AI_SPEECH_INSTRUCTIONS_CHARS_MAX))) {
                throw new SdkError('VALIDATION_FAILED', 'invalid ai.speak input');
            }
            const response = await post('/v1/ai/openai/audio/speech', {
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    input: text,
                    voice,
                    ...(model === undefined ? {} : { model }),
                    ...(format === undefined ? {} : { response_format: format }),
                    ...(speed === undefined ? {} : { speed }),
                    ...(instructions === undefined ? {} : { instructions }),
                }),
            }, signal);
            const contentType = response.headers.get('content-type') ?? '';
            // 失敗は transport が SdkError にする。成功なのに音声でないものは、取り違えて鳴らさない
            if (!contentType.startsWith('audio/')) {
                throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected ai speech response', {
                    retryable: true,
                });
            }
            return { audio: await response.blob(), contentType };
        },
        async rerank({ query, documents, topN, model, signal }) {
            if (query === '' ||
                documents.length < 1 ||
                documents.length > AI_RERANK_DOCUMENTS_MAX ||
                documents.some((d) => d === '' || d.length > AI_RERANK_DOCUMENT_CHARS_MAX) ||
                (topN !== undefined && (!Number.isInteger(topN) || topN < 1))) {
                throw new SdkError('VALIDATION_FAILED', 'invalid ai.rerank input');
            }
            const parsed = aiRerankResponse.safeParse(await readResponse(await post('/v1/ai/openai/rerank', {
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    query,
                    documents,
                    ...(topN === undefined ? {} : { top_n: topN }),
                    ...(model === undefined ? {} : { model }),
                }),
            }, signal)));
            if (!parsed.success) {
                throw new SdkError('GATEWAY_UNAVAILABLE', 'unexpected ai rerank response', {
                    retryable: true,
                });
            }
            return {
                results: parsed.data.results
                    .map((r) => ({ index: r.index, score: r.relevance_score }))
                    .sort((a, b) => b.score - a.score),
                model: parsed.data.model ?? model ?? '',
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
