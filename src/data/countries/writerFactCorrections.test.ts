import { describe, expect, it } from "vitest";

import { countries } from "./index";
import curatedWriterQids from "./generated/curatedWriterQids.generated.json";

function writerByKey(key: string) {
  const [countryId, writerId] = key.split(":");
  return countries
    .find((country) => country.id === countryId)
    ?.writers.find((writer) => writer.id === writerId);
}

describe("curated writer fact resolutions", () => {
  it.each([
    ["angola:pepetela", "birthDate", "1941-10-19"],
    ["armenia:narine_abgaryan", "birthDate", "1971-01-14"],
    ["argentina:mariana_enriquez", "birthDate", "1973-12-06"],
    ["argentina:samanta_schweblin", "birthDate", "1978-03-08"],
    ["argentina:rodrigo_fresan", "birthDate", "1963-07-18"],
    ["australia:nevil_shute", "deathDate", "1960-01-12"],
    ["australia:ruth_park", "birthDate", "1917-08-24"],
    ["azerbaijan:muhammad_fuzuli", "birthDate", "1494"],
    ["azerbaijan:muhammad_fuzuli", "deathDate", "1556"],
    ["bahrain:ali_abdullah_khalifa", "birthDate", "1944-03-04"],
    ["bahrain:ali_abdullah_khalifa", "deathDate", "2026-06-22"],
    ["barbados:austin_clarke", "birthDate", "1934-07-26"],
    ["belize:zee_edgell", "birthDate", "1940-10-21"],
    ["belize:zee_edgell", "deathDate", "2020-12-20"],
    ["bolivia:bartolome_arsans_de_orsua_y_vela", "birthDate", "1676"],
    ["bolivia:bartolome_arsans_de_orsua_y_vela", "deathDate", "1736"],
    ["bolivia:oscar_cerruto", "birthDate", "1912-06-13"],
    ["bolivia:vilma_tapia_anda", "birthDate", "1960"],
    ["bolivia:yolanda_bedregal", "birthDate", "1913-09-21"],
    ["burkina_faso:frederic_titinga_pacere", "birthDate", "1943-12-31"],
    ["burkina_faso:frederic_titinga_pacere", "deathDate", "2024-11-08"],
    ["burkina_faso:patrick_ilboudo", "birthDate", "1951-02-18"],
    ["burundi:roland_rugero", "birthDate", "1986-02-22"],
    ["cameroon:jean_roger_essomba", "birthDate", "1962"],
    ["cameroon:paul_dakeyo", "birthDate", "1948-02-18"],
    ["cameroon:werewere_liking", "birthDate", "1950-05-01"],
    ["central_african_republic:etienne_goyemide", "birthDate", "1942-01-22"],
    ["central_african_republic:etienne_goyemide", "deathDate", "1997-03-17"],
    ["cape_verde:ovidio_martins", "birthDate", "1928-09-17"],
    ["cape_verde:ovidio_martins", "deathDate", "1999-04-29"],
    ["chile:lina_meruane", "birthDate", "1970"],
    ["china:zhang_ling", "birthPlace", "Ханчжоу, Чжэцзян, Китай"],
    ["azerbaijan:mirza_fatali_akhundov", "birthDate", "1812-07-12"],
    ["azerbaijan:mirza_fatali_akhundov", "deathDate", "1878-03-10"],
    ["bolivia:jaime_saenz", "deathDate", "1986-08-16"],
    ["bulgaria:peyo_yavorov", "birthDate", "1878-01-13"],
    ["cambodia:rim_kin", "birthDate", "1911-11-08"],
    ["cambodia:rim_kin", "deathDate", "1959-01-27"],
    ["cameroon:calixthe_beyala", "birthDate", "1961-10-26"],
    ["colombia:santiago_gamboa", "birthDate", "1965-12-30"],
    ["costa_rica:carlos_luis_fallas", "birthDate", "1909-01-21"],
    ["cyprus:vasilis_michaelides", "deathDate", "1917-12-18"],
    ["cyprus:kostas_montis", "birthDate", "1914-02-18"],
    ["colombia:hector_rojas_herazo", "deathDate", "2002-04-11"],
    ["colombia:juan_carlos_botero", "birthDate", "1960"],
    ["colombia:laura_restrepo", "birthDate", "1950"],
    ["colombia:ricardo_silva_romero", "birthDate", "1975-08-14"],
    ["comoros:salim_hatubou", "birthPlace", "Хахайя, Нгазиджа, Коморы"],
    ["cote_d_ivoire:jean_marie_adiaffi", "name", "Жан-Мари Адиаффи"],
    ["cyprus:kyriakos_charalambous", "birthDate", "1940-01-31"],
    ["cyprus:nikos_nikolaidis", "birthDate", "1884"],
    ["cyprus:nikos_nikolaidis", "deathDate", "1956"],
    ["cyprus:pantelis_michanikos", "birthDate", "1926-07-30"],
    ["cyprus:pantelis_michanikos", "deathDate", "1979-01-20"],
    ["cyprus:tefkros_anthias", "birthDate", "1903-04-03"],
    ["cyprus:tefkros_anthias", "deathDate", "1968-11-08"],
    ["djibouti:aden_robleh_awaleh", "birthDate", "1941"],
    ["djibouti:aden_robleh_awaleh", "deathDate", "2014-10-31"],
    ["ecuador:lupe_rumazo", "birthDate", "1933-10-14"],
    ["egypt:hamdi_abu_golayyel", "deathDate", "2023"],
    ["egypt:ibrahim_aslan", "deathDate", "2012"],
    ["england:christopher_marlowe", "birthDate", "1564"],
    ["england:frederick_forsyth", "deathDate", "2025"],
    ["england:hilary_mantel", "birthDate", "1952-07-06"],
    ["england:hilary_mantel", "deathDate", "2022-09-22"],
    ["england:ian_mcewan", "birthDate", "1948-06-21"],
    ["england:joanne_harris", "birthDate", "1964"],
    ["england:john_le_carre", "birthDate", "1931-10-19"],
    ["england:john_le_carre", "deathDate", "2020-12-12"],
    ["england:oliver_goldsmith", "birthDate", ""],
    ["fiji:satendra_nandan", "birthDate", ""],
    ["fiji:subramani", "birthDate", ""],
    ["eritrea:alemseged_tesfai", "birthDate", "1944"],
    ["estonia:friedrich_robert_faehlmann", "birthDate", "1798-12-31"],
    ["ethiopia:bealu_girma", "birthDate", "1939"],
    ["finland:fredrika_bremer", "birthDate", "1801-08-17"],
    ["finland:fredrika_bremer", "deathDate", "1865-12-31"],
    ["france:chretien_de_troyes", "birthDate", ""],
    ["france:francois_rabelais", "birthDate", ""],
    ["french_guiana:leon_gontran_damas", "birthDate", "1912-03-28"],
    ["democratic_republic_of_congo:antoine_roger_bolamba", "birthPlace", "Бома, Демократическая Республика Конго"],
    ["democratic_republic_of_congo:kama_sywor_kamanda", "birthPlace", "Луэбо, Демократическая Республика Конго"],
    ["tanzania:said_ahmed_mohamed", "birthDate", "1947-12-12"],
    ["china:cao_xueqin", "birthDate", "ок. 1715"],
    ["china:cao_xueqin", "deathDate", "ок. 1763"],
    ["china:chi_ziqiang", "birthDate", "1964"],
    ["democratic_republic_of_congo:v_y_mudimbe", "deathDate", "2025-04-21"],
    ["dominica:phyllis_shand_allfrey", "deathDate", "1986"],
    ["ecuador:eliecer_cardenas", "deathDate", "2021-09-26"],
    ["egypt:ahmed_khaled_towfik", "birthDate", "1962-06-10"],
    ["egypt:ahmed_khaled_towfik", "deathDate", "2018-04-02"],
    ["egypt:bahaa_taher", "birthDate", "1935-01-13"],
    ["egypt:bahaa_taher", "deathDate", "2022-10-27"],
    ["egypt:naguib_mahfouz", "birthDate", "1911-12-11"],
    ["egypt:naguib_mahfouz", "deathDate", "2006-08-30"],
    ["egypt:rifaa_al_tahtawi", "birthDate", "1801-10-15"],
    ["egypt:salah_abdel_sabour", "birthDate", "1931-05-03"],
    ["egypt:salah_abdel_sabour", "deathDate", "1981-08-14"],
    ["egypt:sonallah_ibrahim", "deathDate", "2025-08-13"],
    ["egypt:taha_hussein", "birthDate", "1889-11-14"],
    ["egypt:taha_hussein", "deathDate", "1973-10-28"],
    ["georgia:otar_chiladze", "deathDate", "2009-10-01"],
    ["iraq:badr_shakir_al_sayyab", "birthDate", "1926-12-24"],
    ["israel:zeruya_shalev", "birthDate", "1959-04-13"],
    ["mongolia:lodoidamba", "birthDate", "1917-08-20"],
    ["mongolia:lodoidamba", "deathDate", "1970-01-11"],
    ["myanmar:ma_ma_lay", "birthDate", "1917-04-13"],
    ["nepal:laxmi_prasad_devkota", "birthDate", "1909-11-12"],
    ["new_zealand:loyd_jones", "birthDate", "1955-03-23"],
    ["nigeria:buchi_emecheta", "birthDate", "1944-07-21"],
    ["nigeria:helon_habila", "birthDate", "1967-11"],
    ["samoa:albert_wendt", "birthDate", "1939-10-27"],
    ["taiwan:li_ang", "birthDate", "1952-04-07"],
  ] as const)("pins %s %s to %s", (key, field, expected) => {
    expect(writerByKey(key)?.[field]).toBe(expected);
  });

  it("keeps the source-supported dates selected over conflicting staging values", () => {
    expect(writerByKey("iraq:nazik_al_malaika")?.birthDate).toBe("1923-08-23");
    expect(writerByKey("mali:amadou_hampate_ba")?.birthDate).toBe("1901");
    expect(writerByKey("nigeria:christopher_okigbo")?.birthDate).toBe(
      "1932-08-16"
    );
    expect(writerByKey("south_sudan:taban_lo_liyong")?.birthDate).toBe("1939");
    expect(writerByKey("kosovo:ali_podrimja")?.birthDate).toBe("1942-08-28");
    expect(writerByKey("kyrgyzstan:tugolbai_sydykbekov")?.birthDate).toBe(
      "1912-05-14"
    );
    expect(writerByKey("latvia:andrejs_upits")?.birthDate).toBe("1877-12-04");
    expect(writerByKey("latvia:rainis")?.birthDate).toBe("1865-09-11");
    expect(writerByKey("lithuania:vincas_kreve")?.deathDate).toBe("1954-07-07");
    expect(writerByKey("mongolia:dashdorj_natsagdorj")?.deathDate).toBe(
      "1937-07-13"
    );
    expect(writerByKey("senegal:birago_diop")?.birthDate).toBe("1906-12-11");
    expect(writerByKey("uzbekistan:odil_yoqubov")?.birthDate).toBe("");
    expect(writerByKey("uzbekistan:odil_yoqubov")?.deathDate).toBe("2009-12-21");
  });

  it("keeps Mikhail Naimy's disputed day-level dates empty after batch 37", () => {
    expect(writerByKey("lebanon:mikhail_naimy")).toMatchObject({
      birthDate: "",
      deathDate: "",
    });
  });

  it("stores Shakuri at the supported month precision without inventing a day", () => {
    const shakuri = writerByKey("tajikistan:muhammadjon_shakuri");

    expect(shakuri?.years).toBe("1925-2012");
    expect(shakuri?.birthDate).toBe("1925-02");
  });

  it("keeps Nevil Shute's displayed lifespan consistent with the corrected death date", () => {
    expect(writerByKey("australia:nevil_shute")?.years).toBe("1899-1960");
  });

  it("keeps corrected public names and lifespans consistent with the evidence", () => {
    expect(writerByKey("china:cao_xueqin")?.years).toBe(
      "ок. 1715 - ок. 1763"
    );
    expect(writerByKey("china:chi_ziqiang")).toMatchObject({
      name: "Чи Цзыцянь",
      fullName: "Chi Zijian",
      years: "1964-",
      birthPlace: "Мохэ, Хэйлунцзян, Китай",
      works: ["Правый берег Аргуни"],
    });
    expect(writerByKey("china:chiang_sheng_tao")).toMatchObject({
      name: "Чжоу Цзожэнь",
      fullName: "Zhou Zuoren",
      years: "1885-1967",
    });
    expect(writerByKey("comoros:mahmoud_said_ahmed")).toBeUndefined();
    expect(writerByKey("comoros:said_ahmed_mohamed")).toBeUndefined();
    expect(writerByKey("tanzania:said_ahmed_mohamed")).toMatchObject({
      name: "Саид Ахмед Мохамед",
      fullName: "Said Ahmed Mohamed Khamis",
      years: "1947-",
      birthPlace: "Занзибар, Танзания",
    });
    expect(writerByKey("cyprus:kyriakos_charalambous")).toMatchObject({
      name: "Кириакос Хараламбидис",
      fullName: "Kyriakos Charalambides",
      birthPlace: "Ахна, Кипр",
    });
    expect(writerByKey("cyprus:pantelis_michanikos")).toMatchObject({
      years: "1926-1979",
      birthPlace: "Лимния, Фамагуста, Кипр",
    });
    expect(writerByKey("cyprus:tefkros_anthias")?.birthPlace).toBe(
      "Контеа, Кипр"
    );
    expect(
      writerByKey("democratic_republic_of_congo:fiston_mwanza_mujila")
        ?.awards
    ).toEqual(["Международная литературная премия HKW 2017 года"]);
    expect(writerByKey("democratic_republic_of_congo:v_y_mudimbe")).toMatchObject({
      name: "Валантен-Ив Мудимбе",
      years: "1941-2025",
    });
    expect(writerByKey("djibouti:abdourahman_waberi")?.name).toBe(
      "Абдурахман Али Вабери"
    );
    expect(writerByKey("australia:markus_zusak")?.name).toBe("Маркус Зусак");
    expect(writerByKey("belize:glen_godfrey")).toMatchObject({
      name: "Гленн Д. Годфри",
      fullName: "Glenn D. Godfrey",
      years: "",
      birthDate: "",
    });
    expect(writerByKey("bolivia:vilma_tapia_anda")).toMatchObject({
      name: "Вильма Тапиа Анайя",
      fullName: "Vilma Tapia Anaya",
      years: "1960-",
    });
    expect(writerByKey("burkina_faso:frederic_titinga_pacere")?.years).toBe(
      "1943-2024"
    );
    expect(writerByKey("burkina_faso:patrick_ilboudo")).toMatchObject({
      name: "Патрик Гомдаого Ильбудо",
      fullName: "Patrick Gomdaogo Ilboudo",
      years: "1951-1994",
    });
    expect(writerByKey("chad:ahmat_taboye")).toMatchObject({
      name: "Ахмад Табойе",
      fullName: "Ahmad Taboye",
    });
    expect(writerByKey("cape_verde:virgilio_de_lemos")).toBeUndefined();
    expect(writerByKey("mozambique:virgilio_de_lemos")).toMatchObject({
      years: "1929-2013",
      nationality: "мозамбикец",
    });
    expect(writerByKey("azerbaijan:muhammad_fuzuli")?.years).toBe("1494-1556");
    expect(writerByKey("bahrain:ali_abdullah_khalifa")?.years).toBe(
      "1944-2026"
    );
    expect(writerByKey("egypt:sonallah_ibrahim")?.years).toBe("1937-2025");
    expect(writerByKey("democratic_republic_of_congo:sylvain_bemba")).toBeUndefined();
    expect(writerByKey("democratic_republic_of_congo:tshibumba_kanda_matulu")).toBeUndefined();
    expect(writerByKey("djibouti:abdourahman_h_yama")).toBeUndefined();
    expect(writerByKey("republic_of_congo:sylvain_bemba")).toMatchObject({
      birthPlace: "Сибити, Республика Конго",
      works: [
        "Le Soleil est parti à M’Pemba",
        "L’Homme qui tua le crocodile",
        "Léopolis",
      ],
    });
    expect(writerByKey("egypt:hamdi_abu_golayyel")?.birthDate).toBe("");
    expect(writerByKey("egypt:ibrahim_aslan")?.birthDate).toBe("");
    expect(writerByKey("england:oliver_goldsmith")?.years).toBe(
      "1728/1730-1774"
    );
    expect(writerByKey("eritrea:sebhat_gebregziabher")).toBeUndefined();
    expect(writerByKey("fiji:satendra_nandan")).toMatchObject({
      years: "",
      birthDate: "",
      works: ["Gandhianjali", "Life Journeys: Love & Grief"],
    });
    expect(writerByKey("fiji:subramani")).toMatchObject({
      fullName: "Subramani",
      years: "",
      birthDate: "",
      works: ["The Fantasy Eaters", "Dauka Puran"],
    });
    expect(writerByKey("eritrea:alemseged_tesfai")).toMatchObject({
      name: "Алемсегед Тесфай",
      years: "1944-",
      works: ["The Other War", "An African People’s Quest for Freedom and Justice"],
    });
    expect(writerByKey("estonia:friedrich_robert_faehlmann")?.birthDate).toBe(
      "1798-12-31"
    );
    expect(writerByKey("ethiopia:bealu_girma")?.years).toBe("1939-1984");
    const bremer = writerByKey("finland:fredrika_bremer");
    expect(bremer).toMatchObject({
      fullName: "Fredrika Bremer",
      years: "1801-1865",
      birthDate: "1801-08-17",
      deathDate: "1865-12-31",
      birthPlace: "Туорла, Финляндия",
      works: ["Соседи", "Герта"],
      nationality: "шведка",
    });
    expect(bremer?.bio).toBe(
      "Фредрика Бремер (1801-1865) - шведская писательница, основоположница феминистского движения в Швеции. В романах «Соседи» и «Герта» она обращалась к теме женского равноправия."
    );
    expect(
      bremer?.biographyTranslations?.ru?.sources.map((source) => source.url)
    ).toContain("https://old.bigenc.ru/world_history/text/1883169");
    expect(JSON.stringify(bremer)).not.toContain("Герцогиня Финляндская");
    expect(writerByKey("france:chretien_de_troyes")).toMatchObject({
      years: "вторая половина XII века",
      birthDate: "",
      deathDate: "",
      birthPlace: "",
      deathPlace: "",
    });
    expect(writerByKey("france:francois_rabelais")).toMatchObject({
      years: "1483/1494-1553",
      birthDate: "",
      birthPlace: "окрестности Шинона, Франция (предположительно)",
    });
    for (const heldKey of [
      "eritrea:hadish_haile",
      "eritrea:khaled_abdalla",
      "eritrea:rebkah_haile",
      "eswatini:albert_ncube",
      "eswatini:gladys_lobola",
      "eswatini:sarah_mlotshwa",
      "eswatini:stanley_madwe",
      "ethiopia:hirut_kefele",
    ]) {
      expect(writerByKey(heldKey)).toBeUndefined();
    }
  });

  it("corrects Helon Habila's malformed birthplace without inventing date precision", () => {
    const habila = writerByKey("nigeria:helon_habila");

    expect(habila?.birthDate).toBe("1967-11");
    expect(habila?.birthPlace).toBe("Калтунго, Нигерия");
  });

  it("uses the corrected QIDs and quarantines portraits generated from wrong identities", () => {
    expect(curatedWriterQids.writers["australia:les_murray"].wikidataId).toBe(
      "Q259841"
    );
    expect(curatedWriterQids.writers["england:t_s_eliot"].wikidataId).toBe(
      "Q37767"
    );

    const lesMurray = writerByKey("australia:les_murray");
    const tsEliot = writerByKey("england:t_s_eliot");
    expect(lesMurray?.portrait || "").not.toContain("q6529770");
    expect(lesMurray?.portraitSourceUrl || "").not.toContain(
      "Harmony_Day_Pollies"
    );
    expect(tsEliot?.portrait || "").not.toContain("q3261882");
    expect(tsEliot?.portraitSourceUrl || "").not.toContain("Louis_Favre");
  });
});
