// Agent/source-reviewed additive proposal. This script never writes canonical news or publishes.
// Build with --evidence-input=.tmp/current-news-batch-20261001/details.json;
// subsequent --check runs use the self-contained evidence report and require no network.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {load} from 'cheerio';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {mergeReviewedBatch} from './apply-literary-news-batch.mjs';
import {canonicalUrl,selectReviewed,validDate,validTimestamp} from './lib/literary-news-reviewed.mjs';
import {LITERARY_NEWS_SOURCES} from './lib/literary-news-sources.mjs';
import {normalizeShortHyphens} from './lib/short-hyphens.mjs';

const batchId='current-news-reviewed-20261002';
const reportFile=new URL(`../reports/r10/publication/${batchId}.json`,import.meta.url);
const receiptFile=new URL(`../reports/r10/publication/${batchId}-review-preview.json`,import.meta.url);
const hash=(value)=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
// Evidence is plain text, never an HTML fragment for rendering. Parse any
// retained markup structurally so malformed tags cannot survive a regex pass.
export function articleEvidenceText(source){
  if(typeof source!=='string')throw new Error('article_evidence_text_required');
  const document=load(source);
  document('script,style,noscript,template,svg,form').remove();
  return document.root().text();
}
const row=(index,id,category,region,publishedDate,titleRu,titleEn,summaryRu,summaryEn,facts,proofQuotes,options={})=>({
  index,id,category,region,publishedDate,title:{ru:titleRu,en:titleEn},summary:{ru:summaryRu,en:summaryEn},facts,proofQuotes,...options,
});

export const REVIEWED_ROWS=[
  row(0,'harari-laws-of-history-global-announcement-20261001','releases','global','2026-10-01',
    'Penguin Random House анонсировало The Laws of History Юваля Ноя Харари',
    'Penguin Random House announces Yuval Noah Harari’s The Laws of History',
    'Penguin Random House объявило, что The Laws of History Юваля Ноя Харари выйдет 21 сентября 2027 года. В США Random House выпустит печатную и электронную версии, одновременно появится аудиокнига. Издатель также назвал Великобританию, Канаду, Испанию, Бразилию и Португалию среди территорий выпуска; анонс сделан 30 сентября.',
    'Penguin Random House has announced a September 21, 2027 global publication date for Yuval Noah Harari’s The Laws of History. Random House will publish the US hardcover and ebook, with a simultaneous audiobook. The publisher also names the UK, Canada, Spain, Brazil and Portugal among its territories; the announcement was made on September 30.',
    ['The publisher’s October 1 article explicitly dates the announcement September 30, 2026.',
     'Global publication is planned for September 21, 2027; US hardcover, ebook and simultaneous audio are announced.',
     'The publisher names the UK, Canada, Spain, Brazil and Portugal as additional territories.'],
    ['September 21, 2027','it was announced on September 30, 2026','An audiobook edition will be released simultaneously'],
    {eventDate:'2026-09-30',eventDateBasis:'Explicit announcement date in the publisher’s article; future publication remains future tense.',
     countryCodes:['US','GB','CA','ES','BR','PT'],temporal:'announced-future-release'}),
  row(1,'liechtenstein-library-long-night-programme-20260930','festivals','europe','2026-09-30',
    'Библиотека Лихтенштейна представила литературную программу на 3 октября',
    'Liechtenstein’s national library announces its October 3 literary programme',
    'На Ночь музеев 3 октября Национальная библиотека Лихтенштейна запланировала поэтическую мастерскую Хелены Брем с 18:00 до 19:30 и выставку 101 поэтического плаката Зигфрида Хёлльригля. В 20:00 он представит работу с ручной печатью и типографикой. Библиотека и кафе будут открыты до полуночи.',
    'For the October 3 Long Night of Museums, Liechtenstein’s national library has scheduled Helena Brehm’s poetry workshop from 18:00 to 19:30 and Siegfried Höllrigl’s exhibition of 101 poetry posters. At 20:00 he will present his hand-printing and typography work. The library and cafeteria will stay open until midnight.',
    ['The library’s direct programme is for Saturday October 3, 2026.',
     'Helena Brehm’s poetry workshop is scheduled 18:00-19:30; Höllrigl’s exhibition and 20:00 presentation are listed.',
     'The library and cafeteria are scheduled to remain open until midnight. The contradictory past registration deadline is omitted.'],
    ['Samstag, 3. Okt 2026','Gedichte-Workshop mit Helena Brehm','18.00 bis 19.30 Uhr','bis Mitternacht'],
    {dateOnly:true,countryCodes:['LI'],temporal:'future-programme',limitation:'Feed and article metadata disagree on UTC offset; only the corroborated September 30 publication date is retained. Registration deadline is inconsistent and unused.'}),
  row(3,'serbia-stankovic-150-exhibition-opened-20260930','heritage','europe','2026-09-30',
    'В Белграде открылась выставка к 150-летию Борисава Станковича',
    'Belgrade opens an exhibition for Borisav Stanković’s 150th anniversary',
    '30 сентября Национальная библиотека Сербии открыла выставку «Трагом људске душе» о жизни и литературном наследии Борисава Станковича. Её подготовили Мирослава и Томислав Симоновичи вместе с библиотекой «Бора Станкович» из Вране. Экспозиция приурочена к 150-летию писателя и будет работать до 2 ноября 2026 года.',
    'On September 30, Serbia’s national library opened Tragom ljudske duše, an exhibition on Borisav Stanković’s life and literary legacy. Miroslava and Tomislav Simonović prepared it with the Bora Stanković public library in Vranje. The exhibition marks the writer’s 150th birth anniversary and will remain open through November 2, 2026.',
    ['The National Library of Serbia reports the exhibition opened September 30, 2026.',
     'Miroslava and Tomislav Simonović and the Bora Stanković public library in Vranje prepared the exhibition.',
     'The exhibition marks 150 years since the writer’s birth and closes November 2, 2026.'],
    ['30. септембра 2026. године','150 година','Изложба траје до 2. новембра 2026. године.'],
    {countryCodes:['RS'],temporal:'opened-exhibition'}),
  row(4,'de-bezige-bij-independence-interview-20261001','publishing','europe','2026-10-01',
    'Руководители De Bezige Bij рассказали о возвращении издательства к независимости',
    'De Bezige Bij’s directors discuss the publisher’s return to independence',
    'В новом интервью Publishing Perspectives руководители нидерландского De Bezige Bij объяснили выход из группы WPG, завершённый в августе 2026 года. Издательство сохранило марки Thomas Rap и Cargo; около 40 сотрудников участвуют в распределении прибыли. В планах - новая марка для авторов из бывших нидерландских колоний, начиная с Суринама.',
    'In a new Publishing Perspectives interview, the Dutch publisher De Bezige Bij’s directors explain its exit from WPG, completed in August 2026. The house retained the Thomas Rap and Cargo imprints, and approximately 40 employees take part in profit sharing. It also plans an imprint for voices from former Dutch colonies, beginning with Surinamese authors.',
    ['Publishing Perspectives interviewed publishing director Romy van den Nieuwenhof and rights director Marijke Nagtegaal.',
     'The article explicitly places the final exit in August, while the new interview was published October 1.',
     'Thomas Rap and Cargo remain with the publisher; approximately 40 employees participate in profit sharing. A new imprint for former-colony voices is planned, beginning with Surinamese authors.'],
    ['its final exit coming last August','Thomas Rap and Cargo','40 or so employees'],
    {countryCodes:['NL','SR'],temporal:'new-interview-about-earlier-change'}),
  row(5,'digital-publishing-awards-12-finalists-20261001','awards','global','2026-10-01',
    'В финал Digital Publishing Awards вышли 12 проектов из пяти стран',
    'Digital Publishing Awards shortlist 12 projects from five countries',
    'В опубликованный шорт-лист Digital Publishing Awards вошли проекты из Египта, Германии, Индии, Великобритании и США. По сообщению Publishing Perspectives, жюри отобрало 12 финалистов из 42 заявок. Среди участников - индийская Ailaysa и египетская Nahdet Misr; победителей объявят на Франкфуртской книжной ярмарке.',
    'The Digital Publishing Awards shortlist includes 12 projects from Egypt, Germany, India, the UK and the US. Publishing Perspectives reports that an international jury selected them from 42 submissions. They include India’s Ailaysa and Egypt’s Nahdet Misr; winners will be announced at the Frankfurt Book Fair.',
    ['The headline and full shortlist identify 12 finalists; the article states there were 42 submissions.',
     'The named finalist countries are Egypt, Germany, India, the UK and the US.',
     'Ailaysa and Nahdet Misr are listed; winners are still to be announced at Frankfurt.'],
    ['12 Finalists','Egypt, Germany, India, the U.K., and the U.S.','42 submissions'],
    {eventDate:'2026-09-30',eventDateBasis:'The October 1 article says the shortlist was announced yesterday.',countryCodes:['EG','DE','IN','GB','US'],temporal:'shortlist-not-winners'}),
  row(6,'global50-publishing-ranking-2026-report-20261001','publishing','global','2026-10-01',
    'Опубликован рейтинг Global 50: Bertelsmann возглавил список издательских групп',
    'Global 50 ranks Bertelsmann first among publishing groups',
    'Global 50 Publishing Ranking 2026 сравнивает 48 издательских групп по выручке за 2025 год. Лидером стал Bertelsmann с 5,93 млрд евро издательской выручки; совокупный показатель участников - 64,2 млрд евро. Publishing Perspectives сообщает о выходе исследования Рюдигера Вишенбарта и его партнёров; презентация намечена на 7 октября во Франкфурте.',
    'Global 50 Publishing Ranking 2026 compares 48 publishing groups by their 2025 publishing revenue. Bertelsmann ranks first with €5.93 billion, while the ranked groups together generated €64.2 billion. Publishing Perspectives reports the release of Rüdiger Wischenbart and partners’ research; a presentation is planned for October 7 in Frankfurt.',
    ['The 2026 ranking compares 48 groups using 2025 publishing revenue, not 2026 revenue.',
     'Bertelsmann leads with €5.93 billion; combined ranked publishing revenue is €64.2 billion.',
     'The report’s Frankfurt presentation is planned for October 7 at 12:00.'],
    ['In 2025, the top 48 ranked publishing companies','€64.2 billion','€5.93 billion','Wednesday, October 7'],
    {countryCodes:['DE'],temporal:'new-report-on-2025-data'}),
  row(7,'ncw-nine-emerging-translators-2026-27-20260930','publishing','europe','2026-09-30',
    'Британский National Centre for Writing выбрал девять переводчиков для наставничества',
    'National Centre for Writing selects nine translators for 2026/27 mentorships',
    'National Centre for Writing объявил участников Emerging Translator Mentorships на 2026/27 год. Девять начинающих литературных переводчиков будут шесть месяцев работать с опытными наставниками. В набор вошли переводчики с датского, нидерландского, итальянского, корейского и других языков; программа поддерживает перевод на английский недостаточно представленных литератур.',
    'The UK’s National Centre for Writing has announced its 2026/27 Emerging Translator Mentorships cohort. Nine early-career literary translators will work with experienced mentors for six months. Their languages include Danish, Dutch, Italian and Korean, among others. The programme supports literary translation into English, with a focus on underrepresented literatures.',
    ['NCW announced nine early-career literary translators for the 2026/27 programme.',
     'Each mentorship lasts six months and supports literary translation into English.',
     'The roster explicitly includes Danish, Dutch, Italian and Korean translation.'],
    ['nine early-career literary translators','six months of focused development','Danish','Dutch','Italian','Korean'],
    {countryCodes:['GB'],temporal:'new-cohort-announcement'}),
  row(8,'abuja-literature-ideas-festival-announcement-20260930','festivals','africa','2026-09-30',
    'В Абудже объявлен фестиваль литературы и идей 9-10 октября',
    'Abuja announces a Festival of Literature & Ideas for October 9-10',
    'Book Buzz Foundation проведёт Abuja Festival of Literature & Ideas 9-10 октября 2026 года в The Nordic в районе Джаби. Brittle Paper сообщает о программе с нигерийскими авторами Ричардом Али и Хадизой Исма Эль-Руфаи. Учёный Симукай Чигуду представит мемуары Chasing Freedom; фестиваль получает софинансирование Европейского союза.',
    'Book Buzz Foundation will hold the Abuja Festival of Literature & Ideas on October 9\u201310, 2026, at The Nordic in Jabi. Brittle Paper reports a programme featuring Nigerian authors Richard Ali and Hadiza Isma El-Rufai. Academic Simukai Chigudu will discuss his memoir Chasing Freedom; the festival is co-funded by the European Union.',
    ['The festival is planned for October 9\u201310, 2026 at The Nordic, Jabi, Abuja.',
     'Book Buzz Foundation organises the event with EU co-funding.',
     'Richard Ali, Hadiza Isma El-Rufai and Simukai Chigudu are in the announced programme; Chigudu will discuss Chasing Freedom.'],
    ['October 9\u201310, 2026','The Nordic','co-funded by the European Union','Chasing Freedom'],
    {countryCodes:['NG'],temporal:'future-festival'}),
  row(9,'elekere-inaugural-story-prize-shortlist-20260930','awards','africa','2026-09-30',
    'Élékéré Press объявило семь финалистов своей первой премии за рассказ',
    'Élékéré Press names seven finalists for its inaugural short-story prize',
    'Élékéré Short Story Prize отобрала семь ранее не опубликованных рассказов из более чем 200 заявок. Тема первого конкурса - наследие; среди финалистов авторы из Нигерии, США и Зимбабве. Как сообщает Brittle Paper, победителя объявят 2 ноября 2026 года: он получит 500 долларов, а рассказ опубликуют на сайте издательства.',
    'The inaugural Élékéré Short Story Prize has shortlisted seven unpublished stories from more than 200 submissions. This year’s theme is inheritance, and finalists include writers from Nigeria, the US and Zimbabwe. Brittle Paper reports that the winner will be announced on November 2, 2026, receive $500 and have the story published on the press’s website.',
    ['The inaugural prize shortlisted seven stories from more than 200 submissions.',
     'The competition concerns unpublished short fiction by Black African and diaspora writers, on inheritance.',
     'The winner will be announced November 2, receive $500 and be published on the publisher’s website.'],
    ['seven writers shortlisted','more than 200 submissions','November 2, 2026','$500 cash prize'],
    {countryCodes:['NG','US','ZW'],temporal:'shortlist-not-winner'}),
  row(10,'onuzo-great-shaking-flatiron-rights-20260930','publishing','global','2026-09-30',
    'Flatiron приобрело права на The Great Shaking Чибунду Онузо',
    'Flatiron acquires North American rights to Chibundu Onuzo’s The Great Shaking',
    'Brittle Paper сообщает, что редактор Кукува Фрейзер из Flatiron приобрела североамериканские права на новый роман Чибунду Онузо The Great Shaking. В антиутопическом будущем семья из бывшей Англии пытается переселиться в Нигерию. Источник ссылается на сведения о сделках Publishers Weekly за неделю 28 сентября; дата выхода книги пока не названа.',
    'Brittle Paper reports that Flatiron editor Kukuwa Fraser has acquired North American rights to Chibundu Onuzo’s new novel The Great Shaking. Set in a dystopian future, it follows a family from what was formerly England trying to move to Nigeria. The report cites Publishers Weekly’s deals roundup for the week of September 28; no publication date is given.',
    ['Flatiron acquired North American rights through Kukuwa Fraser; the article attributes deal details to Publishers Weekly’s September 28 week roundup.',
     'The dystopian novel follows a family seeking to immigrate from formerly England to Nigeria.',
     'No publication date is supplied; rights acquisition is distinct from book publication.'],
    ['has acquired North American rights to The Great Shaking','week of September 28, 2026','No publication date is given'],
    {countryCodes:['NG','US','GB'],temporal:'rights-acquisition-not-release',limitation:'Deal details are explicitly attributed to Publishers Weekly by the reporting article; no publication date or acquisition day is inferred.'}),
  row(11,'maaza-mengiste-macarthur-fellowship-20261001','awards','north-america','2026-10-01',
    'Мааза Менгисте получила стипендию MacArthur 2026 года',
    'Maaza Mengiste receives a 2026 MacArthur Fellowship',
    'Эфиопско-американская писательница Мааза Менгисте вошла в число 20 стипендиатов MacArthur 2026 года. Brittle Paper сообщает о гранте в 800 тысяч долларов: выплаты распределены на пять лет, ограничений по использованию средств нет. Автор Beneath the Lion’s Gaze и The Shadow King преподаёт английскую литературу в Уэслианском университете.',
    'Ethiopian American writer Maaza Mengiste is among 20 recipients of the 2026 MacArthur Fellowship. Brittle Paper reports an $800,000 grant, paid in quarterly instalments over five years, with no restrictions on its use. The author of Beneath the Lion’s Gaze and The Shadow King is a professor of English at Wesleyan University.',
    ['The article reports Mengiste is one of 20 recipients of the 2026 MacArthur Fellowship.',
     'The grant is $800,000 in quarterly instalments over five years, unrestricted.',
     'The source identifies her Ethiopian background, US base, Wesleyan post and two novels.'],
    ['among 20','receive $800,000','quarterly installments over five years','no restrictions on how the funds are used'],
    {countryCodes:['ET','US'],temporal:'fellowship-announcement'}),
  row(12,'nigeria-66-years-fifteen-books-reading-list-20261001','heritage','africa','2026-10-01',
    'Brittle Paper представил 15 книг к 66-летию независимости Нигерии',
    'Brittle Paper selects 15 books for Nigeria’s 66th independence anniversary',
    'К годовщине независимости Нигерии Brittle Paper опубликовал новый список из 15 книг о переменах в стране. В него вошли Small by Small Айка Аньи о работе врачом в 1990-е годы и Half of a Yellow Sun Чимаманды Нгози Адичи о Биафрской войне. Также представлена антология Sọ̀rọ̀sókè о протестах #EndSARS под редакцией Джумоке Вериссимо и Джеймса Йеку.',
    'For Nigeria’s independence anniversary, Brittle Paper has published a new reading list of 15 books about the country’s changing history. It includes Ike Anya’s Small by Small, about becoming a doctor in the 1990s, and Chimamanda Ngozi Adichie’s Half of a Yellow Sun, about the Biafran War. It also features the #EndSARS anthology Sọ̀rọ̀sókè, edited by Jumoke Verissimo and James Yeku.',
    ['The October 1 article marks Nigeria’s 66th independence anniversary and selects 15 books.',
     'Small by Small concerns becoming a doctor in 1990s Nigeria; Half of a Yellow Sun concerns the Biafran War.',
     'Sọ̀rọ̀sókè is an #EndSARS anthology edited by Jumoke Verissimo and James Yeku. The publication date belongs to the new reading list, not to each book’s release.'],
    ['66 Years of Nigeria Told Through 15 Books','becoming a doctor in 1990s Nigeria','Half of a Yellow Sun'],
    {countryCodes:['NG'],temporal:'new-reading-selection-not-releases'}),
  row(13,'asymptote-bojanovic-dizdarevic-translation-interview-20261001','publishing','europe','2026-10-01',
    'Урош Боянович и Айла Диздаревич обсудили перевод поэзии для Asymptote',
    'Uros Bojanović and Ajla Dizdarević discuss translating poetry with Asymptote',
    'Asymptote опубликовал разговор поэта Уроша Бояновича и переводчицы Айлы Диздаревич о сборнике Sam u vodi, переведённом на английский как Alone in the Water. Участники обсуждают сербохорватскую идентичность, отчуждение и память послевоенного общества. Боянович рассказывает, как английский перевод меняет интонации отдельных стихотворений.',
    'Asymptote publishes a conversation between poet Uros Bojanović and translator Ajla Dizdarević about Sam u vodi, translated into English as Alone in the Water. They discuss Serbo-Croatian identity, alienation and memory in a post-war society. Bojanović describes how individual poems acquired different tones in their first translation into another language.',
    ['Asymptote’s October 1 joint interview is by Bojanović and Dizdarević.',
     'Dizdarević translated Sam u vodi into English as Alone in the Water.',
     'The poet is from Teslić, Bosnia and lives in Belgrade, Serbia; they discuss identity and changes of tone in translation.'],
    ['Belgrade, Serbia','Teslić, Bosnia','Sam u vodi, or Alone in the Water','translate your poetry from Serbo-Croatian into English'],
    {countryCodes:['BA','RS'],temporal:'new-translation-interview'}),
  row(14,'asymptote-helgadottir-september-book-club-20260930','releases','europe','2026-09-30',
    'Книжный клуб Asymptote выбрал роман Steinunn G. Helgadóttir',
    'Asymptote’s book club selects Steinunn G. Helgadóttir’s novel',
    'Сентябрьской книгой клуба Asymptote стал The Strongest Woman in the World исландской писательницы Steinunn G. Helgadóttir. В материале указан перевод Лариссы Кайзер и издание Open Letter Books 2026 года. Участников клуба приглашают к обсуждению переведённой прозы и онлайн-встречам с авторами или переводчиками выбранных книг.',
    'Asymptote’s September book-club selection is The Strongest Woman in the World by Icelandic writer Steinunn G. Helgadóttir. The article identifies Larissa Kyzer’s translation and the 2026 Open Letter Books edition. Members are invited to discussions of translated fiction and online interviews with the authors or translators of the selected books.',
    ['The September 30 article announces the September book-club selection.',
     'The author is Icelandic; the translation is by Larissa Kyzer and the edition is Open Letter Books, 2026.',
     'Members are offered book discussions and author/translator Zoom interviews.'],
    ['Icelandic writer Steinunn G. Helgadóttir','translated from the Icelandic by Larissa Kyzer','Open Letter Books, 2026'],
    {countryCodes:['IS','US'],temporal:'new-book-club-selection',limitation:'No official Russian title is supplied; the original title is retained. The publication day of the underlying book is not asserted.'}),
  row(15,'asymptote-five-tamil-translators-interview-20260928','publishing','asia','2026-09-28',
    'Пять тамильских переводчиков рассказали Asymptote о литературных ландшафтах',
    'Five Tamil translators discuss literary landscapes with Asymptote',
    'В новом интервью Asymptote создатели Tamil Terrains объясняют, как древняя система литературных ландшафтов thinai работает в поэзии диаспоры. В разговоре участвуют редакторы Недра Родриго и Гита Сукумаран, переводчики из Малайзии, Индии и Сингапура. Антология вышла в Trace Press в 2025 году, а интервью опубликовано 28 сентября 2026-го.',
    'In a new Asymptote interview, the makers of Tamil Terrains explain how the ancient thinai framework of literary landscapes can inform diaspora poetry. Editors Nedra Rodrigo and Geetha Sukumaran speak alongside translators from Malaysia, India and Singapore. Trace Press published the anthology in 2025, and Asymptote published this interview on September 28, 2026.',
    ['The article is a September 28 interview with five Tamil translators, including editors Rodrigo and Sukumaran.',
     'Contributors are explicitly located in Malaysia, Tamil Nadu and Singapore.',
     'Tamil Terrains is a 2025 Trace Press anthology, not a new October 2026 release.'],
    ['Tamil Terrains (Trace Press, 2025)','Enbah Nilah from Malaysia','V. Iswarya from Tamil Nadu','Jayashree Panicker from Singapore'],
    {countryCodes:['MY','IN','SG'],temporal:'new-interview-about-2025-anthology'}),
  row(19,'publishing-scotland-free-sustainability-tools-20260928','publishing','europe','2026-09-28',
    'Publishing Scotland открыло бесплатные инструменты экологичного книгоиздания',
    'Publishing Scotland releases free sustainability tools for publishers',
    'Publishing Scotland представило пакет бесплатных ресурсов для издателей: Sustainability Roadmap, инструкции по расчёту углеродного следа и Excel-шаблон Carbon Dashboard. К ним добавлены обучение и ежемесячные встречи Carbon Catchup. Отраслевая организация также анонсировала форум 27 октября в Эдинбурге с возможностью участия онлайн.',
    'Publishing Scotland has launched free resources for publishers: a Sustainability Roadmap, carbon-footprint guidelines and the Carbon Dashboard Excel template. The package also includes training and monthly Carbon Catchup support sessions. The trade body announces an Environmental Sustainability Forum on October 27 in Edinburgh, with online participation available.',
    ['The Scottish trade body directly announces a freely available sustainability-resource package.',
     'The package includes roadmap, footprint guidelines, Excel dashboard, training and monthly Carbon Catchup.',
     'The upcoming forum is scheduled October 27 in Edinburgh and online.'],
    ['freely available to all','The Carbon Dashboard, an excel template','monthly Carbon Catchup','27th October in Edinburgh or online'],
    {countryCodes:['GB'],temporal:'resource-launch-and-future-forum'}),
  row(20,'academie-francaise-roman-first-selection-20261001','awards','europe','2026-10-01',
    'Французская академия объявила первую подборку романов на премию 2026 года',
    'Académie française announces its first 2026 novel-prize selection',
    'В первый список Grand Prix du roman Французской академии вошли 12 романов. ActuaLitté называет среди них Chronique d’un royaume perdu Ананды Деви и La Guerre éternelle Оливье Ролена. Следующий отбор сократит список до трёх книг: его объявят 15 октября, а победителя - 29 октября 2026 года.',
    'The Académie française’s first Grand Prix du roman selection contains 12 novels. ActuaLitté lists Ananda Devi’s Chronique d’un royaume perdu and Olivier Rolin’s La Guerre éternelle among them. A second selection, narrowing the list to three books, is planned for October 15, followed by the winner’s announcement on October 29, 2026.',
    ['The article explicitly dates the first Académie française selection October 1, 2026 and lists 12 novels.',
     'Devi and Rolin are included in the list.',
     'A second selection is scheduled October 15, and the winner October 29.'],
    ['Douze ouvrages','le 15 octobre','le 29 octobre','Chronique d’un royaume perdu','La Guerre éternelle'],
    {dateOnly:true,countryCodes:['FR'],temporal:'first-selection-not-winner'}),
  row(21,'meilleur-livre-etranger-second-selection-20261001','awards','europe','2026-10-01',
    'Во второй список Prix du Meilleur Livre étranger вошли девять книг',
    'Prix du Meilleur Livre étranger narrows its 2026 selection to nine books',
    'ActuaLitté опубликовал второй список французской премии Prix du Meilleur Livre étranger 2026: шесть художественных и три нехудожественных книги. Среди кандидатов - Lazar Нелио Бидерманна в переводе Роз Лабури и Le Soldat remémoré Анъет Данье в переводе Изабель Росселен. Премия рассматривает зарубежные книги, переведённые на французский язык.',
    'ActuaLitté publishes the second 2026 Prix du Meilleur Livre étranger selection: six fiction titles and three nonfiction books. Candidates include Nelio Biedermann’s Lazar, translated by Rose Labourie, and Anjet Daanje’s Le Soldat remémoré, translated by Isabelle Rosselin. The French prize recognizes works originally published abroad and translated into French.',
    ['The new second selection contains nine titles: six fiction and three nonfiction.',
     'Lazar is translated from German by Rose Labourie; Le Soldat remémoré from Dutch by Isabelle Rosselin.',
     'The prize concerns foreign works translated into French; no winners are announced.'],
    ['six en fiction et trois en non-fiction','Lazar','Rose Labourie','Le Soldat remémoré','Isabelle Rosselin'],
    {dateOnly:true,countryCodes:['FR'],temporal:'second-selection-not-winner',limitation:'The article’s visible October 1 date and primary JSON-LD date agree; an unrelated August 20 book-catalogue date in another JSON-LD node is excluded.'}),
  row(23,'eleuthera-forty-years-milan-event-20261001','anniversaries','europe','2026-10-01',
    'Издательство Elèuthera анонсировало 40-летие с литературной встречей в Милане',
    'Elèuthera announces a Milan event for its 40th anniversary',
    'Итальянское издательство Elèuthera отмечает 40 лет работы и приглашает на встречу 3 октября с 15:00 до 22:00 в миланском пространстве Scomodo на via Jean Jaurès, 22. Il Libraio сообщает о чтениях, дискуссиях и музыке. К мероприятию подготовлены две выставки издательства и архива G. Pinelli.',
    'Italian publisher Elèuthera is marking 40 years with an event on October 3, from 15:00 to 22:00, at Scomodo, via Jean Jaurès 22, Milan. Il Libraio reports a programme of readings, discussions and music. Two exhibitions by the publisher and the G. Pinelli archive are also planned for the occasion.',
    ['The publisher was founded in 1986 and marks forty years in 2026.',
     'The announced event is October 3, 15:00-22:00 at Scomodo, via Jean Jaurès 22, Milan.',
     'Readings, discussions, music and two exhibitions are planned, not reported as already held.'],
    ['nel lontano 1986','il 3 ottobre, dalle ore 15 alle 22','presso Scomodo','due mostre'],
    {countryCodes:['IT'],temporal:'future-anniversary-event'}),
  row(24,'hazelwood-two-body-problem-sequel-report-20260930','adaptations','global','2026-09-30',
    'Али Хейзелвуд анонсировала сиквел The Love Hypothesis с датой выхода в 2027 году',
    'Ali Hazelwood announces a 2027 sequel to The Love Hypothesis',
    'По сообщению Il Libraio, Али Хейзелвуд объявила о выходе The two-body problem в США 2 февраля 2027 года. Продолжение The Love Hypothesis проследит жизнь героев после докторантуры. MRC разрабатывает экранизацию для Amazon MGM Studios. Материал от 30 сентября также сообщает, что фильм по первому роману появился на Prime Video 23 сентября.',
    'Il Libraio reports Ali Hazelwood’s announcement of The two-body problem, due in the US on February 2, 2027. The sequel to The Love Hypothesis will follow its protagonists after their doctorates, and MRC is developing an adaptation for Amazon MGM Studios. The September 30 article also reports that the first novel’s film arrived on Prime Video on September 23.',
    ['Il Libraio reports the author’s announced US sequel release date February 2, 2027.',
     'MRC is developing a film for Amazon MGM Studios; development is distinct from completed release.',
     'The earlier film is reported released September 23, not September 30.'],
    ['il 2 febbraio 2027','MRC sta sviluppando un film per Amazon MGM Studios','il 23 settembre è uscito il film'],
    {countryCodes:['US','IT'],temporal:'future-sequel-and-adaptation-development',limitation:'The author’s announcement is attributed to Il Libraio’s current report; no exact social announcement day is inferred.'}),
  row(26,'tiemen-hiemstra-w-italian-interview-20261001','releases','europe','2026-10-01',
    'Тимен Химстра рассказал Il Libraio о романе W. и исчезновении его героя',
    'Tiemen Hiemstra discusses W. and its missing protagonist with Il Libraio',
    'Il Libraio опубликовал интервью с нидерландским писателем Тименом Химстрой о дебютном романе W. Итальянское издание выпустило Adelphi в переводе Дафне Парис. Автор обсуждает дружбу, отсутствие и роль мемов: основное действие занимает 13 дней, а воспоминания Олафа возвращают читателя к исчезнувшему другу и отношениям внутри их компании.',
    'Il Libraio publishes an interview with Dutch writer Tiemen Hiemstra about his debut novel W. Adelphi publishes the Italian edition in Dafne Paris’s translation. Hiemstra discusses friendship, absence and memes: the main action spans 13 days, while Olaf’s memories return to his missing friend and the relationships within their circle.',
    ['The October 1 article is an original interview with Dutch author Tiemen Hiemstra about W.',
     'The Italian publisher is Adelphi and the translator Dafne Paris.',
     'The central timeline is thirteen days, interwoven with Olaf’s memories of his missing friend.'],
    ['scrittore dei Paesi Bassi','tredici giorni','Adelphi con la traduzione di Dafne Paris'],
    {countryCodes:['NL','IT'],temporal:'new-author-interview'}),
  row(28,'moscow-writers-bookshop-reopened-20260929','publishing','europe','2026-09-30',
    '«Книжная лавка писателей» вновь открылась на Кузнецком Мосту',
    'Moscow’s Writers’ Bookshop reopens on Kuznetsky Most',
    '29 сентября в Москве открылась «Книжная лавка писателей» по адресу Кузнецкий Мост, 18/7. «Год литературы» сообщает, что площадка вернулась Союзу писателей России и работает в сети «Достоевский». Помимо продажи книг, здесь предусмотрены кафе, поэтические чтения, лекции и авторские презентации.',
    'Moscow’s Writers’ Bookshop reopened on September 29 at Kuznetsky Most 18/7. God Literatury reports that the venue has returned to the Russian Writers’ Union and operates within the Dostoevsky bookshop network. Alongside bookselling, it provides for a café, poetry readings, lectures and author presentations.',
    ['The source explicitly dates the opening September 29 at Kuznetsky Most 18/7, Moscow.',
     'The venue belongs to the Writers’ Union and is part of the Dostoevsky network.',
     'Bookselling, café and literary events are described. Disputed historical property accusations are omitted.'],
    ['29 сентября','Кузнецком Мосту, 18/7','Союзу писателей России','сети "Достоевский"'],
    {dateOnly:true,eventDate:'2026-09-29',eventDateBasis:'Opening day is explicitly September 29 in the September 30 article.',countryCodes:['RU'],temporal:'actual-bookshop-opening'}),
  row(30,'staraya-russa-literary-kiosk-five-years-20261001','anniversaries','europe','2026-10-01',
    'Литературный киоск Старой Руссы отметил пять лет работы',
    'Staraya Russa’s literary kiosk marks five years of book sharing',
    'Литературному киоску в Старой Руссе исполнилось пять лет. В репортаже «Года литературы» описана встреча читателей и дарителей книг на Воскресенской улице. Проект «Российской газеты» и газеты «Старая Русса» поддерживают волонтёры городской библиотеки: они проводят лекции и акции, а жители передают книги для свободного обмена.',
    'Staraya Russa’s literary kiosk has marked five years of operation. God Literatury reports a gathering of readers and book donors at the Voskresenskaya Street exchange point. The project by Rossiyskaya Gazeta and the Staraya Russa newspaper is supported by city-library volunteers, who organise lectures and reading activities while residents donate books for exchange.',
    ['The October 1 report says the kiosk has operated for five years and that readers were celebrated yesterday.',
     'It is a book-exchange point on Voskresenskaya Street supported by city-library volunteers.',
     'Rossiyskaya Gazeta and the Staraya Russa newspaper organised the project; books are donated and events held.'],
    ['работает в Старой Руссе уже пять лет','Вчера в киоске','на Воскресенской улице','сотрудники Старорусской городской библиотеки'],
    {dateOnly:true,eventDate:'2026-09-30',eventDateBasis:'The explicitly October 1 report says the celebration occurred yesterday.',countryCodes:['RU'],temporal:'reported-anniversary-gathering'}),
  row(31,'ast-sergey-aksakov-birth-anniversary-feature-20261001','anniversaries','europe','2026-10-01',
    'АСТ опубликовало материал о Сергее Аксакове к его дню рождения',
    'AST publishes a Sergey Aksakov feature for his birth anniversary',
    '1 октября АСТ выпустило материал о Сергее Аксакове - писателе, театральном критике и цензоре. Издательство рассказывает о его оценке актёрского искусства Михаила Щепкина и Павла Мочалова, а также о книгах о рыбалке и охоте. Материал прослеживает путь от очерка «Буран» 1833 года к мемуарной прозе, включая «Детские годы Багрова-внука».',
    'On October 1, AST published a birth-anniversary feature on Sergey Aksakov as writer, theatre critic and censor. The publisher discusses his appreciation of actors Mikhail Shchepkin and Pavel Mochalov and his writing about fishing and hunting. The feature traces his career from the 1833 sketch Buran to memoir prose, including Childhood Years of Bagrov’s Grandson.',
    ['AST’s visible October 1 article is a newly published biographical feature tied to the writer’s birthday.',
     'It discusses Aksakov’s theatre criticism and appreciation of Shchepkin and Mochalov.',
     'It covers fishing/hunting writing, the 1833 sketch Buran and Childhood Years of Bagrov’s Grandson; this is not a generated calendar entry or new book claim.'],
    ['Михаила Щепкина и Павла Мочалова','«Записок об уженье рыбы»','«Записок ружейного охотника Оренбургской губернии»'],
    {dateOnly:true,countryCodes:['RU'],temporal:'new-publisher-anniversary-feature',limitation:'The article’s compact +0300 offset is not passed off as an ISO timestamp. Only the corroborated visible October 1 date is retained.'}),
  row(32,'tsarskoye-selo-four-rare-books-return-20260930','heritage','europe','2026-09-30',
    'В «Царское Село» вернулись четыре книги императорской библиотеки',
    'Four imperial-library books return to Tsarskoye Selo',
    'Музей-заповедник «Царское Село» получил четыре книги XVIII-XIX веков, утраченные при распродажах 1930-х годов. Как сообщает «Год литературы», коллекционер Сергей Мосунов приобрёл их на международных аукционах и передал музею. Один том происходит из библиотеки Павла I, три - из комнат Александра I и Елизаветы Алексеевны; книги покажут в дворцовых экспозициях.',
    'Tsarskoye Selo museum has received four eighteenth- and nineteenth-century books lost during the 1930s sales. God Literatury reports that collector Sergey Mosunov bought them at international auctions and donated them. One volume comes from Paul I’s library; three are from Alexander I and Elizabeth Alexeievna’s rooms. The books will be displayed in the palace exhibitions.',
    ['Four eighteenth- and nineteenth-century books bearing imperial-library stamps returned after loss in 1930s sales.',
     'Sergey Mosunov bought them at international auctions and donated them to the museum.',
     'One volume comes from Paul I’s memorial library; three from Alexander I and Elizabeth Alexeievna’s rooms. Future display is explicitly planned.'],
    ['четыре книги XVIII\u2013XIX века','Сергею Мосунову','на международных аукционах','будут представлены в экспозициях'],
    {dateOnly:true,countryCodes:['RU','FR'],temporal:'actual-heritage-return',geographyBasis:'The Russian museum received books printed in Metz and Paris; France refers to the documented books’ production, not the donor’s nationality.'}),
  row(33,'lope-de-vega-gatomachia-russian-translation-excerpt-20260930','releases','europe','2026-09-30',
    '«Год литературы» представил полный русский перевод «Котомахии» Лопе де Веги',
    'God Literatury presents a complete Russian translation of Lope de Vega’s comic poem',
    'Ко Дню переводчика «Год литературы» опубликовал фрагмент «Котомахии» Лопе де Веги в полном стихотворном переводе Александра Триандафилиди. Издание БСГ-Пресс 2026 года объёмом 226 страниц двуязычное; перевод сохраняет строфику испанской поэмы. Материал знакомит с новой русской версией пародийной «Илиады» о войне котов, впервые изданной автором в 1634 году.',
    'For International Translation Day, God Literatury publishes an excerpt of Lope de Vega’s comic war of cats in Alexander Triandafilidi’s complete Russian verse translation. The bilingual BSG-Press 2026 edition has 226 pages and preserves the Spanish poem’s verse forms. The article introduces the new Russian version of a poem that Lope originally published in 1634.',
    ['The September 30 article publishes an excerpt of a complete verse translation by Alexander Triandafilidi.',
     'The bibliographic line names BSG-Press, 2026, 226 pages; the text describes a bilingual edition by OGI under the BSG-Press brand.',
     'Lope’s original was published in 1634; no unverified exact day of the Russian book’s release is supplied.'],
    ['в полном эквиритмичном переводе','Александр Триандафилиди','М: БСГ-Пресс, 2026 \u2014 226 стр.'],
    {dateOnly:true,countryCodes:['ES','RU'],temporal:'new-translation-feature',limitation:'The source’s official Russian book title is used. No translated poetry is reproduced in the evidence or summaries; the exact new book release day is unknown.'}),
];

function publicationBasis(input,row){
  const dates=input.evidence.publishedDates||[];
  const matching=dates.filter(d=>d.value?.slice(0,10)===row.publishedDate);
  const explicitHeader=input.evidence.text.match(/\b(?:\d{2}[./]\d{2}[./]2026|(?:September|October)\s+\d{1,2},?\s+2026)\b/gu)?.slice(0,4)||[];
  if(!row.dateOnly&&validTimestamp(input.publishedAt)) return {
    method:dates.length?'publisher-feed-and-article-metadata':'publisher-feed-and-visible-article-date',
    value:input.publishedAt,metadata:matching,visibleHeaderEvidence:explicitHeader,
  };
  if(!matching.length&&!explicitHeader.length)throw new Error(`publication_date_not_grounded:${row.id}`);
  return {method:'corroborated-publisher-article-calendar-date',value:row.publishedDate,
    metadata:matching,visibleHeaderEvidence:explicitHeader,
    precision:'date-only; no timezone or midnight publication time inferred'};
}

function checkBatch(batch,existing,current){
  if(batch.records.length!==REVIEWED_ROWS.length||batch.recordSha256!==hash(batch.records))throw new Error('batch_integrity_invalid');
  const canonicalUrls=new Map(existing.map(r=>[canonicalUrl(r.source?.url)?.href,r]).filter(([url])=>url));
  const incoming=new Set(),proof=new Map(batch.evidence.map(p=>[p.id,p]));
  for(const record of batch.records){
    const prior=canonicalUrls.get(canonicalUrl(record.source.url)?.href);
    if(prior&&(prior.id!==record.id||hash(prior)!==hash(record)))throw new Error(`existing_source_url_duplicate:${record.id}`);
    if(incoming.has(canonicalUrl(record.source.url)?.href))throw new Error(`batch_source_url_duplicate:${record.id}`);
    incoming.add(canonicalUrl(record.source.url)?.href);
    for(const locale of ['ru','en'])if(record.title[locale].length>160||record.summary[locale].length<250||record.summary[locale].length>440)
      throw new Error(`editorial_length_invalid:${record.id}:${locale}:${record.summary[locale].length}`);
    const evidence=proof.get(record.id), source=LITERARY_NEWS_SOURCES.find(s=>s.id===evidence?.sourceId);
    if(!source||source.discoveryEnabled===false||source.name!==record.source.name)throw new Error(`source_not_active:${record.id}`);
    if(evidence.sourcePublishedEvidence.value!==record.publishedAt||record.publishedAt?.slice(0,10)<'2026-09-25'
      ||record.publishedAt?.slice(0,10)>'2026-10-02')throw new Error(`publication_basis_invalid:${record.id}`);
    if(!evidence.proofQuotes.length||evidence.proofQuotes.reduce((n,q)=>n+q.trim().split(/\s+/u).length,0)>25)
      throw new Error(`proof_quote_budget_invalid:${record.id}`);
  }
  if(selectReviewed(batch.records,current,'Europe/Moscow').length!==batch.records.length)throw new Error('batch_not_currently_eligible');
  const merged=mergeReviewedBatch(existing,batch,{current});
  if(merged.added.length+merged.unchanged.length!==batch.records.length||merged.held.length)throw new Error('batch_merge_preview_not_additive');
  return merged;
}

export async function prepareBatch({input,current=new Date()}){
  const existing=JSON.parse(await readFile(new URL('../data/news/reviewed.json',import.meta.url),'utf8'));
  const preparedAt=current.toISOString(),records=[],evidence=[];
  for(const r of REVIEWED_ROWS){
    const sourceRow=input[r.index],detail=sourceRow?.evidence;
    if(!detail||detail.httpStatus!==200||!validTimestamp(detail.accessedAt)||!/^[a-f0-9]{64}$/u.test(detail.responseSha256||''))
      throw new Error(`source_response_unverified:${r.id}`);
    const plain=articleEvidenceText(detail.text);
    for(const quote of r.proofQuotes)if(!`${sourceRow.title}\n${detail.headline}\n${plain}`.includes(quote))throw new Error(`proof_quote_not_grounded:${r.id}:${quote}`);
    const basis=publicationBasis(sourceRow,r),publishedAt=r.dateOnly?r.publishedDate:basis.value;
    const record={id:r.id,category:r.category,kind:'news',eventDate:r.eventDate||r.publishedDate,publishedAt,
      verifiedAt:preparedAt,title:r.title,summary:r.summary,source:{...sourceRow.source,title:normalizeShortHyphens(detail.headline)},
      verification:'confirmed',region:r.region,eventKey:r.id};
    const source=LITERARY_NEWS_SOURCES.find(s=>s.id===sourceRow.sourceId);
    records.push(record);evidence.push({id:r.id,sourceId:sourceRow.sourceId,url:sourceRow.source.url,httpStatus:200,
      accessedAt:detail.accessedAt,responseSha256:detail.responseSha256,facts:r.facts,proofQuotes:r.proofQuotes,
      sourcePublishedEvidence:basis,geography:{sourceCountryCodes:source?.countryCodes||[],storyCountryCodes:r.countryCodes,
        basis:r.geographyBasis||'Countries explicitly identified in the article’s organisation, location, participant or publication-territory facts; distinct from source-host geography.'},
      review:{method:'agent_factual_and_bilingual_review_of_fetched_article',reviewedAt:preparedAt,
        eventDateBasis:r.eventDateBasis||'Explicit publication date of this announcement, interview, selection or report; future action is stated separately in future tense.',
        temporal:r.temporal,limitation:r.limitation||'Current article reviewed directly; no publication or event time is inferred from capture time.',
        bodyRetrieved:true,quoteGroundingChecked:true,ruEnFactsReviewed:true,exactReleaseDayNotInferred:true},
      thumbnailCandidates:[...new Map((detail.images||[]).filter(x=>x.displayOnly&&x.url
        &&!/(?:logo|icon|avatar|DPR-2025-Ceremony|libri-letteratura-libreria-con-libri)/iu.test(x.url))
        .map(x=>[x.url,x])).values()].slice(0,2).map(x=>({...x,socialReuseApproved:false,
          relevanceStatus:'source-article-metadata-proposal-requires-image-review',autoApply:false})),
    });
  }
  const batch={schemaVersion:1,batchId,preparedAt,scope:'Add 26 source-backed current literary news items after root review; no canonical write, publication, social send or generated calendar news.',
    records,recordSha256:hash(records),evidence};
  checkBatch(batch,existing,current);return batch;
}

async function main(){
  const {values}=parseArgs({options:{'evidence-input':{type:'string'},check:{type:'boolean'}}});
  const current=new Date(),existingRaw=await readFile(new URL('../data/news/reviewed.json',import.meta.url),'utf8');
  const existing=JSON.parse(existingRaw);
  const batch=values['evidence-input']?await prepareBatch({input:JSON.parse(await readFile(values['evidence-input'],'utf8')),current})
    :JSON.parse(await readFile(reportFile,'utf8'));
  const merged=checkBatch(batch,existing,current);
  const sourceIds=[...new Set(batch.evidence.map(e=>e.sourceId))];
  const sourceCountries=[...new Set(batch.evidence.flatMap(e=>e.geography.sourceCountryCodes))].sort();
  const storyCountries=[...new Set(batch.evidence.flatMap(e=>e.geography.storyCountryCodes))].sort();
  const receipt={batchId,checkedAt:current.toISOString(),writtenCanonical:false,remoteWrites:0,
    beforeReviewedCount:existing.length,proposedReviewedCount:merged.records.length,added:merged.added.length,unchanged:merged.unchanged.length,held:merged.held,
    eligiblePublicBefore:selectReviewed(existing,current,'Europe/Moscow').length,
    eligiblePublicAfter:selectReviewed(merged.records,current,'Europe/Moscow').length,
    sourceIds,sourceCountryCodes:sourceCountries,storyCountryCodes:storyCountries,
    explicitPublicationDateCount:batch.records.filter(r=>validDate(r.publishedAt)||validTimestamp(r.publishedAt)).length,
    dateOnlyPublicationCount:batch.records.filter(r=>validDate(r.publishedAt)).length,
    unknownPublicationDateCount:batch.records.filter(r=>r.publishedAt===null).length,
    freshWithinSevenDays:batch.records.filter(r=>Date.parse(r.publishedAt)>=current.getTime()-7*86400000).length,
    dates:[...new Set(batch.records.map(r=>r.publishedAt.slice(0,10)))].sort(),
    summaryLengths:Object.fromEntries(['ru','en'].map(l=>[l,{min:Math.min(...batch.records.map(r=>r.summary[l].length)),max:Math.max(...batch.records.map(r=>r.summary[l].length))}])),
    duplicateCheck:'stable id/eventKey, canonical source URLs and agent-reviewed news-stage identity; no duplicates',
    canonicalBeforeSha256:hash(existingRaw),recordSha256:batch.recordSha256,
    intentionallyExcluded:['3 Books Ireland pages: HTTP 403','English PEN shortlist: article request timed out',
      'Gallimard Jeunesse appointment: effective July, not new October change','Kodansha manga selection: selected in summer',
      'Napoleon biography: undated underlying release','Film scheduled October 1: no verified post-release confirmation'],
    limitations:['Freshness is based on explicit publisher dates, never on access time.',
      'The existing public total is not claimed to reach 600-700; this proposal adds exactly 26 genuine items.',
      'Image candidates are source-article display proposals only, with social reuse unapproved.',
      'Publication dates without verified ISO offset retain date-only precision. Source-host country count and story-country coverage are reported separately.'],
  };
  if(values['evidence-input']&&!values.check){await mkdir(new URL('../reports/r10/publication/',import.meta.url),{recursive:true});
    await writeFile(reportFile,JSON.stringify(batch,null,2)+'\n');await writeFile(receiptFile,JSON.stringify(receipt,null,2)+'\n');}
  if(hash(await readFile(new URL('../data/news/reviewed.json',import.meta.url),'utf8'))!==hash(existingRaw))throw new Error('canonical_changed_during_preparation');
  console.log(JSON.stringify(receipt));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
