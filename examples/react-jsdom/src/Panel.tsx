import './styles.css'

export interface PanelProps {
  /** Heading shown above the body. */
  title: string
  children: React.ReactNode
}

/** A plain CSS-import component: the most common case of all. */
export function Panel({ title, children }: PanelProps) {
  return (
    <section className="panel">
      <h2 className="panel-title">{title}</h2>
      <div>{children}</div>
    </section>
  )
}
