# Queue and fragmentation benchmark

Run `npm run benchmark:queues`. The receiver comparison uses a frozen copy of the previous implementation in `fixtures/nethernet-legacy.js`. The relay comparison measures the previous shifting loop versus linear iteration, including queue cloning; it does not send real packets.

Node.js v24.19.0, Windows x64. Warmup followed by seven alternating rounds; results use median elapsed time. Inputs are fixed 50,000-byte fragments. Iteration counts and raw results are recorded in [queue-results.json](queue-results.json).

| Workload | Previous ms | Optimized ms | Previous / optimized |
| --- | ---: | ---: | ---: |
| 1 x 50 KB fragments | 1.72 | 2.09 | 0.82x |
| 8 x 50 KB fragments | 307.39 | 154.96 | 1.98x |
| 64 x 50 KB fragments | 732.32 | 65.8 | 11.13x |
| 256 x 50 KB fragments | 1550.45 | 29.45 | 52.64x |
| drain 1000 relay chunks (including queue clone) | 1.96 | 0.76 | 2.58x |
| drain 30000 relay chunks (including queue clone) | 1262.87 | 4.87 | 259.26x |

Fragmented-message reassembly now copies each retained fragment once and concatenates the complete message once, instead of repeatedly copying its growing prefix. Pending fragment ownership is preserved when callers reuse input buffers. Standalone messages remain buffer views. The single-frame control was slightly slower in this run (2.09 ms versus 1.72 ms across 10,000 messages); this release targets fragmented traffic and queue drains rather than promising improvement on every workload.

Relay chunks drain in a linear pass rather than shifting every element. Send segmentation avoids an intermediate array and per-fragment buffer views. Queued sends are detached before delivery, so delivered buffers are released and reopening does not replay them. Close clears pending receive/send buffers. Messages requiring more than the one-byte counter's 256-fragment capacity are rejected before any frames are transmitted.

Eight tests pass, including byte-for-byte reassembly at fragment boundaries, reusable input buffers, typed-array offsets, sequence validation, send-size rejection, repeated queue flushing, reentrant receive callbacks, relay order, framing compatibility, and encrypted stream compatibility. Native RakNet, WebRTC, live Minecraft, Realms, and complete gameplay connections have not been tested.

These are isolated hot-path measurements against the previous BedrockOptimized implementation. They exclude authentication, compression, packet parsing, encryption, actual transport sends, and network/server work. Results vary with machine, workload, allocation pressure and runtime. They do not establish total application throughput or superiority over another library.
