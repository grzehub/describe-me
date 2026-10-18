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
/* The filter hides specimens whose classes set display. */
[hidden] {
  display: none !important;
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
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  margin: 0 0 14px;
  padding: 0;
  color: light-dark(#4f5762, #b2b9c3);
  font: 600 11.5px/1.3 ${UI_FONT};
}
.fd-count {
  color: light-dark(#6b7381, #8a939f);
  font-weight: 400;
}
.fd-prefix {
  min-width: 0;
  color: light-dark(#6b7381, #8a939f);
  font: 400 11px/1.3 ${MONO_FONT};
  overflow-wrap: anywhere;
}
.fd-badge {
  display: inline-block;
  padding: 0 5px;
  border-radius: 4px;
  background: light-dark(#eceef2, #2a2f36);
  color: light-dark(#4f5762, #b2b9c3);
  font: 500 10px/16px ${UI_FONT};
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.fd-note {
  margin: -6px 0 16px;
  color: light-dark(#6b7381, #8a939f);
  font: 400 11.5px/1.45 ${UI_FONT};
  overflow-wrap: anywhere;
}
.fd-code {
  color: light-dark(#1c2024, #e6e8eb);
  font: 400 11px/1.3 ${MONO_FONT};
}
.fd-name {
  display: block;
  color: light-dark(#1c2024, #e6e8eb);
  font: 400 11.5px/1.35 ${MONO_FONT};
  overflow-wrap: anywhere;
}
.fd-name:has(+ .fd-badge) {
  display: inline;
  margin-right: 6px;
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
.fd-pairs {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 168px), 1fr));
}
/* Four tiles in a row: main, light, dark and the contrastText pair. */
.fd-intent {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 112px), 1fr));
}
.fd-pair {
  display: block;
  min-width: 0;
}
.fd-pair-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  margin-bottom: 8px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px light-dark(rgb(0 0 0 / 0.1), rgb(255 255 255 / 0.14));
  font: 600 20px/1 ${UI_FONT};
}
.fd-pair-fg {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  margin-top: 8px;
}
.fd-pair-text {
  min-width: 0;
}
.fd-dot {
  flex: none;
  width: 12px;
  height: 12px;
  margin-top: 2px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px light-dark(rgb(0 0 0 / 0.16), rgb(255 255 255 / 0.2));
}
.fd-contrast {
  display: inline-block;
  margin-top: 8px;
  padding: 1px 6px;
  border-radius: 4px;
  background: light-dark(#eceef2, #2a2f36);
  color: light-dark(#1c2024, #e6e8eb);
  font: 500 11px/1.4 ${MONO_FONT};
}
.fd-contrast:empty {
  display: none;
}
.fd-pair[data-level='fail'] .fd-contrast {
  background: light-dark(#fde8e8, #4a1f1f);
  color: light-dark(#a3221b, #ffb4ab);
}
.fd-ramp {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  row-gap: 16px;
}
.fd-ramp-step {
  display: block;
  min-width: 0;
}
.fd-ramp-chip {
  display: block;
  height: 64px;
  margin-bottom: 6px;
}
.fd-ramp-step:first-child .fd-ramp-chip {
  border-radius: 8px 0 0 8px;
}
.fd-ramp-step:last-child .fd-ramp-chip {
  border-radius: 0 8px 8px 0;
}
.fd-step {
  display: block;
  padding-right: 4px;
  color: light-dark(#1c2024, #e6e8eb);
  font: 600 11px/1.35 ${MONO_FONT};
}
.fd-ramp .fd-value {
  padding-right: 4px;
  font-size: 10px;
}
.fd-palette {
  display: grid;
  gap: 6px;
}
.fd-prow {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}
.fd-family {
  color: light-dark(#4f5762, #b2b9c3);
  font: 400 11px/1.3 ${MONO_FONT};
  overflow-wrap: anywhere;
}
.fd-pchips {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  min-width: 0;
}
.fd-pchip {
  display: block;
  width: 24px;
  height: 24px;
}
.fd-pchip-paint {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px light-dark(rgb(0 0 0 / 0.1), rgb(255 255 255 / 0.14));
}
.fd-label {
  display: block;
  color: light-dark(#1c2024, #e6e8eb);
  font: 500 11.5px/1.35 ${MONO_FONT};
}
.fd-derived .fd-bar {
  opacity: 0.6;
}
.fd-drop {
  display: block;
  width: 56px;
  height: 56px;
  margin: 4px 0 14px 4px;
  border-radius: 12px;
  background: light-dark(#ffffff, #3a404a);
}
.fd-text-shadow {
  display: block;
  margin: 0 0 8px;
  color: light-dark(#1c2024, #e6e8eb);
  font: 600 40px/1.1 ${UI_FONT};
}
.fd-paragraph {
  max-width: 20em;
  font-size: 15px;
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
