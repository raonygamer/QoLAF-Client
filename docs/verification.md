# Verification and source attribution

The port uses the local AstrofluxClient source (repository HEAD `b7a4f5cba87c8af9c484339de4ecf0dec0d4d890`):

| TypeScript module | AS3 source |
| --- | --- |
| `src/target/system.ts` | `src/qolaf/target/TargetSystem.as` |
| `src/chat/history.ts` | `src/af/ChatInputHistory.as` |
| `src/chat/parser.ts` | `src/af/ChatCommandParser.as` |
| `src/telemetry/metrics.ts` | `src/core/hud/components/radar/RadarTelemetryMetrics.as` |
| `src/artifacts/fitness.ts` | `src/core/artifact/ArtifactStat.as`, `Artifact.as` |
| `src/settings/settings.ts` | Supported subset of `src/qolaf/data/ClientSettings.as` |

The browser DOM UI and lifecycle adapter are new. Automatic selection holds a valid NPC target instead of cycling equivalent NPCs; a higher-priority player can replace it. No gameplay/network protocol patch is included.

`tests/fixtures/host-core.js` is the actual QoLAF plugin loader at host commit `946fb07`, retained unmodified to test its calling conventions. The integration test installs the plugin, emits the class registry, starts a simulated game with Haxe getter conventions, exercises native chat and local commands, renders telemetry/target/artifact UI, and verifies exit/reconnect and disposal. It runs once against TypeScript and once against the emitted JavaScript module.

Unit tests cover chat parsing and drafts, range/cooldown/lock/death/group rules, settings validation, FPS/speed math and artifact score cases. These are automated DOM simulations, not a real authenticated game session. A browser session was unavailable during initial implementation; actual rendering and gameplay still need a live check.
