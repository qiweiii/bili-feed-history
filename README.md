# Bilibili feed history web extension

## Restart diagnostics

Run `pnpm build:diagnostic`, then load the generated `.output/chrome-mv3-diagnostic`
directory using **Load unpacked** in `chrome://extensions` (Developer mode).
Disable the store-installed copy while testing to avoid two extensions modifying
the same page. This standalone build works without a development server, including
after completely quitting Chrome. `pnpm dev` also enables diagnostics.
WXT's dev command uses a managed Chromium profile, so restarting it is useful for
development reloads but is not a substitute for restarting the Chrome Test Profile
when testing Chrome's startup-page setting.

The **Export logs** button beside the history arrows downloads JSON containing
the last ten page sessions, up to 300 events each. Logs are stored locally across
browser restarts. They include timestamps, video URL identities without query
parameters, visible/total card counts, captures, history indices and render events.
Diagnostic exports also contain saved history HTML
and up to six recent feed-container HTML snapshots per page session, retained for
three sessions. Each container snapshot is capped at 120,000 characters and marked
if truncated, with per-card class, short text, links and computed visibility for debugging. These
capture before refresh, after rendering, at capture completion/timeout, and export.
HTML can contain personal recommendations and tracking links; inspect before
sharing. No cookie API is read. Normal `pnpm build` disables logging
and the export button. Export before replacing the diagnostic build.

For each startup setting (continue previous session on/off):

1. Open Bilibili, use 换一换 a few times, then try both history arrows.
2. Leave the tab open, quit Chrome completely, and relaunch.
3. If the setting is off and the tab is absent, open Bilibili manually.
4. Use 换一换 and both arrows again, then click **Export logs**.
5. Label the file `startup-on` or `startup-off`; Chrome does not expose this
   setting to this extension. Also note whether you quit while viewing history.

No console copying or narration of every click is needed. Abrupt termination can
lose the final in-flight log write; earlier persisted events remain available.

Also click Back while a refresh is still loading. The selected history should stay
selected when loading finishes, and Forward should reach the completed new feed.
Capture ignores links inside history overlays. At the ten-item limit, an actively
viewed snapshot is retained and the oldest other snapshot is removed instead.
History is ephemeral and limited to ten snapshots. Installing or updating the
extension, including reloading an unpacked build, clears it so stale snapshots
from an earlier implementation cannot affect the new build.
On a normal page load or reload, the current native feed is captured as the newest
feed instead of being replaced by an older saved snapshot. When Chrome restores an
older page through session history (`back_forward`), the newest saved feed is
displayed. Refreshing from history does not append that stale native feed.
When refreshing, the history overlay is removed immediately so Bilibili's loading
state and new feed are visible. The selected history remains stored, and navigating
while the refresh is loading keeps that selection until the new feed is captured.
Diagnostic exports include a revision (`navigate-feed-13`) in new page sessions
so that loading an updated build can be verified without clearing storage.
