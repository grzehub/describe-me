import { forwardRef, memo } from 'react'
import './styles.css'
import './Chip.css'

export interface ChipProps {
  label: string
  /** `accent` draws the eye to a chip the user just added. */
  tone?: 'neutral' | 'accent'
  /** Shows a remove button when set. */
  onRemove?: () => void
}

/**
 * A removable chip. `memo(forwardRef(arrow))` leaves the component without a
 * name of its own, so it is documented under its export.
 */
export const Chip = memo(
  forwardRef<HTMLSpanElement, ChipProps>(({ label, tone = 'neutral', onRemove }, ref) => {
    return (
      <span ref={ref} className={`chip chip-${tone}`}>
        {label}
        {onRemove && (
          <button
            type="button"
            className="chip-remove"
            aria-label={`remove ${label}`}
            onClick={onRemove}
          >
            ×
          </button>
        )}
      </span>
    )
  }),
)
