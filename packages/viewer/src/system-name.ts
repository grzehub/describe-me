import type { DesignSystemId } from '@describe-me/core/types'

const NAMES: Record<DesignSystemId, string> = {
  tailwind: 'Tailwind',
  shadcn: 'shadcn/ui',
  mui: 'Material UI',
  chakra: 'Chakra UI',
  mantine: 'Mantine',
  'radix-themes': 'Radix Themes',
  'styled-components': 'styled-components',
  emotion: 'Emotion',
  antd: 'Ant Design',
}

/** How the viewer names a design system. An id from a newer reporter shows as is. */
export function systemName(id: DesignSystemId): string {
  return NAMES[id] ?? id
}
