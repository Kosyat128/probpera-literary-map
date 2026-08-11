import officialSnapshotJson from "./generated/nobelLiterature.official.json";

export type OfficialNobelLiteratureRecord = {
  id: number;
  name: string;
  year: number;
  portion: "1" | "1/2";
  sortOrder: number;
  apiUrl: string;
  htmlUrl: string;
};

type OfficialNobelLiteratureSnapshot = {
  version: number;
  category: "Literature";
  throughYear: number;
  retrievedAt: string;
  officialApiUrl: string;
  officialDeveloperDocumentation: string;
  laureates: OfficialNobelLiteratureRecord[];
};

export const officialNobelLiteratureSnapshot =
  officialSnapshotJson as OfficialNobelLiteratureSnapshot;

/**
 * Curated identity bridge between the immutable local `countryId:writerId`
 * keys and Nobel Prize Outreach laureate IDs. A person may intentionally have
 * more than one country card; the official ID is the deduplication identity.
 */
export const localNobelLiteratureWriterKeysByLaureateId = {
  569: ["france:sully_prudhomme"],
  571: ["germany:theodor_mommsen"],
  572: ["norway:bjornstjerne_bjornson"],
  573: ["france:frederic_mistral"],
  574: ["spain:jose_echegaray"],
  575: ["poland:henryk_sienkiewicz"],
  576: ["italy:giosue_carducci"],
  577: ["england:rudyard_kipling"],
  578: ["germany:rudolf_eucken"],
  579: ["sweden:selma_lagerlof"],
  580: ["germany:paul_heyse"],
  581: ["belgium:maurice_maeterlinck"],
  582: ["germany:gerhart_hauptmann"],
  583: ["india:rabindranath_tagore"],
  584: ["france:romain_rolland"],
  585: ["sweden:verner_von_heidenstam"],
  586: ["denmark:karl_gjellerup"],
  587: ["denmark:henrik_pontoppidan"],
  588: ["switzerland:carl_spitteler"],
  589: ["norway:knut_hamsun"],
  590: ["france:anatole_france"],
  592: ["spain:jacinto_benavente"],
  593: ["ireland:w_b_yeats"],
  594: ["poland:wladyslaw_reymont"],
  596: ["ireland:george_bernard_shaw"],
  597: ["italy:grazia_deledda"],
  600: ["france:henri_bergson"],
  601: ["norway:sigrid_undset"],
  602: ["germany:thomas_mann"],
  603: ["usa:sinclair_lewis"],
  604: ["sweden:erik_axel_karlfeldt"],
  605: ["england:john_galsworthy"],
  606: ["russia:buninin"],
  607: ["italy:luigi_pirandello"],
  608: ["usa:eugene_oneill"],
  609: ["france:roger_martin_du_gard"],
  610: ["usa:pearl_s_buck"],
  613: ["finland:frans_sillanpaa"],
  614: ["denmark:johannes_v_jensen"],
  615: ["chile:gabriela_mistral"],
  617: ["germany:hermann_hesse", "switzerland:hermann_hesse"],
  618: ["france:andre_gide"],
  619: ["england:t_s_eliot"],
  620: ["usa:william_faulkner"],
  621: ["england:bertrand_russell"],
  622: ["sweden:par_lagerkvist"],
  623: ["france:francois_mauriac"],
  624: ["england:winston_churchill"],
  625: ["usa:ernest_hemingway"],
  626: ["iceland:halldor_laxness"],
  627: ["spain:juan_ramon_jimenez"],
  628: ["france:albert_camus"],
  629: ["russia:pasternak"],
  630: ["italy:salvatore_quasimodo"],
  631: ["france:saint_john_perse"],
  633: ["serbia:ivo_andric"],
  634: ["usa:john_steinbeck"],
  635: ["greece:giorgos_seferis"],
  637: ["france:jean_paul_sartre"],
  638: ["russia:sholokhov"],
  639: ["israel:s_y_agnon"],
  640: ["sweden:nelly_sachs"],
  641: ["guatemala:miguel_angel_asturias"],
  642: ["japan:kawabata_yasunari"],
  643: ["ireland:samuel_beckett"],
  644: ["russia:solzhenitsyn"],
  645: ["chile:pablo_neruda"],
  647: ["germany:heinrich_boell"],
  648: ["australia:patrick_white"],
  649: ["sweden:eyvind_johnson"],
  650: ["sweden:harry_martinson"],
  651: ["italy:eugenio_montale"],
  652: ["usa:saul_bellow"],
  653: ["spain:vicente_aleixandre"],
  654: ["usa:isaac_bashevis_singer"],
  655: ["greece:odysseas_elytis"],
  657: ["poland:czeslaw_milosz"],
  658: ["austria:elias_canetti"],
  659: ["colombia:gabriel_garcia_marquez"],
  660: ["england:william_golding"],
  661: ["czechia:jaroslav_seifert"],
  662: ["france:claude_simon"],
  663: ["nigeria:wole_soyinka"],
  664: ["russia:brodsky"],
  665: ["egypt:naguib_mahfouz"],
  666: ["spain:camilo_jose_cela"],
  667: ["mexico:octavio_paz"],
  668: ["south_africa:nadine_gordimer"],
  669: ["saint_lucia:derek_walcott"],
  670: ["usa:tony_morrison"],
  671: ["japan:kenzaburo_oe"],
  672: ["ireland:seamus_heaney"],
  673: ["poland:wislawa_szymborska"],
  674: ["italy:dario_fo"],
  675: ["portugal:jose_saramago"],
  676: ["germany:guenter_grass"],
  734: ["china:gao_xingjian"],
  747: ["india:v_s_naipaul", "trinidad_and_tobago:vs_naipaul"],
  761: ["hungary:imre_kertesz"],
  763: ["south_africa:jm_coetzee"],
  782: ["austria:elfriede_jelinek"],
  801: ["england:harold_pinter"],
  808: ["turkey:orhan_pamuk"],
  817: ["england:doris_lessing", "zimbabwe:doris_lessing"],
  832: ["mauritius:jmg_le_clezio"],
  844: ["germany:herta_mueller"],
  854: ["peru:mario_vargas_llosa"],
  868: ["sweden:tomas_transtromer"],
  880: ["china:mo_yan"],
  892: ["canada:alice_munro"],
  912: ["france:patrick_modiano"],
  924: ["belarus:svetlana_alexievich"],
  937: ["usa:bob_dylan"],
  947: ["england:kazuo_ishiguro"],
  979: ["poland:olga_tokarczuk"],
  980: ["austria:peter_handke"],
  993: ["usa:louise_gluck"],
  1004: ["tanzania:abdulrazak_gurnah"],
  1017: ["france:annie_ernaux"],
  1032: ["norway:jon_fosse"],
  1042: ["south_korea:han_kang"],
  1056: ["hungary:laszlo_krasznahorkai"],
} as const satisfies Record<number, readonly string[]>;

/** The exact pre-reconciliation set that lacked `nobelYear` (75 bio gaps + 2 awards-only gaps). */
export const previouslyUnstructuredNobelWriterKeys = [
  "australia:patrick_white",
  "austria:elfriede_jelinek",
  "austria:peter_handke",
  "canada:alice_munro",
  "chile:gabriela_mistral",
  "chile:pablo_neruda",
  "china:gao_xingjian",
  "china:mo_yan",
  "colombia:gabriel_garcia_marquez",
  "egypt:naguib_mahfouz",
  "england:william_golding",
  "england:harold_pinter",
  "england:kazuo_ishiguro",
  "england:doris_lessing",
  "finland:frans_sillanpaa",
  "france:andre_gide",
  "france:albert_camus",
  "france:jean_paul_sartre",
  "france:claude_simon",
  "france:patrick_modiano",
  "france:annie_ernaux",
  "germany:thomas_mann",
  "germany:hermann_hesse",
  "germany:heinrich_boell",
  "germany:guenter_grass",
  "germany:herta_mueller",
  "greece:giorgos_seferis",
  "greece:odysseas_elytis",
  "guatemala:miguel_angel_asturias",
  "hungary:imre_kertesz",
  "iceland:halldor_laxness",
  "india:v_s_naipaul",
  "ireland:george_bernard_shaw",
  "ireland:samuel_beckett",
  "ireland:seamus_heaney",
  "israel:s_y_agnon",
  "italy:luigi_pirandello",
  "italy:grazia_deledda",
  "italy:salvatore_quasimodo",
  "italy:eugenio_montale",
  "italy:dario_fo",
  "japan:kawabata_yasunari",
  "japan:kenzaburo_oe",
  "mauritius:jmg_le_clezio",
  "mexico:octavio_paz",
  "nigeria:wole_soyinka",
  "norway:sigrid_undset",
  "peru:mario_vargas_llosa",
  "poland:czeslaw_milosz",
  "poland:wislawa_szymborska",
  "portugal:jose_saramago",
  "russia:buninin",
  "russia:solzhenitsyn",
  "russia:pasternak",
  "russia:sholokhov",
  "russia:brodsky",
  "saint_lucia:derek_walcott",
  "serbia:ivo_andric",
  "south_africa:nadine_gordimer",
  "south_africa:jm_coetzee",
  "south_korea:han_kang",
  "spain:juan_ramon_jimenez",
  "spain:vicente_aleixandre",
  "spain:camilo_jose_cela",
  "sweden:par_lagerkvist",
  "switzerland:hermann_hesse",
  "tanzania:abdulrazak_gurnah",
  "trinidad_and_tobago:vs_naipaul",
  "turkey:orhan_pamuk",
  "usa:ernest_hemingway",
  "usa:william_faulkner",
  "usa:eugene_oneill",
  "usa:john_steinbeck",
  "usa:sinclair_lewis",
  "usa:tony_morrison",
  "usa:bob_dylan",
  "zimbabwe:doris_lessing",
] as const;

export const nobelLiteratureLaureateIdByWriterKey = new Map<string, number>(
  Object.entries(localNobelLiteratureWriterKeysByLaureateId).flatMap(
    ([laureateId, writerKeys]) =>
      writerKeys.map((writerKey) => [writerKey, Number(laureateId)] as const)
  )
);

export const officialNobelLiteratureById = new Map(
  officialNobelLiteratureSnapshot.laureates.map((record) => [record.id, record] as const)
);

const nobelLiteratureLaureateIdsByWriterId = new Map<string, Set<number>>();
for (const [writerKey, laureateId] of nobelLiteratureLaureateIdByWriterKey) {
  const writerId = writerKey.slice(writerKey.indexOf(":") + 1);
  const ids = nobelLiteratureLaureateIdsByWriterId.get(writerId) || new Set<number>();
  ids.add(laureateId);
  nobelLiteratureLaureateIdsByWriterId.set(writerId, ids);
}

export function officialNobelLiteratureRecordForWriterKey(writerKey: string) {
  const laureateId = nobelLiteratureLaureateIdByWriterKey.get(writerKey);
  return laureateId === undefined
    ? undefined
    : officialNobelLiteratureById.get(laureateId);
}

/**
 * Structured fallback for legacy writer objects that retain the canonical
 * writer id but have not yet been enriched with `nobelAward`. Ambiguous ids
 * deliberately return undefined instead of guessing from prose or award text.
 */
export function officialNobelLiteratureRecordForWriterId(writerId: string) {
  const laureateIds = nobelLiteratureLaureateIdsByWriterId.get(writerId);
  if (!laureateIds || laureateIds.size !== 1) return undefined;
  return officialNobelLiteratureById.get([...laureateIds][0]);
}
