import { useState } from 'react'
import { Button } from './Button'
import './styles.css'

export interface MenuProps {
  label: string
  items: string[]
  onSelect?: (item: string) => void
}

export function Menu({ label, items, onSelect }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div
      className="menu"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      <Button
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label} {open ? '▴' : '▾'}
      </Button>
      {open && (
        <ul className="menu-list" role="menu">
          {items.map((item) => (
            <li
              key={item}
              role="menuitem"
              tabIndex={0}
              className="menu-item"
              aria-selected={selected === item || undefined}
              onClick={() => {
                setSelected(item)
                onSelect?.(item)
                setOpen(false)
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
      {selected && <p className="menu-selected">selected: {selected}</p>}
    </div>
  )
}
