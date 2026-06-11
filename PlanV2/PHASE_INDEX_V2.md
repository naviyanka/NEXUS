# Phase Index V2

This document maps the old V1 phases to the new consolidated V2 phases.
The reduction from 45 to 21 phases is primarily due to:
1. Adopting `shadcn-admin` (eliminates building the shell from scratch).
2. Adopting `Microsoft...Negotiate` (eliminates custom auth pipeline).
3. Grouping related plugins into functional bundles rather than one phase per small plugin.

| V2 Phase | Old V1 Equivalent |
|---|---|
| Phase 0 | Phase 0 |
| Phase 1 | Phase 1, Phase 4 |
| Phase 2 | Phase 5, Phase 8 |
| Phase 3 | Phase 2, Phase 3 |
| Phase 4 | Phase 7, Phase 9 |
| Phase 5 | Phase 6 |
| Phase 6 | Phase 10 |
| Phase 7 | Phase 11, Phase 26 (UI component parts) |
| Phase 8 | Phase 12, Phase 13 |
| Phase 9 | Phase 14, Phase 15 |
| Phase 10 | Phase 16, New Ideas (Guacamole) |
| Phase 11 | Phase 17, Phase 20, Phase 21, Phase 22 |
| Phase 12 | Phase 23, Phase 24, Phase 27 |
| Phase 13 | Phase 25, Phase 26, Phase 29, Phase 31, Phase 32, Phase 33 |
| Phase 14 | Phase 28, Phase 30 |
| Phase 15 | Phase 34, Phase 35, Phase 36 |
| Phase 16 | Phase 37 |
| Phase 17 | Phase 18, Phase 19 |
| Phase 18 | Phase 38, Phase 39 |
| Phase 19 | Phase 42 |
| Phase 20 | Phase 43, Phase 44 |

*(Note: Phases 40 and 41 are integrated into the core shell in Phase 6 and Core Plugins in Phase 11/12).*
