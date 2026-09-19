import { useState } from 'react'
import { Button } from './Button'
import './styles.css'

export interface CounterProps {
  initial?: number
  min?: number
}

export function Counter({ initial = 0, min = 0 }: CounterProps) {
  const [value, setValue] = useState(initial)
  const atMin = value <= min
  return (
    <div className="counter" role="group" aria-label="counter">
      <Button
        variant="secondary"
        size="sm"
        aria-label="decrement"
        disabled={atMin}
        onClick={() => setValue((v) => v - 1)}
      >
        −
      </Button>
      <output className="counter-value" aria-label="value">
        {value}
      </output>
      <Button
        variant="secondary"
        size="sm"
        aria-label="increment"
        onClick={() => setValue((v) => v + 1)}
      >
        +
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setValue(initial)}>
        reset
      </Button>
      {atMin && <span className="counter-hint">minimum reached</span>}
    </div>
  )
}
