import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=await fs.realpath('C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work'),sha=b=>createHash('sha256').update(b).digest('hex'),rows=[];
function replace(s,a,b,count=1){let hits=0;const variants=[...new Set([a,a.replaceAll('\n','\r\n')])];for(const v of variants)s=s.replaceAll(v,(match,index)=>{hits++;const eol=match.includes('\r\n')?'\r\n':match.includes('\n')?'\n':s[s.indexOf('\n',index+match.length)-1]==='\r'?'\r\n':'\n';return b.replaceAll('\n',eol);});assert.equal(hits,count,a);return s;}
async function edit(file,change){const old=await fs.readFile(path.join(HERE,'originals',file)),s=old.toString(),next=change(s),bytes=Buffer.from(next);assert.notEqual(sha(bytes),sha(old));const output=path.join(HERE,'proposal-a2',file);await fs.mkdir(path.dirname(output),{recursive:true});try{await fs.writeFile(output,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;assert.equal(sha(await fs.readFile(output)),sha(bytes));}rows.push({path:file,beforeSha256:sha(old),afterSha256:sha(bytes)});}
await edit('src/App.tsx',s=>{
 s=replace(s,'import PlanetMascotControls, { type BookyCompanionSize } from "./host/PlanetMascotControls";','import PlanetMascotControls from "./host/PlanetMascotControls";');
 s=replace(s,'import { createBookyMotionController } from "./host/bookyMotionPreference";','import { createBookyMotionController } from "./host/bookyMotionPreference";\nimport { createBookySizeController } from "./host/bookySizePreference";');
 s=replace(s,'  const [mascotSize, setMascotSize] = useState<BookyCompanionSize>("normal");',`  const bookySize = useMemo(() => createBookySizeController({ preferences: platformServices.preferences,
    enabled: isPlanetApplication }), [platformServices.preferences, isPlanetApplication]);
  const bookySizeSnapshot = useSyncExternalStore(bookySize.subscribe, bookySize.getSnapshot, bookySize.getServerSnapshot);
  useLayoutEffect(() => {
    if (isPlanetApplication && platformVisibility === "active") return bookySize.activate();
  }, [bookySize, isPlanetApplication, platformVisibility]);`);
 return replace(s,'      size={mascotSize} onSizeChange={setMascotSize}','      size={bookySizeSnapshot.size} onSizeChange={bookySize.selectSize}\n      sizePersistence={bookySizeSnapshot} onRetrySize={bookySize.retry}');
});
await edit('src/host/PlanetMascotControls.tsx',s=>{
 s=replace(s,'import "./PlanetMascotControls.css";','import { BOOKY_COMPANION_SIZES, type BookyCompanionSize, type BookySizeSnapshot } from "./bookySizePreference";\nexport type { BookyCompanionSize } from "./bookySizePreference";\nimport "./PlanetMascotControls.css";');
 s=replace(s,'const COMPANION_SIZES = ["small", "normal", "large"] as const;\nexport type BookyCompanionSize = typeof COMPANION_SIZES[number];','const COMPANION_SIZES = BOOKY_COMPANION_SIZES;');
 s=replace(s,'  onSizeChange?: (size: BookyCompanionSize) => void;','  onSizeChange?: (size: BookyCompanionSize) => boolean | void;\n  sizePersistence?: BookySizeSnapshot;\n  onRetrySize?: () => boolean;');
 s=replace(s,'size: controlledSize, onSizeChange, persistence, onRetryPersistence, motion, onMotionChange,','size: controlledSize, onSizeChange, sizePersistence, onRetrySize, persistence, onRetryPersistence, motion, onMotionChange,');
 s=replace(s,'      || document.hidden || next === companionSize) return;','      || document.hidden || next === companionSize && (!sizePersistence || sizePersistence.state === "ready" || sizePersistence.state === "saving")) return;');
 s=replace(s,'    // committed coordinates or changing saved preferences and tours.','    // committed coordinates or changing the helper route and tours.');
 s=replace(s,'    </div>\n  </div>;\n\n  if (!snapshot.available) return null;\n  return <>\n    {targetCue',`    </div>
    {sizePersistence && <>
      <p className="planet-mascot-controls__size-status" role="status" aria-live="polite" aria-atomic="true"
        data-booky-size-state={sizePersistence.state} data-booky-size-error={sizePersistence.error ?? ""}>
        {sizePersistence.state === "loading" ? ru ? "Восстанавливаем размер…" : "Restoring size…"
          : sizePersistence.state === "saving" ? ru ? "Сохраняем размер…" : "Saving size…"
          : sizePersistence.state === "failed" ? sizePersistence.error === "write"
            ? ru ? "Размер изменён, но не сохранён." : "The size changed but could not be saved."
            : ru ? "Не удалось восстановить размер. Выберите размер или повторите попытку." : "Could not restore the size. Choose a size or try again."
          : ""}</p>
      {sizePersistence.state === "failed" && onRetrySize && <button type="button" data-booky-size-retry=""
        className="planet-mascot-controls__size-retry" onClick={() => {
          if (onRetrySize()) root.current?.querySelector<HTMLButtonElement>(\`[data-booky-size="\${companionSize}"]\`)?.focus({ preventScroll: true });
        }}>{sizePersistence.error === "write" ? ru ? "Сохранить снова" : "Save again" : ru ? "Повторить" : "Try again"}</button>}
    </>}
  </div>;
  if (!snapshot.available) return null;
  return <>
    {targetCue`);
 return s;
});
await edit('src/host/PlanetMascotControls.css',s=>replace(s,'.planet-mascot-controls__size-choices [aria-pressed="true"] { border-color: #725089; background: #f0e7f4; box-shadow: inset 0 0 0 1px #725089; }','.planet-mascot-controls__size-choices [aria-pressed="true"] { border-color: #725089; background: #f0e7f4; box-shadow: inset 0 0 0 1px #725089; }\n.planet-mascot-controls__size-status { margin: 6px 0 0; color: var(--planet-muted, #625942); font-weight: 400; }\n.planet-mascot-controls__size-status:empty { margin: 0; }\n.planet-mascot-controls .planet-mascot-controls__size-retry { width: 100%; margin-top: 6px; }'));
for(const file of['src/platform/adapters/web/WebPlatformAdapter.ts','src/host/HostPlatformServices.ts'])await edit(file,s=>{
 const web=file.includes('/web/'),where=web?'../../../host/':'./';
 const marker=web?'import { BOOKY_MOTION_PREFERENCE_KEY, isBookyMotionMode } from "../../../host/bookyMotionPreference";':'import { BOOKY_MOTION_PREFERENCE_KEY } from "./bookyMotionPreference";';
 s=replace(s,marker,marker+'\nimport { BOOKY_SIZE_PREFERENCE_KEY, BOOKY_COMPANION_SIZES'+(web?', isBookyCompanionSize':'')+' } from "'+where+'bookySizePreference";');
 s=replace(s,'  [BOOKY_MOTION_PREFERENCE_KEY, ["system", "calm"]],','  [BOOKY_MOTION_PREFERENCE_KEY, ["system", "calm"]],\n  [BOOKY_SIZE_PREFERENCE_KEY, BOOKY_COMPANION_SIZES],');
 // Every existing strict motion path also owns this exact cosmetic key.
 const occurrences=s.split('key === BOOKY_MOTION_PREFERENCE_KEY ||').length-1;assert.equal(occurrences,web?3:4);
 s=replace(s,'key === BOOKY_MOTION_PREFERENCE_KEY ||','key === BOOKY_SIZE_PREFERENCE_KEY || key === BOOKY_MOTION_PREFERENCE_KEY ||',occurrences);
 s=replace(s,'key === BOOKY_MOTION_PREFERENCE_KEY ? "booky-motion-preference-unavailable"','key === BOOKY_SIZE_PREFERENCE_KEY ? "booky-size-preference-unavailable"\n          : key === BOOKY_MOTION_PREFERENCE_KEY ? "booky-motion-preference-unavailable"');
 if(web)s=replace(s,'if (key === BOOKY_MOTION_PREFERENCE_KEY ? !isBookyMotionMode(value)','if (key === BOOKY_SIZE_PREFERENCE_KEY ? !isBookyCompanionSize(value)\n          : key === BOOKY_MOTION_PREFERENCE_KEY ? !isBookyMotionMode(value)');
 return s;
});
for(const file of['src/platform/adapters/web/WebPlatformAdapter.test.ts','src/host/HostPlatformServices.test.ts'])await edit(file,s=>{
 const web=file.includes('/web/'),label='describe("Booky motion '+(web?'browser':'native')+' preference port", () => {',start=s.indexOf(label),end=s.indexOf(web?'\nimport {':'\nconst LANGUAGE',start);assert.ok(start>=0&&end>start);
 let group=s.slice(start,end).replaceAll('MOTION','SIZE').replaceAll('motion','size').replaceAll('"system"','"normal"').replaceAll('"calm"','"large"').replaceAll('"CALM"','"LARGE"').replaceAll('"calm "','"large "').replaceAll('set:calm','set:large').replaceAll('get:calm','get:large').replaceAll('set:system','set:normal').replaceAll('get:system','get:normal');
 group=replace(group,'["normal", "large"]','["small", "normal", "large"]');
 const keyImport='import { BOOKY_SIZE_PREFERENCE_KEY as SIZE } from "'+(web?'../../../host/':'./')+'bookySizePreference";\n';
 return keyImport+group+'\n'+s;
});
await fs.writeFile(path.join(HERE,'integration-a2.json'),JSON.stringify({base:'66012ebc6ba9b90278d744c6cae5277dd7f60b31',files:rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({prepared:rows.length,canonicalWrites:false}));
