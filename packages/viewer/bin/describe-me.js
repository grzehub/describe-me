#!/usr/bin/env node
// Committed entry point, so pnpm can link the binary at install time, before
// the CLI is compiled. The real code lives in dist-cli/ (built by `pnpm build`).
import '../dist-cli/main.js'
