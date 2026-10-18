import type { FoundationGroup } from '@describe-me/core/types'

/** The sections of the Foundations view, in the order the toolbar shows them. */
export const FOUNDATION_SECTIONS: readonly { id: FoundationGroup; title: string }[] = [
  { id: 'colors', title: 'Colors' },
  { id: 'typography', title: 'Typography' },
  { id: 'spacing', title: 'Spacing' },
  { id: 'radius', title: 'Radius' },
  { id: 'shadows', title: 'Shadows' },
  { id: 'breakpoints', title: 'Breakpoints' },
  { id: 'motion', title: 'Motion' },
  { id: 'other', title: 'Other' },
]
