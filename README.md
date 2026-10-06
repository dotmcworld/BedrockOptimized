# BedrockOptimized

A Minecraft Bedrock protocol library focused on efficient packet framing and reduced memory allocations.

## Development

Install dependencies with `npm install`. See [the example guide](example/README.md) for connection, packet-counting, and local relay examples.

Packet framing and encryption optimizations, compatibility tests, and a reproducible benchmark are included. Run `npm test` and `npm run benchmark`.

## Performance

Local isolated benchmarks on Windows x64 with Node.js v24.19.0 measured 1.9–3.3x faster uncompressed batch encoding compared with the original implementation. These measurements exclude serialization, encryption, transport, network, and server processing; they do not establish an overall application speedup.

The encryption optimization removes a plaintext buffer allocation and copy. Its throughput was not separately benchmarked. Live Minecraft, Realm, RakNet, and WebRTC connections have not been tested with these changes.

## Credits and license

Derived from [BedrockX](https://github.com/thejfkvis/BedrockX) by thejfkvis, based on [bedrock-protocol](https://github.com/PrismarineJS/bedrock-protocol) by PrismarineJS. The upstream baseline is commit `2b947d2508a07c9efdf66e3f19c22b644c8d30a5` (version 1.4.6).

Copyright (c) 2026 dotmcworld for BedrockOptimized modifications and additions. Original code remains credited to its upstream authors.

Use, modification, and redistribution are allowed under the MIT license. Keep the required copyright and permission notices. Please credit the original authors and do not claim their work as your own creation; you can credit yourself for your own changes.

See [LICENSE](LICENSE) for the terms and [NOTICE.md](NOTICE.md) for attribution details. The attribution request does not add restrictions to the MIT license.

## Repository history

This repository starts with a fresh import maintained by dotmcworld. Its GitHub contributor list reflects this repository history, not sole authorship of the inherited source. Upstream authorship and license credits are preserved above and in LICENSE.
