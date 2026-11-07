import { APP_SLUG_PATTERN } from "./manifest.js";
/** DNS ラベルの上限（RFC 1035） */
export const ORIGIN_LABEL_MAX = 63;
const ORIGIN_ID = /^[0-9a-f]{10}$/;
const PROJECT_PART = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?[0-9a-f]{10}$/;
const SESSION_PART = /^s-[0-9a-f]{12}$/;
function environmentSuffix(environment) {
    if (environment.kind === 'prod')
        return '';
    if (environment.kind === 'main')
        return '--main';
    if (!/^[0-9a-f]{12}$/.test(environment.generation))
        throw new Error('invalid session generation');
    return `--s-${environment.generation}`;
}
/**
 * 正しいラベルはこの関数の結果だけ。長いときは飾りの `originSlug` を左から切り、末尾の `-` を外す
 * （入りきらなければ省く）。`originId` が識別子なので一意性は変わらない。
 */
export function originLabel(input) {
    if (!ORIGIN_ID.test(input.originId))
        throw new Error('invalid origin id');
    if (input.app !== null && !APP_SLUG_PATTERN.test(input.app))
        throw new Error('invalid app slug');
    const tail = `${input.originId}${input.app === null ? '' : `--${input.app}`}${environmentSuffix(input.environment)}`;
    const room = ORIGIN_LABEL_MAX - tail.length - 1;
    const slug = input.originSlug.slice(0, Math.max(room, 0)).replace(/-+$/, '');
    return slug === '' ? tail : `${slug}-${tail}`;
}
/** 形だけを解析する。Project の実在と、短縮した飾りが正しいことは呼ぶ側が `originLabel` と照合する */
export function parseOriginLabel(label) {
    if (label.length === 0 || label.length > ORIGIN_LABEL_MAX)
        return null;
    const [project = '', ...rest] = label.split('--');
    if (!PROJECT_PART.test(project) || rest.length > 2)
        return null;
    let app = null;
    let environment = { kind: 'prod' };
    for (const [index, part] of rest.entries()) {
        const session = SESSION_PART.test(part);
        if (part === 'main' || session) {
            // 環境の印は最後だけ
            if (index !== rest.length - 1)
                return null;
            environment = session ? { kind: 'session', generation: part.slice(2) } : { kind: 'main' };
        }
        else if (index === 0 && APP_SLUG_PATTERN.test(part)) {
            app = part;
        }
        else {
            return null;
        }
    }
    return { originId: project.slice(-10), app, environment };
}
/**
 * 入口のラベルから同じ環境の App のラベルを作る。入口の飾りは短縮されていない（最長 47 文字）ので、
 * そこから `originLabel` と同じ規則で作り直せる。
 */
export function appLabelFromEntrance(entrance, app) {
    const parsed = parseOriginLabel(entrance);
    if (parsed === null || parsed.app !== null || !APP_SLUG_PATTERN.test(app))
        return null;
    const project = entrance.split('--')[0] ?? '';
    return originLabel({
        originSlug: project.slice(0, -(parsed.originId.length + 1)),
        originId: parsed.originId,
        app,
        environment: parsed.environment,
    });
}
/** 2 つのラベルが同じ Project の同じ環境か（App は問わない）。飾りの違いは見ない */
export function sameOriginEnvironment(a, b) {
    const left = parseOriginLabel(a);
    const right = parseOriginLabel(b);
    return (left !== null &&
        right !== null &&
        left.originId === right.originId &&
        JSON.stringify(left.environment) === JSON.stringify(right.environment));
}
export function isOriginLabel(label) {
    return parseOriginLabel(label) !== null;
}
/** `{label}.{appsDomain}`. The apps domain is required: there are no provisional origins. */
export function resolveAppOrigin(input) {
    if (!isOriginLabel(input.originHost))
        throw new Error('invalid app origin label');
    if (!/^[a-z0-9.-]+(?::\d{1,5})?$/.test(input.appsDomain))
        throw new Error('invalid app domain');
    const scheme = input.scheme ?? (/^localhost(:\d+)?$/.test(input.appsDomain) ? 'http' : 'https');
    return `${scheme}://${input.originHost}.${input.appsDomain}`;
}
