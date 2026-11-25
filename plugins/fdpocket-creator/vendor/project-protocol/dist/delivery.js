/**
 * Build-time base baked into every mini-app build (frozen artifacts keep it). The origin replaces it
 * when serving: with {@link APP_FRAME_BASE} for an App running inside a Host frame, with `/` for a
 * public production App opened directly. Static files are not credentials; data is protected by the
 * Project access token at the Gateway.
 */
export const DELIVERY_BUILD_BASE = '/_platform/delivery/__SESSION__/';
/** Where a Host (the superapp or the origin's own sign-in page) frames the App */
export const APP_FRAME_BASE = '/_platform/app/';
