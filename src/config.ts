/**
 * Public app settings. Nothing here is secret: the ESV key lives only in the Cloudflare
 * relay (see relay/README.md), never in this repository or the website.
 */

/**
 * Web address of the ESV relay (a Cloudflare Worker), e.g.
 * "https://bible-atlas-esv.yourname.workers.dev". Leave empty until the relay is set up;
 * until then readers can add their own key in Settings, or see the WEB.
 */
export const ESV_RELAY_URL = '';
