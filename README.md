# Bilibili “换一换” History

Back and forward buttons for recommendations on the
[Bilibili homepage](https://www.bilibili.com/). Use 换一换 as usual, then
revisit the sets you just saw.

The extension keeps up to fifteen sets locally. History is temporary and clears
when the extension is updated or reloaded.

## Build from source

```sh
pnpm install --frozen-lockfile
pnpm build
```

Load `.output/chrome-mv3` through **Load unpacked** in `chrome://extensions`.

For bug reproduction and log exports, see [Diagnostics](docs/diagnostics.md).
