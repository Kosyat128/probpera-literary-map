# Android private PIN primitives candidate

Production source change: one original private primitive context slot per inspection, an overlapping-worker claim refusal, and a private primitive block before MAX_BYTES. The prior codec and vault/storage logic remain byte-exact outside those spans. The actual factories return null.

The KDF uses only the fixed platform SecretKeyFactory PBKDF2WithHmacSHA256 and PBEKeySpec, 32-byte result, exact configured iterations at least 600000. Iterations above Integer.MAX_VALUE refuse rather than cast, clip or reduce. There is no custom cryptographic function, SHA1 fallback, installed dependency, provider injection or lower-iteration production helper. Android documents this SHA256 KDF from API26; absent algorithms on API24/25 fail closed while the client retains minSdk24.

PIN entries are owned ASCII digit byte arrays, 4..128 digits, with independent native confirmation and no PIN String. The platform call uses temporary char[] and salt copies; finally clears app-owned chars, salt and encoded result and PBEKeySpec's password. Public SecretKey.destroy is best effort. No guarantee of erasing provider-internal heap copies is made. Inputs longer than128 are rejected before ownership; the future native UI remains responsible for clearing its own entry on every rejection.

SecureRandom supplies fresh32B salt and credential. Three exact configured-iteration calibration derivations use ephemeral maxDigits dummy PINs, real continuous time, positive elapsed and an explicit1..5000ms limit. Native state, absolute original deadline, authority coordinates and full expected record are fenced before and after actual operations. Synchronous platform KDF is not internally preemptible: cancellation revokes immediately, but actual workers and buffers remain owned until the call returns and late outputs are wiped. No per256/internal-KDF cancellation guarantee is claimed.

Material is an original private96B salt/credential/hash transfer. Its private consumer receives a disposable copy under an actual worker and full-current fences; mutation rejects. close wipes, without consuming transfer identity or freeing native capacity. Settlement requires the original wrapper/backing and no active actual worker. Unknown/lost delivery retains the lane. All actual callbacks and temporary cleanup precede worker settlement.

The new B-only driver has24 focused source cases. Only the fixed platform KDF oracle cases use actual JVM SecretKeyFactory; native context, time, entropy, races and callbacks use explicit private synthetic fixtures. Root compiles the full Java source once alongside the unchanged old39 session driver and the new driver, then executes separate39 and24-case mains. The old69 canonical codec suite is outside this new affected scope.

The independent oracle request is a public synthetic vector: ASCII bytes49..56, salt00..1f, iterations600000, derived32B. Root computes its expected digest once through Node crypto and supplies one lower-case64hex driver argument. It is never a user PIN.

Programming still required: genuine checkpoint/action/host authority, native input UI/bridge, independent recovery, authoritative calibration admission and real private wire settlement adapter. Genuine native provider remains NOT_IMPLEMENTED. Android installed OS/device execution and Swift compilation are NOT_RUN. This candidate does not activate App/PIN/release/store behavior.

Primary API references: [SecretKeyFactory](https://developer.android.com/reference/javax/crypto/SecretKeyFactory), [PBEKeySpec](https://developer.android.com/reference/javax/crypto/spec/PBEKeySpec), [SecretKey](https://developer.android.com/reference/javax/crypto/SecretKey). No source/test/compiler/runtime check was executed by the author.
