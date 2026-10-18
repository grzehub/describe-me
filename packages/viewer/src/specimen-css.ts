const UI_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
const MONO_FONT = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"

/**
 * The specimen frame's own stylesheet. It has no layer, so it beats the
 * project's CSS in `@layer project`, Tailwind's preflight included. Every
 * class starts with `fd-`, so no project rule reaches the specimens. Colors
 * come from `light-dark()`, so labels follow the canvas, never the viewer theme.
 */
export const SPECIMEN_CSS = `
:root {
  color-scheme: light dark;
}
html,
body {
  height: auto;
  min-height: 0;
  margin: 0;
  padding: 0;
  background: transparent;
}
html {
  overflow: hidden;
}
.fd-root {
  display: block;
  margin: 0;
  padding: 2px 2px 12px;
  color: light-dark(#1c2024, #e6e8eb);
  font: 400 12px/1.45 ${UI_FONT};
  -webkit-font-smoothing: antialiased;
}
.fd-block {
  display: block;
  margin: 0;
  padding: 0;
}
.fd-block + .fd-block {
  margin-top: 32px;
}
.fd-block-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 14px;
  padding: 0;
  color: light-dark(#4f5762, #b2b9c3);
  font: 600 11.5px/1.3 ${UI_FONT};
}
.fd-count {
  color: light-dark(#6b7381, #8a939f);
  font-weight: 400;
}
.fd-name {
  display: block;
  color: light-dark(#1c2024, #e6e8eb);
  font: 400 11.5px/1.35 ${MONO_FONT};
  overflow-wrap: anywhere;
}
.fd-value {
  display: block;
  margin-top: 2px;
  color: light-dark(#6b7381, #8a939f);
  font: 400 11px/1.35 ${MONO_FONT};
  overflow-wrap: anywhere;
}
.fd-parts {
  display: block;
  margin-top: 4px;
  color: light-dark(#6b7381, #8a939f);
  font: 400 10.5px/1.4 ${MONO_FONT};
  overflow-wrap: anywhere;
}
.fd-swatches,
.fd-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 132px), 1fr));
  gap: 18px 14px;
}
.fd-shadows {
  gap: 36px 28px;
  padding: 6px 6px 44px;
}
.fd-swatch,
.fd-tile {
  display: block;
  min-width: 0;
}
.fd-chip {
  display: block;
  height: 56px;
  margin-bottom: 8px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px light-dark(rgb(0 0 0 / 0.1), rgb(255 255 255 / 0.14));
}
.fd-box {
  display: block;
  width: 72px;
  height: 72px;
  margin-bottom: 8px;
  border: 1.5px solid light-dark(#4a63d8, #8ea2ff);
  background: light-dark(#eef1fd, #252c45);
}
.fd-card {
  display: block;
  height: 72px;
  margin-bottom: 10px;
  border-radius: 8px;
  background: light-dark(#ffffff, #23272e);
}
.fd-rows {
  display: block;
}
.fd-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 24px;
  padding: 10px 0;
  border-top: 1px solid light-dark(#eceef2, #2a2f36);
}
.fd-row:first-child {
  border-top: 0;
  padding-top: 0;
}
.fd-meta {
  flex: 0 1 240px;
  min-width: 0;
}
.fd-show {
  flex: 1 1 240px;
  min-width: 0;
}
.fd-tiles > .fd-row {
  grid-column: 1 / -1;
}
.fd-sample {
  display: block;
  margin: 0;
  color: light-dark(#1c2024, #e6e8eb);
  font-size: 20px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.fd-bar {
  display: block;
  height: 12px;
  min-width: 1px;
  max-width: 100%;
  border-radius: 2px;
  background: light-dark(#4a63d8, #8ea2ff);
}
.fd-probe {
  display: none;
}
.fd-measure {
  position: absolute;
  top: 0;
  left: 0;
  height: 0;
  visibility: hidden;
}
`
