import { renderers } from './renderers.mjs';
import { c as createExports } from './chunks/entrypoint_OetxOS_F.mjs';
import { manifest } from './manifest_axjOK_9U.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/404.astro.mjs');
const _page2 = () => import('./pages/s/_id_.astro.mjs');
const _page3 = () => import('./pages/_---slug_.md.astro.mjs');
const _page4 = () => import('./pages/_---slug_.astro.mjs');
const pageMap = new Map([
    ["../../node_modules/.bun/astro@5.7.13+1d941c09658a4b5a/node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["../../node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/routes/static/404.astro", _page1],
    ["src/pages/s/[id].astro", _page2],
    ["src/pages/[...slug].md.ts", _page3],
    ["../../node_modules/.bun/@astrojs+starlight@0.34.3+d4a9ca0ffe30da47/node_modules/@astrojs/starlight/routes/static/index.astro", _page4]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./_noop-actions.mjs'),
    middleware: () => import('./_astro-internal_middleware.mjs')
});
const _args = {
    "middlewareSecret": "23568362-8422-48af-8701-0229fdf4b940",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;

export { __astrojsSsrVirtualEntry as default, pageMap };
