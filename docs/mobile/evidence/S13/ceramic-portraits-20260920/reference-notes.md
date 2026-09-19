# Ceramic portrait stand references — research only

Checked 2026-09-20 (Europe/Moscow). Scope: the user's three requested sculpted ceramic portrait-head stands, after the golden whales. No runtime, catalog, tests or build changes; no remote image files downloaded. These are references for original 3D modeling, not portrait stickers or a scan/replica of an existing commercial character mug.

## Recommended sources

| Subject | Modeling reference | Provenance and exact source | Rights evidence and limitation |
|---|---|---|---|
| Александр Пушкин / Alexander Pushkin | Orest Kiprensky, 1827, Portrait of the Poet A. S. Pushkin | [Tretyakov official catalog, inventory 168](https://my.tretyakov.ru/app/masterpiece/8679); [Commons original file](https://commons.wikimedia.org/wiki/File:Kiprensky_Pushkin.jpg), page revision 1232569605 | Commons marks the painting and faithful reproduction PD-Art / PD-old-100-expired; Kiprensky died in 1836. Use this exact reproduction's record, not the separate modern museum photographs carrying CC BY-SA. Museum page verifies authorship/date; the web text fetch exceeded the tool limit, but the museum's indexed entry was available. |
| Лев Толстой / Leo Tolstoy | Ilya Repin, 1887, seated mature Tolstoy with long beard | [Tretyakov official catalog, inventory 747](https://my.tretyakov.ru/app/masterpiece/20213); [Commons original file](https://commons.wikimedia.org/wiki/File:Ilya_Efimovich_Repin_(1844-1930)_-_Portrait_of_Leo_Tolstoy_(1887).jpg), revision 1184414920 | Commons marks PD-Art and expired copyright in stated territories, plus pre-1931 US publication. Repin died in 1930: this is not evidence of universal expiry in every life-plus-100 jurisdiction. The source painting is suitable for researched modeling; worldwide commercial derivative clearance is not asserted. Avoid the separately retouched crop that carries CC BY-SA 3.0. |
| Эрнест Хемингуэй / Ernest Hemingway | Mature Hemingway aboard Pilar, circa 1950; preferred over Karsh for the bearded ceramic head | [Commons original file](https://commons.wikimedia.org/wiki/File:Ernest_Hemingway_1950.jpg), revision 1232213117; linked [NARA record 192662](https://catalog.archives.gov/id/192662), Ernest Hemingway Photograph Collection / JFK Library | The exact Commons file records release by copyright holder JFK Library and reviewed VRT correspondence **2011070410000468**, rather than assuming every archive photo is free. Photographer unspecified. Direct NARA/legacy JFK item retrieval was unavailable during this pass; the permission correspondence itself is private to VRT. This is documented reference evidence, not independently inspected permission correspondence or blanket legal approval. |

Do not substitute the smaller Hemingway 1950 crop's older US-no-notice tag for the original file's holder-release/VRT record. Keep attribution as: “Ernest Hemingway Photograph Collection, John F. Kennedy Presidential Library and Museum, Boston; photographer not specified; circa 1950; NARA 192662.”

The familiar [Hemingway portrait by Yousuf Karsh, 1957](https://karsh.org/ernest-hemingway/) is not a cleared production source: the [estate's licensing page](https://karsh.org/inquiries/licensing/) states copyright and provides licensing contacts. Do not reproduce its characteristic sweater/lighting/photographic treatment as though free, and do not contact anyone without the user's authorization.

A useful secondary reference already on disk is Lloyd Arnold's Hemingway at the typewriter, 1939: [Library of Congress item 2002736785](https://www.loc.gov/pictures/item/2002736785/) records Arnold/date and “No known restrictions on publication”; [Commons file](https://commons.wikimedia.org/wiki/File:ErnestHemingway.jpg) revision 1109452985 uses US non-renewal with a territorial caveat. It shows a younger moustached Hemingway, not the mature bearded reference. Do not mix its age with the older head merely because this asset is local.

## Existing local assets — scoped inspection

Authoritative current mappings are in src/data/countries/generated/writerPortraits.generated.json (checkedAt 2026-08-31). The keys are russia:pushkin, usa:ernest_hemingway and russia:tolstoy.

- q7200: Kiprensky's Pushkin, already mapped to the selected Commons file. Visually inspected locally in this task.
- q23434: Arnold's 1939 Hemingway at a typewriter, visually inspected; swept-back dark hair and moustache, not the requested mature-beard reference.
- q7243: Sergey Levitsky's **1856** Tolstoy, visually inspected. The local rights queue documents this photograph, but it is the young military-era face and is unsuitable for the familiar long-bearded silhouette. Preserve the existing editorial portrait.
- public/brand/tolstoy.jpg: visually inspected old engraved long-bearded frontal portrait. No source/license record for this exact file was established by the scoped lookup; do not infer provenance from its filename or use it as the sole cleared reference.
- Old profile paths public/images/writers/{pushkin,alexander-pushkin,hemingway,tolstoy,leo-tolstoy}.jpg are absent in this checkout. Do not build the new stand from those stale strings.

- public/assets/writer-portraits/q7200.webp — 32958 bytes; SHA256 d8a60beeec637898c789b9b84672aa7320bc8359deb4672e8b9a4c6661aafdb7
- public/assets/writer-portraits/q23434.webp — 58700 bytes; SHA256 788c77c5da5c966d1a89a2a27d107667b299723629965b4cfad1a5e8619ef64b
- public/assets/writer-portraits/q7243.webp — 17768 bytes; SHA256 2f8f3a46c0b10e3ac736858980bdd0611240bdb99a4bf042a56d64f11d8102d2
- public/brand/tolstoy.jpg — 93710 bytes; SHA256 01f862c1b22a40848dc27442589ec4b125c75648bc0e7211e5e7e4230ca645eb

## Likeness landmarks and ceramic translation

These are proposed artistic interpretation targets, not measured anthropometry. Final front/profile/three-quarter comparisons must use the selected reference before claiming likeness.

- **Pushkin:** long relatively narrow face, open high forehead, a broad halo of individual curled hair masses, long sideburns with clean chin, distinct projecting nose and modeled lips. Keep the curl silhouette separate from cheek and jaw; avoid a generic bearded bust. Local Kiprensky reference was actually viewed.
- **Hemingway:** mature broad face and cheek planes, receding short swept-back hair, broad nose, compact moustache and short dense beard; distinguish its jaw/beard volume from Tolstoy's hanging beard. These targets need confirmation against the circa-1950 image at sculpt time; the archive/Commons metadata has been verified, but this pass has not yet visually decoded that remote image.
- **Tolstoy:** open bald/high forehead, heavy projecting brows over deep eye sockets, broad nose, hair around temples/ears and a long split/irregular beard with distinct large locks. Use Repin 1887 for age and likeness; do not promote the locally viewed young photograph to this reference. Remote painting identity/rights metadata was checked; exact reference pixels still need direct visual comparison.

Model three independently readable continuous head volumes: real brow/orbit/nose/cheek/lip transitions, ears anchored to the skull, beard and hair as shaped ceramic masses with finer carving. Ivory ceramic should read through glaze highlights and softened relief, with subtle material variation; no metallic face, painted photographic skin, flat face plane or repeated spherical curls hiding weak anatomy. The “portrait mug” analogy informs glazed ceramic and sculptural character, not an obligation to add a mug handle or copy a manufacturer's design. Keep a believable foot/neck and globe contact support; review proportions under the actual globe, not just a close-up.

## Scope and rights boundaries for the next implementation

Changing from a photo/painting to a 3D ceramic head is not automatically a copyright exemption: the [US Copyright Office Compendium §507](https://www.copyright.gov/comp3/chap500/ch500-identifying-works.pdf) expressly includes cross-medium derivative examples. Record the chosen image, author/collection, exact page revision, rights basis, access date and original modeling authorship. Portrait subject identity is separate from the photographer's expressive treatment. No claim is made here about worldwide derivative, personality, trademark, museum-use or merchandise clearance.

Proceed with original local draft geometry after the whales, preserving the existing renderer, camera, composition lifecycle, resource ownership, non-picking decoration and tier behavior. IDs/registry inclusion will need a separate explicit user-addition design; these three new heads must not be falsely mapped to canonical-globe simply to bypass the required-item guard, nor silently rewrite the immutable 29-item Starter Set. No optional SKU, entitlement, child or release authority is introduced by this research.

Current status: reference research recorded; original model draft may proceed with the above source limitations. Art acceptance, likeness approval and global release rights are **not** established.
