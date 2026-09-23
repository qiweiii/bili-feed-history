# Diagnostics

Build a standalone diagnostic extension with `pnpm build:diagnostic`. In
`chrome://extensions`, enable Developer mode, disable any other copy of this
extension, and **Load unpacked** from `.output/chrome-mv3-diagnostic`.
Refresh the Bilibili homepage after loading it.

This build works after quitting Chrome; it does not need a dev server.
`pnpm dev` uses a separate, managed browser profile, so use your regular
Chrome test profile for startup-setting checks. Reloading or updating the
extension clears its history—do not reload it halfway through a test.

## Quick check

1. Note the visible recommendations (A). Click 换一换 once and wait for a
   different set (B), then wait another second for capture. At B, the left
   arrow should work and the right arrow should be grey. Go left to A, then
   right to B.
2. Click 换一换 again soon after each *new set appears*, three to five times.
   After the final set, wait a second, then go back and forward through every
   set you actually saw, in order. Also try two clicks before the first new
   set appears. Clicks that Bilibili ignores do not count.
3. While viewing an older set, switch between Bilibili's light and dark
   themes if available. Restored cards should stay readable and match the
   surrounding cards in both themes.

## Before release

If you use an ad blocker, repeat the feed-history check with it enabled. A
blank ad card should not leave both arrows grey after two distinct sets appear.

For restart checks, leave Bilibili open and quit Chrome completely. With
**Continue where you left off** on, reopen Chrome: the newest saved set should
be selected. With it off, reopen Bilibili manually: the newly loaded feed
should become the latest set.

## Export logs

Click **Export logs** beside the arrows after reproducing a problem. For a
restart problem, export once before quitting and again after reopening. The
JSON includes recent events, saved feed HTML, and page snapshots; review it
before sharing because recommendations and links may be personal. The regular
`pnpm build` has no export button.
