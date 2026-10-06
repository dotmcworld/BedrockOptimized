# BedrockOptimized

A Minecraft Bedrock protocol library focused on efficient packet framing and reduced memory allocations.

## Development

Install dependencies with `npm install`. Examples are available in `example/`.

The `optimize-packet-buffers` branch contains packet framing and encryption optimizations, compatibility tests, and a reproducible benchmark. On that branch, run `npm test` and `npm run benchmark`.

## Performance

Local isolated benchmarks on Windows x64 with Node.js v24.19.0 measured 1.9–3.3x faster uncompressed batch encoding compared with the original implementation. These measurements exclude serialization, encryption, transport, network, and server processing; they do not establish an overall application speedup.

The encryption optimization removes a plaintext buffer allocation and copy. Its throughput was not separately benchmarked. Live Minecraft, Realm, RakNet, and WebRTC connections have not been tested with these changes.

## Credits and license

Derived from [BedrockX](https://github.com/thejfkvis/BedrockX) by thejfkvis, based on [bedrock-protocol](https://github.com/PrismarineJS/bedrock-protocol) by PrismarineJS. The upstream baseline is commit `2b947d2508a07c9efdf66e3f19c22b644c8d30a5` (version 1.4.6).

Distributed under the MIT license. See [LICENSE](LICENSE) for the original copyright and license terms.
