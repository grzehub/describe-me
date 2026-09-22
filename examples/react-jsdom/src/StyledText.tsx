/** Four lines, each styled a different way. Mirrors the browser-mode example. */
export function StyledText() {
  return (
    <div>
      <p className="styled-inline" style={{ color: 'rgb(255, 0, 0)' }}>
        inline style attribute
      </p>
      <p className="styled-tag">runtime &lt;style&gt; tag</p>
      <p className="styled-cssom">CSSOM insertRule (emotion, styled-components)</p>
      <p className="styled-adopted">adoptedStyleSheets (Lit, web components)</p>
    </div>
  )
}
