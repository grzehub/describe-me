import { configure } from '@testing-library/react'

// Many projects configure Testing Library in a setup file of their own, and
// Vitest runs it before describe-me's. The value is the default, so only the
// load order changes.
configure({ asyncUtilTimeout: 1000 })
