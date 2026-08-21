import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch45 = {
  countryId: string;
  writerId: string;
  patch: Partial<WriterProfile>;
  evidence: Array<{ provider: string; url: string; checkedAt: string }>;
  note: string;
};

const checkedAt = "2026-08-21";

function sources(
  ...items: ReadonlyArray<readonly [provider: string, url: string]>
) {
  return items.map(([provider, url]) => ({ provider, url, checkedAt }));
}

function correction(
  countryId: string,
  writerId: string,
  patch: Partial<WriterProfile>,
  evidence: ReturnType<typeof sources>,
  note: string
): WriterPublicProfileFactCorrectionBatch45 {
  return { countryId, writerId, patch, evidence, note };
}

export const writerBiographyPublicProfileFactCorrectionsBatch45 = [
  correction(
    "portugal",
    "alexandre_herculano",
    {
      works: ["Eurico, o Presbítero", "O Monge de Cister", "História de Portugal"],
      genres: ["исторический роман", "история", "поэзия", "журналистика"],
    },
    sources(
      ["Camões, I.P.", "https://cvc.instituto-camoes.pt/conhecer/bases-tematicas/figuras-da-cultura-portuguesa/1279-alexandre-herculano.html"],
      ["Hemeroteca Municipal de Lisboa", "https://hemerotecadigital.cm-lisboa.pt/recursosinformativos/biografias/Textos/AHerculano.pdf"]
    ),
    "Переводные и родовые заголовки заменены тремя оригинальными названиями; добавлена документированная журналистика."
  ),
  correction(
    "portugal",
    "almeida_garrett",
    {
      fullName: "João Baptista da Silva Leitão de Almeida Garrett",
      works: ["Viagens na Minha Terra", "Frei Luís de Sousa"],
      genres: ["поэзия", "проза", "драматургия", "романтизм"],
    },
    sources(
      ["Camões, I.P.", "https://www.instituto-camoes.pt/activity/centro-virtual/bases-tematicas/figuras-da-cultura-portuguesa/almeida-garrett"],
      ["Assembleia da República", "https://livraria.parlamento.pt/products/almeida-garrett"]
    ),
    "Добавлены полное имя и проза; переведённые названия заменены двумя каноническими оригиналами."
  ),
  correction(
    "portugal",
    "antonio_lobo_antunes",
    {
      years: "1942–2026",
      deathDate: "2026-03-05",
      works: ["Memória de Elefante", "Os Cus de Judas", "Manual dos Inquisidores"],
      genres: ["роман", "психологическая проза"],
      awards: ["Премия Камоэнса, 2007", "Премия Хосе Доносо, 2003"],
    },
    sources(
      ["Camões, I.P.", "https://www.instituto-camoes.pt/sobre/comunicacao/noticias/antonio-lobo-antunes-1942-2026"],
      ["Universidade de Lisboa", "https://www.ulisboa.pt/noticia/falecimento-do-doutor-honoris-antonio-lobo-antunes"]
    ),
    "Годы и дата смерти актуализированы; ошибочные переводы заменены оригинальными романами, премии нормализованы."
  ),
  correction(
    "portugal",
    "branquinho_da_fonseca",
    {
      fullName: "António José Branquinho da Fonseca",
      birthPlace: "Мортагуа, Португалия",
      deathDate: "1974-05-16",
      deathPlace: "Малвейра-да-Серра, Португалия",
      works: ["O Barão", "Zonas", "Caminhos Magnéticos", "Mar Santo"],
      genres: ["проза", "поэзия", "драматургия"],
    },
    sources(
      ["Camões, I.P.", "https://cvc.instituto-camoes.pt/teatro-em-portugal-pessoas/branquinho-da-fonseca-dp9.html"],
      ["Câmara Municipal de Mortágua", "https://www.cm-mortagua.pt/cmmortagua/uploads/document/file/1371/ata03_2019.pdf"]
    ),
    "Исправлены место рождения, дата и место смерти; список произведений и жанров заменён документированным."
  ),
  correction(
    "portugal",
    "eca_de_queiros",
    {
      fullName: "José Maria Eça de Queirós",
      works: ["O Crime do Padre Amaro", "O Primo Basílio", "Os Maias"],
      genres: ["роман", "реализм", "сатира", "журналистика"],
    },
    sources(
      ["Fundação Eça de Queiroz", "https://feq.pt/eca-de-queiroz/vida-e-obra/"],
      ["Camões, I.P.", "https://cvc.instituto-camoes.pt/autores-e-antologia/eca-de-queiros-34063-dp19.html"]
    ),
    "Полное имя раскрыто; переводные заголовки заменены тремя оригинальными романами, добавлена журналистика."
  ),
  correction(
    "portugal",
    "fernando_pessoa",
    {
      works: ["Mensagem", "Livro do Desassossego", "Poemas de Alberto Caeiro"],
      genres: ["поэзия", "проза", "эссе", "модернизм"],
    },
    sources(
      ["Casa Fernando Pessoa", "https://www.casafernandopessoa.pt/pt/fernando-pessoa/obra/fernando-pessoa"],
      ["Camões, I.P.", "https://cvc.instituto-camoes.pt/seculo-xx/fernando-pessoa-70179.html"]
    ),
    "Вольные русские формулы заменены оригинальными названиями; жанры нормализованы."
  ),
  correction(
    "portugal",
    "gil_vicente",
    {
      years: "ок. 1465 — ок. 1536",
      deathDate: "ок. 1536",
      works: ["Auto da Índia", "Autos das Barcas", "Farsa de Inês Pereira"],
      genres: ["драматургия", "поэзия", "фарс", "религиозная пьеса"],
    },
    sources(
      ["Camões, I.P.", "https://cvc.instituto-camoes.pt/autores-e-antologia/gil-vicente-6254-dp12.html"],
      ["Biblioteca Nacional de Portugal", "https://bibliografia.bnportugal.gov.pt/bnp/bnp.exe/q?mfn=305287&qf_AU=%3DVICENTE%2C+GIL%2C+CA.+1465-CA.+1536"]
    ),
    "Смерть отмечена как приблизительная; произведения приведены в каноническом оригинальном написании."
  ),
  correction(
    "portugal",
    "goncalo_m_tavares",
    {
      birthDate: "1970",
      works: ["Jerusalém", "Uma Viagem à Índia"],
      genres: ["роман", "поэзия", "экспериментальная литература"],
      awards: ["Премия Жозе Сарамаго, 2005", "Премия Форментор, 2026"],
    },
    sources(
      ["Universidade de Lisboa", "https://www.ulisboa.pt/noticia/goncalo-m-tavares-distinguido-com-o-premio-formentor-das-letras-2026"],
      ["Camões, I.P.", "https://www.instituto-camoes.pt/sobre/comunicacao/noticias/goncalo-m-tavares-em-toronto"]
    ),
    "Неподтверждённый точный день рождения снят; добавлены оригинальные произведения и Премия Форментор 2026 года."
  ),
  correction(
    "portugal",
    "helia_correa",
    {
      birthDate: "1949",
      works: ["Lillias Fraser", "Adoecer", "A Terceira Miséria"],
      genres: ["роман", "поэзия", "драматургия", "перевод"],
      awards: ["Премия Камоэнса, 2015"],
    },
    sources(
      ["Camões, I.P.", "https://www.instituto-camoes.pt/sobre/comunicacao/noticias/helia-correia-vence-premio-camoes-2015"],
      ["Direção-Geral do Livro, dos Arquivos e das Bibliotecas", "https://livro.dglab.gov.pt/sites/DGLB/Portugues/divulgacaoEstrangeiro/apoioDivulgacaoAutores/Documents/GramBemQuerer_PT_ES.pdf"]
    ),
    "Точный день рождения снят; произведения, переводческая работа и премия уточнены."
  ),
  correction(
    "portugal",
    "herberto_helder",
    {
      fullName: "Herberto Helder Luís Bernardes de Oliveira",
      deathPlace: "Кашкайш, Португалия",
      works: ["O Amor em Visita", "Electronicolírica", "Photomaton & Vox", "Os Passos em Volta"],
      genres: ["поэзия", "проза", "перевод"],
    },
    sources(
      ["Direção-Geral do Livro, dos Arquivos e das Bibliotecas", "https://livro.dglab.gov.pt/sites/DGLB/Portugues/autores/Paginas/PesquisaAutores1.aspx?AutorId=8056"],
      ["Camões, I.P.", "https://cvc.instituto-camoes.pt/autores-e-antologia/herberto-helder-dp17.html"]
    ),
    "Место смерти исправлено, полное имя раскрыто; ненадёжные переводы заменены оригинальными названиями."
  ),
  correction(
    "portugal",
    "jose_luis_peixoto",
    {
      birthDate: "1974",
      works: ["Nenhum Olhar", "Cemitério de Pianos", "Dentro do Segredo"],
      genres: ["роман", "поэзия", "драматургия"],
      awards: ["Премия Жозе Сарамаго, 2001", "Премия Вержилиу Феррейры, 2026"],
    },
    sources(
      ["Camões, I.P.", "https://cvc.instituto-camoes.pt/poemasemana/36/dascasas4.html"],
      ["Universidade de Évora", "https://www.uevora.pt/ue-media/noticias?item=45551"]
    ),
    "Точный день рождения снят; жанры, оригинальные названия и актуальная премия 2026 года добавлены."
  ),
  correction(
    "portugal",
    "jose_rodrigues_dos_santos",
    {
      birthDate: "1964",
      works: ["Codex 632", "A Fórmula de Deus"],
      genres: ["роман", "исторический роман", "триллер"],
      nationality: "португалец",
    },
    sources(
      ["José Rodrigues dos Santos official site", "https://joserodriguesdossantos.com/o-autor/"],
      ["Camões, I.P.", "https://www.instituto-camoes.pt/images/img_noticias2024/PROGRAMA_AF_ADV_JORNAL_V3_web.pdf"]
    ),
    "Точный день рождения снят; национальность, жанры и оригинальные названия романов нормализованы."
  ),
  correction(
    "portugal",
    "jose_saramago",
    {
      works: ["Memorial do Convento", "O Evangelho segundo Jesus Cristo", "Ensaio sobre a Cegueira"],
      genres: ["роман", "драматургия", "эссе"],
      awards: ["Премия Камоэнса, 1995", "Нобелевская премия по литературе, 1998"],
    },
    sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1998/press-release/"],
      ["Fundação José Saramago", "https://www.josesaramago.org/biografia/"]
    ),
    "Произведения приведены в оригинальном написании; добавлены жанры и Премия Камоэнса."
  ),
  correction(
    "portugal",
    "lidia_jorge",
    {
      birthDate: "1946",
      birthPlace: "Боликейме, Алгарви, Португалия",
      works: ["O Dia dos Prodígios", "A Costa dos Murmúrios"],
      genres: ["роман", "историческая проза"],
      awards: ["Премия Камоэнса, 2026"],
    },
    sources(
      ["Camões, I.P.", "https://www.instituto-camoes.pt/sobre/comunicacao/noticias/lidia-jorge-distinguida-com-o-premio-camoes-2026"],
      ["Universidade de Lisboa", "https://www.letras.ulisboa.pt/pt/noticias/candidaturas-e-premios/3101-lidia-jorge-recebe-o-premio-camoes-2026"]
    ),
    "Место рождения уточнено, точный день снят; ошибочный 2023 год премии исправлен на 2026."
  ),
  correction(
    "portugal",
    "luis_de_camoes",
    {
      fullName: "Luís Vaz de Camões",
      years: "ок. 1524/1525–1580",
      birthDate: "",
      birthPlace: "",
      works: ["Os Lusíadas", "Rimas"],
      genres: ["эпическая поэзия", "лирика", "сонет"],
    },
    sources(
      ["Assembleia da República", "https://www.parlamento.pt/VisitaParlamento/Paginas/BiogLuisdeCamoes.aspx"],
      ["Camões, I.P.", "https://cvc.instituto-camoes.pt/camoes-dp2.html"]
    ),
    "Из-за расхождения 1524/1525 и спорного места рождения точные поля очищены; полное имя и оригинальные книги добавлены."
  ),
  correction(
    "portugal",
    "manuel_de_aranha",
    {
      name: "Мануэл де Арриага",
      fullName: "Manuel José de Arriaga Brum da Silveira",
      works: ["Cantos Sagrados", "Irradiações", "Na Primeira Presidência da República Portuguesa"],
      genres: ["поэзия", "мемуары", "политическая публицистика"],
    },
    sources(
      ["Presidência da República Portuguesa", "https://www.presidencia.pt/presidente-da-republica/a-presidencia/antigos-presidentes/manuel-de-arriaga/"],
      ["Assembleia da República", "https://app.parlamento.pt/COMUNICAR/Artigo.aspx?ID=592"]
    ),
    "Публичные имя, полное имя и книги исправлены; унаследованный id manuel_de_aranha намеренно сохранён без молчаливого переименования."
  ),
  correction(
    "portugal",
    "mario_de_sa_carneiro",
    {
      works: ["Dispersão", "A Confissão de Lúcio", "Indícios de Oiro"],
      genres: ["поэзия", "проза", "модернизм"],
    },
    sources(
      ["Camões, I.P.", "https://cvc.instituto-camoes.pt/contomes/03/escreveu.html"],
      ["Biblioteca Nacional de Portugal", "https://www.bnportugal.gov.pt/index.php?Itemid=259&catid=49%3Aaquisicoes&id=229%3Aindiciosdeouromariosacarneiro&lang=pt&option=com_content&view=article"]
    ),
    "Родовое «Стихи» и переводы заменены тремя документированными оригинальными названиями."
  ),
  correction(
    "portugal",
    "miguel_torga",
    {
      fullName: "Adolfo Correia da Rocha",
      birthPlace: "Сан-Мартинью-ди-Анта, Саброза, Португалия",
      works: ["Bichos", "Novos Contos da Montanha", "Diário"],
      genres: ["поэзия", "рассказ", "дневник"],
      awards: ["Премия Камоэнса, 1989"],
    },
    sources(
      ["Camões, I.P.", "https://cvc.instituto-camoes.pt/seculo-xx/miguel-torga-3700-dp21.html"],
      ["Espaço Miguel Torga", "https://www.espacomigueltorga.pt/p70-miguel-torga-vida-e-obra-pt"]
    ),
    "Настоящее имя и место рождения уточнены; ошибочный перевод заменён на Bichos, дневниковый жанр добавлен."
  ),
  correction(
    "portugal",
    "sofia_de_mello_breyner",
    {
      works: ["Dia do Mar", "Livro Sexto", "O Nome das Coisas", "A Menina do Mar"],
      genres: ["поэзия", "проза", "детская литература", "эссе", "перевод"],
      awards: ["Премия Камоэнса, 1999"],
    },
    sources(
      ["Camões, I.P.", "https://cvc.instituto-camoes.pt/seculo-xx/sophia-de-mello-breyner-andresen-53148-dp20.html"],
      ["Biblioteca Nacional de Portugal", "https://acpc.bnportugal.gov.pt/espolios_autores/e64_andresen_sofia_melo_breyner.html"]
    ),
    "Переводные родовые названия заменены четырьмя оригинальными книгами; жанры и премия уточнены."
  ),
  correction(
    "portugal",
    "vergilio_ferreira",
    {
      birthPlace: "Мелу, Говейя, Португалия",
      works: ["Aparição", "Manhã Submersa", "Signo sinal"],
      genres: ["роман", "экзистенциальная проза"],
      awards: ["Премия Камоэнса, 1992"],
    },
    sources(
      ["Direção-Geral do Livro, dos Arquivos e das Bibliotecas", "https://adevr.dglab.gov.pt/2016/01/28/comemoracao-do-centenario-do-nascimento-do-professor-e-escritor-vergilio-ferreira/"],
      ["Camões, I.P.", "https://cvc.instituto-camoes.pt/a-galinha/quem-escreveu-23555-dp11.html"]
    ),
    "Место рождения исправлено; неподтверждённое название заменено тремя романами, премия нормализована."
  ),
  correction(
    "portugal",
    "walter_hugo_mae",
    {
      name: "Валтер Угу Маэ",
      fullName: "",
      birthDate: "1971",
      works: ["o remorso de baltazar serapião", "a máquina de fazer espanhóis", "o filho de mil homens", "o apocalipse dos trabalhadores"],
      genres: ["роман", "поэзия"],
      awards: ["Литературная премия Жозе Сарамаго, 2007"],
    },
    sources(
      ["Direção-Geral do Livro, dos Arquivos e das Bibliotecas", "https://livro.dglab.gov.pt/sites/DGLB/English/BookDepartment/PromotionAbroad/PromotionalMaterials/Documents/SightsfromtheSouth_6.pdf"],
      ["Prémio Literário José Saramago", "https://www.premiojosesaramago.pt/vencedores/2007/valter-hugo-mae"]
    ),
    "Компрометированный домен исключён; неподтверждённые точный день и имя при рождении сняты, имя, книги и премия уточнены."
  ),
  correction(
    "puerto_rico",
    "esmeralda_santiago",
    {
      birthDate: "1948",
      works: ["When I Was Puerto Rican", "Almost a Woman", "América’s Dream", "Conquistadora"],
      genres: ["мемуары", "роман"],
    },
    sources(
      ["Harvard Gazette", "https://news.harvard.edu/gazette/story/2013/04/an-author-finds-her-voice/"],
      ["Library of Congress", "https://www.loc.gov/item/n93064183/esmeralda-santiago/"]
    ),
    "Неподтверждённый точный день рождения снят; книги приведены в оригинале, América’s Dream правильно классифицирован как роман."
  ),
  correction(
    "puerto_rico",
    "jose_luis_gonzalez",
    {
      birthPlace: "Санто-Доминго, Доминиканская Республика",
      works: ["El hombre en la calle", "Balada de otro tiempo", "La llegada", "El país de cuatro pisos"],
      genres: ["рассказ", "роман", "эссе", "перевод"],
    },
    sources(
      ["Enciclopedia de Puerto Rico", "https://enciclopediapr.org/content/jose-luis-gonzalez/"],
      ["Universidad de Puerto Rico", "https://sacayey.upr.edu/pluginfile.php/339/mod_glossary/attachment/2045/Certificaci%C3%B3n%20%23048%20%281997-98%29%20SA.pdf"]
    ),
    "Место рождения исправлено; заголовок El hombre en la calle, три дополнительные книги и переводческая работа уточнены."
  ),
  correction(
    "puerto_rico",
    "julia_de_burgos",
    {
      works: ["Poema en veinte surcos", "Canción de la verdad sencilla", "Río Grande de Loíza"],
      genres: ["поэзия", "эссе"],
    },
    sources(
      ["Academy of American Poets", "https://poets.org/poet/julia-de-burgos"],
      ["Enciclopedia de Puerto Rico", "https://enciclopediapr.org/content/julia-de-burgos/"]
    ),
    "Канонические оригиналы заменили вольные переводы; два сборника отделены от отдельного стихотворения."
  ),
  correction(
    "puerto_rico",
    "manuel_ramos_otero",
    {
      birthDate: "1948-07-20",
      works: ["La novelabingo", "Página en blanco y staccato", "Invitación al polvo"],
      genres: ["роман", "рассказ", "поэзия", "квир-литература"],
    },
    sources(
      ["Enciclopedia de Puerto Rico", "https://enciclopediapr.org/content/manuel-ramos-otero/"],
      ["Columbia University Libraries", "https://library.columbia.edu/about/news/libraries/2014/2014-3-12_RBML_Acquires_Ramos_Otero_Archive.html"]
    ),
    "Дата рождения исправлена с 22 на 20 июля; произведения и квир-литературный контекст добавлены."
  ),
  correction(
    "puerto_rico",
    "rene_marques",
    {
      works: ["La carreta", "Los soles truncos", "La víspera del hombre", "La mirada"],
      genres: ["драматургия", "роман", "эссе"],
    },
    sources(
      ["Enciclopedia de Puerto Rico", "https://enciclopediapr.org/content/rene-marques/"],
      ["Universidad de Puerto Rico", "https://www.upr.edu/ac/catedratica-del-rum-de-la-upr-prologa-obra-inedita-de-rene-marques/"]
    ),
    "Список произведений дополнен романом La mirada, жанровые названия нормализованы."
  ),
  correction(
    "qatar",
    "abdulaziz_al_mahmoud",
    {
      name: "Абдулазиз Аль-Махмуд",
      fullName: "Abdulaziz Al-Mahmoud",
      years: "1961–",
      birthDate: "1961",
      birthPlace: "Доха, Катар",
      works: ["Al Qursan (The Corsair)", "The Holy Sail"],
      genres: ["исторический роман", "журналистика"],
    },
    sources(
      ["Katara Publishing House", "https://kataranovels.com/novelist/%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D8%B9%D8%B2%D9%8A%D8%B2-%D8%A2%D9%84-%D9%85%D8%AD%D9%85%D9%88%D8%AF/"],
      ["Qatar National Library", "https://www.qnl.qa/en/node/8380"]
    ),
    "Год рождения исправлен с 1965 на 1961, Доха и журналистика добавлены, список романов расширен."
  ),
  correction(
    "qatar",
    "kulthum_jaber",
    {
      name: "Кульсум Джабр аль-Кувари",
      fullName: "Kulthum Jabr al-Kuwari",
      years: "ок. 1958–",
      birthDate: "ок. 1958",
      works: ["Anyā wa-ghābāt al-ṣamt wa-l-taraddud", "Фаридж бин Дирхам"],
      genres: ["рассказ", "роман", "поэзия"],
    },
    sources(
      ["Qatar National Library", "https://qnl.qa/ar/about/news/hdwr-kthyf-lljmhwr-fy-alywm-alakhyr-lmhrjan-jaybwr-aladby-aldwht-balmktbt-alwtnyt"],
      ["Università degli Studi di Torino", "https://iris.unito.it/retrieve/43ec8c7d-6baa-4e78-8a11-27550f2c7a5b/2023.%20Kervan%2C%20I%20racconti%20brevi%20di%20Dalal%20Khalifa.pdf"]
    ),
    "Полное имя, приблизительный год, жанры и две конкретные книги заменили общие заглушки."
  ),
  correction(
    "republic_of_congo",
    "alain_mabanckou",
    {
      works: ["Verre cassé", "Black Bazar", "Mémoires de porc-épic"],
      genres: ["роман", "поэзия", "эссе"],
      awards: ["Премия Ренодо за Mémoires de porc-épic, 2006"],
    },
    sources(
      ["Collège de France", "https://www.college-de-france.fr/fr/chaire/alain-mabanckou-creation-artistique-chaire-annuelle/biography"],
      ["Académie française", "https://www.academie-francaise.fr/alain-mabanckou"]
    ),
    "Ошибочное название заменено тремя оригинальными романами; жанры расширены, премия связана с точной книгой."
  ),
  correction(
    "republic_of_congo",
    "daniel_biyaoula",
    {
      birthPlace: "Браззавиль, Республика Конго",
      works: ["L’Impasse", "Agonies", "La Source de joies"],
      awards: ["Grand Prix littéraire d’Afrique noire за L’Impasse, 1997"],
    },
    sources(
      ["Library and Archives Canada", "https://central.bac-lac.gc.ca/.item?app=Library&id=TC-QMUQ-4622&oclc_number=793510627&op=pdf"],
      ["Africultures", "https://africultures.com/limpasse-362/"]
    ),
    "Браззавиль добавлен; неподтверждённая «Мать» заменена тремя романами и точной премией."
  ),
  correction(
    "republic_of_congo",
    "emmanuel_dongala",
    {
      birthPlace: "Центральноафриканская Республика",
      works: ["Le Feu des origines", "Johnny chien méchant", "Photo de groupe au bord du fleuve"],
      genres: ["роман", "проза"],
      awards: ["Grand Prix Hervé Deluen, 2023"],
    },
    sources(
      ["Académie française", "https://www.academie-francaise.fr/discours-sur-les-prix-litteraires-2023"],
      ["Bard College", "https://www.bard.edu/news/releases/pr/fstory.php?id=9599"]
    ),
    "Место рождения исправлено; оригинальные книги и премия заменили неточные переводы."
  ),
  correction(
    "republic_of_congo",
    "guy_menga",
    {
      fullName: "Gaston-Guy Bikouta-Menga",
      birthPlace: "Манкононго, Республика Конго",
      works: ["La Marmite de Koka-Mbala", "L’Oracle", "La Palabre stérile"],
      genres: ["драматургия", "роман", "журналистика"],
      awards: ["Grand Prix littéraire d’Afrique noire за La Palabre stérile, 1969"],
    },
    sources(
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark:/12148/cb11915578k"],
      ["Les Francophonies", "https://www.lesfrancophonies.fr/MENGA-Guy"]
    ),
    "Полное имя и место рождения добавлены; чужое произведение удалено, две пьесы, роман и премия атрибутированы точно."
  ),
  correction(
    "republic_of_congo",
    "henri_lopes",
    {
      works: ["Le Pleurer-rire", "Le Chercheur d’Afriques", "Sur l’autre rive"],
      genres: ["роман", "проза"],
      awards: ["Grand Prix de la Francophonie, 1993"],
    },
    sources(
      ["Académie française", "https://www.academie-francaise.fr/henri-lopes"],
      ["Organisation internationale de la Francophonie", "https://www.francophonie.org/sites/default/files/2023-11/CMF44_releve-decisions.pdf"]
    ),
    "Неподтверждённый заголовок удалён; три оригинальные книги и премия добавлены."
  ),
  correction(
    "republic_of_congo",
    "jean_baptiste_tati_loutard",
    {
      deathDate: "2009-07-04",
      deathPlace: "Париж, Франция",
      works: ["Les Normes du temps", "Le Récit de la mort", "Chroniques congolaises"],
      genres: ["поэзия", "проза"],
      awards: ["Медаль Prix du Rayonnement de la langue et de la littérature françaises, 1992"],
    },
    sources(
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark:/12148/cb119260748"],
      ["Académie française", "https://www.academie-francaise.fr/jean-baptiste-tati-loutard"]
    ),
    "Дата смерти исправлена с 12 на 4 июля, Париж добавлен; книги и медаль уточнены."
  ),
  correction(
    "republic_of_congo",
    "jean_malonga",
    {
      deathDate: "1985",
      works: ["Cœur d’Aryenne", "La Légende de M’Pfoumou Ma Mazono"],
      genres: ["роман", "проза"],
    },
    sources(
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark:/12148/cb12175704k"],
      ["Sénat français", "https://www.senat.fr/senateur-4eme-republique/malonga_jean0127r4.html"]
    ),
    "Точный день смерти не публикуется из-за расхождения источников; неверный перевод заменён двумя оригинальными произведениями."
  ),
  correction(
    "republic_of_congo",
    "sony_labou_tansi",
    {
      birthDate: "1947-06-05",
      birthPlace: "Киншаса, Демократическая Республика Конго",
      deathPlace: "Браззавиль, Республика Конго",
      works: ["La Vie et demie", "L’Anté-peuple", "La Parenthèse de sang", "Je soussigné cardiaque"],
      genres: ["роман", "драматургия", "поэзия"],
    },
    sources(
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark:/12148/cb11910402v"],
      ["Les Francophonies", "https://www.lesfrancophonies.fr/SONY-LABOU-TANSI"]
    ),
    "Дата рождения исправлена с 5 июля на 5 июня, места рождения и смерти уточнены; список произведений расширен."
  ),
  correction(
    "republic_of_congo",
    "sylvain_bemba",
    {
      birthDate: "1934-02-17",
      deathDate: "1995-07-08",
      deathPlace: "Париж, Франция",
      works: ["Le Soleil est parti à M’Pemba", "L’Homme qui tua le crocodile", "Léopolis"],
      genres: ["роман", "драматургия"],
    },
    sources(
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark:/12148/cb11891126r"],
      ["Les Francophonies", "https://www.lesfrancophonies.fr/BEMBA-Sylvain"]
    ),
    "Точные даты и место смерти добавлены; публичный список расширен третьим произведением."
  ),
] satisfies readonly WriterPublicProfileFactCorrectionBatch45[];
