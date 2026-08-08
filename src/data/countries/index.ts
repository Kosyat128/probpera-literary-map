import type { Country } from "./types";
import { generatedWriterDraftCount, mergeGeneratedWriters } from "./generated";
import { mergeWriterPortraits } from "./generated/writerPortraits";
import { mergeNobelLaureates } from "./nobelLaureatesSupplement";
import { mergeReviewedWriterBiographyDrafts } from "./writerBiographyResearch";
import { writerBiographyResearchDrafts } from "./writerBiographyResearchBatches";
import { mergeArticleReferencedBooks } from "./articleReferencedBooks";
import { mergeVerifiedBookSupplements } from "./verifiedBookSupplements";
import { countryFlag } from "../../utils/countryFlag";

import { afghanistan } from "./afghanistan";
import { albania } from "./albania";
import { algeria } from "./algeria";
import { andorra } from "./andorra";
import { angola } from "./angola";
import { antiguaAndBarbuda } from "./antigua_and_barbuda";
import { argentina } from "./argentina";
import { armenia } from "./armenia";
import { australia } from "./australia";
import { austria } from "./austria";
import { azerbaijan } from "./azerbaijan";

import { bahamas } from "./bahamas";
import { bahrain } from "./bahrain";
import { bangladesh } from "./bangladesh";
import { barbados } from "./barbados";
import { belarus } from "./belarus";
import { belgium } from "./belgium";
import { belize } from "./belize";
import { bhutan } from "./bhutan";
import { bolivia } from "./bolivia";
import { bosnia } from "./bosnia";
import { botswana } from "./botswana";
import { brazil } from "./brazil";
import { brunei } from "./brunei";
import { bulgaria } from "./bulgaria";
import { burkinaFaso } from "./burkina_faso";
import { burundi } from "./burundi";

import { cambodia } from "./cambodia";
import { cameroon } from "./cameroon";
import { canada } from "./canada";
import { capeVerde } from "./cape_verde";
import { centralAfricanRepublic } from "./central_african_republic";
import { chad } from "./chad";
import { chile } from "./chile";
import { china } from "./china";
import { colombia } from "./colombia";
import { comoros } from "./comoros";
import { cookIslands } from "./cook_islands";
import { costaRica } from "./costa_rica";
import { coteDIvoire } from "./cote_d_ivoire";
import { croatia } from "./croatia";
import { cuba } from "./cuba";
import { cyprus } from "./cyprus";
import { czechia } from "./czechia";

import { democraticRepublicOfCongo } from "./democratic_republic_of_congo";
import { denmark } from "./denmark";
import { djibouti } from "./djibouti";
import { dominica } from "./dominica";
import { dominicanRepublic } from "./dominican_republic";

import { ecuador } from "./ecuador";
import { egypt } from "./egypt";
import { elSalvador } from "./el_salvador";
import { england } from "./england";
import { equatorialGuinea } from "./equatorial_guinea";
import { eritrea } from "./eritrea";
import { estonia } from "./estonia";
import { eswatini } from "./eswatini";
import { ethiopia } from "./ethiopia";

import { fiji } from "./fiji";
import { finland } from "./finland";
import { france } from "./france";
import { frenchGuiana } from "./french_guiana";

import { gabon } from "./gabon";
import { gambia } from "./gambia";
import { georgia } from "./georgia";
import { germany } from "./germany";
import { ghana } from "./ghana";
import { greece } from "./greece";
import { grenada } from "./grenada";
import { guatemala } from "./guatemala";
import { guinea } from "./guinea";
import { guineaRepublic } from "./guinea_republic";
import { guyana } from "./guyana";

import { haiti } from "./haiti";
import { honduras } from "./honduras";
import { hongKong } from "./hong_kong";
import { hungary } from "./hungary";

import { iceland } from "./iceland";
import { india } from "./india";
import { indonesia } from "./indonesia";
import { iran } from "./iran";
import { iraq } from "./iraq";
import { ireland } from "./ireland";
import { israel } from "./israel";
import { italy } from "./italy";

import { jamaica } from "./jamaica";
import { japan } from "./japan";
import { jordan } from "./jordan";

import { kazakhstan } from "./kazakhstan";
import { kenya } from "./kenya";
import { kiribati } from "./kiribati";
import { kosovo } from "./kosovo";
import { kuwait } from "./kuwait";
import { kyrgyzstan } from "./kyrgyzstan";

import { laos } from "./laos";
import { latvia } from "./latvia";
import { lebanon } from "./lebanon";
import { lesotho } from "./lesotho";
import { liberia } from "./liberia";
import { libya } from "./libya";
import { liechtenstein } from "./liechtenstein";
import { lithuania } from "./lithuania";
import { luxembourg } from "./luxembourg";

import { macau } from "./macau";
import { madagascar } from "./madagascar";
import { malawi } from "./malawi";
import { malaysia } from "./malaysia";
import { maldives } from "./maldives";
import { mali } from "./mali";
import { malta } from "./malta";
import { marshallIslands } from "./marshall_islands";
import { mauritania } from "./mauritania";
import { mauritius } from "./mauritius";
import { mexico } from "./mexico";
import { micronesia } from "./micronesia";
import { moldova } from "./moldova";
import { monaco } from "./monaco";
import { mongolia } from "./mongolia";
import { montenegro } from "./montenegro";
import { morocco } from "./morocco";
import { mozambique } from "./mozambique";
import { myanmar } from "./myanmar";

import { namibia } from "./namibia";
import { nauru } from "./nauru";
import { nepal } from "./nepal";
import { netherlands } from "./netherlands";
import { newZealand } from "./new_zealand";
import { nicaragua } from "./nicaragua";
import { niger } from "./niger";
import { nigeria } from "./nigeria";
import { niue } from "./niue";
import { northKorea } from "./north_korea";
import { northMacedonia } from "./north_macedonia";
import { norway } from "./norway";

import { oman } from "./oman";

import { pakistan } from "./pakistan";
import { palau } from "./palau";
import { palestine } from "./palestine";
import { panama } from "./panama";
import { papuaNewGuinea } from "./papua_new_guinea";
import { paraguay } from "./paraguay";
import { peru } from "./peru";
import { philippines } from "./philippines";
import { poland } from "./poland";
import { portugal } from "./portugal";
import { puertoRico } from "./puerto_rico";

import { qatar } from "./qatar";

import { republicOfCongo } from "./republic_of_congo";
import { romania } from "./romania";
import { russia } from "./russia";
import { rwanda } from "./rwanda";

import { saintKittsAndNevis } from "./saint_kitts_and_nevis";
import { saintLucia } from "./saint_lucia";
import { saintVincentAndTheGrenadines } from "./saint_vincent_and_the_grenadines";
import { samoa } from "./samoa";
import { sanMarino } from "./san_marino";
import { saoTomeAndPrincipe } from "./sao_tome_and_principe";
import { senegal } from "./senegal";
import { serbia } from "./serbia";
import { seychelles } from "./seychelles";
import { sierraLeone } from "./sierra_leone";
import { singapore } from "./singapore";
import { slovakia } from "./slovakia";
import { slovenia } from "./slovenia";
import { solomonIslands } from "./solomon_islands";
import { somalia } from "./somalia";
import { southAfrica } from "./south_africa";
import { southKorea } from "./south_korea";
import { southSudan } from "./south_sudan";
import { spain } from "./spain";
import { sriLanka } from "./sri_lanka";
import { sudan } from "./sudan";
import { suriname } from "./suriname";
import { sweden } from "./sweden";
import { switzerland } from "./switzerland";
import { syria } from "./syria";

import { taiwan } from "./taiwan";
import { tajikistan } from "./tajikistan";
import { tanzania } from "./tanzania";
import { thailand } from "./thailand";
import { timorLeste } from "./timor_leste";
import { tonga } from "./tonga";
import { trinidadAndTobago } from "./trinidad_and_tobago";
import { tunisia } from "./tunisia";
import { turkey } from "./turkey";
import { turkmenistan } from "./turkmenistan";
import { tuvalu } from "./tuvalu";

import { uae } from "./uae";
import { uganda } from "./uganda";
import { ukraine } from "./ukraine";
import { uruguay } from "./uruguay";
import { usa } from "./usa";
import { uzbekistan } from "./uzbekistan";

import { vanuatu } from "./vanuatu";
import { vatican } from "./vatican";
import { venezuela } from "./venezuela";
import { vietnam } from "./vietnam";

import { yemen } from "./yemen";
import { zambia } from "./zambia";
import { zimbabwe } from "./zimbabwe";


const curatedCountries: Country[] = [
  afghanistan,
  albania,
  algeria,
  andorra,
  angola,
  antiguaAndBarbuda,
  argentina,
  armenia,
  australia,
  austria,
  azerbaijan,

  bahamas,
  bahrain,
  bangladesh,
  barbados,
  belarus,
  belgium,
  belize,
  bhutan,
  bolivia,
  bosnia,
  botswana,
  brazil,
  brunei,
  bulgaria,
  burkinaFaso,
  burundi,

  cambodia,
  cameroon,
  canada,
  capeVerde,
  centralAfricanRepublic,
  chad,
  chile,
  china,
  colombia,
  comoros,
  cookIslands,
  costaRica,
  coteDIvoire,
  croatia,
  cuba,
  cyprus,
  czechia,

  democraticRepublicOfCongo,
  denmark,
  djibouti,
  dominica,
  dominicanRepublic,

  ecuador,
  egypt,
  elSalvador,
  england,
  equatorialGuinea,
  eritrea,
  estonia,
  eswatini,
  ethiopia,

  fiji,
  finland,
  france,
  frenchGuiana,

  gabon,
  gambia,
  georgia,
  germany,
  ghana,
  greece,
  grenada,
  guatemala,
  guinea,
  guineaRepublic,
  guyana,

  haiti,
  honduras,
  hongKong,
  hungary,

  iceland,
  india,
  indonesia,
  iran,
  iraq,
  ireland,
  israel,
  italy,

  jamaica,
  japan,
  jordan,

  kazakhstan,
  kenya,
  kiribati,
  kosovo,
  kuwait,
  kyrgyzstan,

  laos,
  latvia,
  lebanon,
  lesotho,
  liberia,
  libya,
  liechtenstein,
  lithuania,
  luxembourg,

  macau,
  madagascar,
  malawi,
  malaysia,
  maldives,
  mali,
  malta,
  marshallIslands,
  mauritania,
  mauritius,
  mexico,
  micronesia,
  moldova,
  monaco,
  mongolia,
  montenegro,
  morocco,
  mozambique,
  myanmar,

  namibia,
  nauru,
  nepal,
  netherlands,
  newZealand,
  nicaragua,
  niger,
  nigeria,
  niue,
  northKorea,
  northMacedonia,
  norway,

  oman,

  pakistan,
  palau,
  palestine,
  panama,
  papuaNewGuinea,
  paraguay,
  peru,
  philippines,
  poland,
  portugal,
  puertoRico,

  qatar,

  republicOfCongo,
  romania,
  russia,
  rwanda,

  saintKittsAndNevis,
  saintLucia,
  saintVincentAndTheGrenadines,
  samoa,
  sanMarino,
  saoTomeAndPrincipe,
  senegal,
  serbia,
  seychelles,
  sierraLeone,
  singapore,
  slovakia,
  slovenia,
  solomonIslands,
  somalia,
  southAfrica,
  southKorea,
  southSudan,
  spain,
  sriLanka,
  sudan,
  suriname,
  sweden,
  switzerland,
  syria,

  taiwan,
  tajikistan,
  tanzania,
  thailand,
  timorLeste,
  tonga,
  trinidadAndTobago,
  tunisia,
  turkey,
  turkmenistan,
  tuvalu,

  uae,
  uganda,
  ukraine,
  uruguay,
  usa,
  uzbekistan,

  vanuatu,
  vatican,
  venezuela,
  vietnam,

  yemen,
  zambia,
  zimbabwe,
];

export const countries: Country[] = mergeReviewedWriterBiographyDrafts(
  mergeWriterPortraits(
    mergeVerifiedBookSupplements(
      mergeArticleReferencedBooks(
        mergeGeneratedWriters(mergeNobelLaureates(curatedCountries))
      )
    )
  ),
  writerBiographyResearchDrafts
).map(
  (country) => ({
    ...country,
    flag: country.flag || countryFlag(country.code),
  })
);
export { generatedWriterDraftCount };
