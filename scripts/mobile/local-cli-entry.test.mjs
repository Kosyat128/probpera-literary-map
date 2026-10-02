import { describe, expect, it } from 'vitest';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isLocalCliEntry } from './local-cli-entry.mjs';

describe('local CLI main-file identity through existing path aliases',()=>{
  const ownFile=fileURLToPath(import.meta.url), ownUrl=pathToFileURL(ownFile).href;
  it('recognizes the exact actual main file and a dot-path alias without execution',()=>{
    expect(isLocalCliEntry(ownUrl,realpathSync(ownFile))).toBe(true);
    expect(isLocalCliEntry(ownUrl,path.dirname(ownFile)+path.sep+'.'+path.sep+path.basename(ownFile))).toBe(true);
  });
  const cwdAlias=path.join(process.cwd(),'scripts','mobile','local-cli-entry.test.mjs');
  it.skipIf(!existsSync(cwdAlias)||realpathSync(cwdAlias)!==realpathSync(ownFile))('recognizes the existing checkout cwd alias, including its Windows junction when present',()=>{
    expect(isLocalCliEntry(ownUrl,cwdAlias)).toBe(true);
  });
  it('rejects unrelated existing files so imports cannot execute a CLI body',()=>{
    expect(isLocalCliEntry(ownUrl,fileURLToPath(new URL('./local-cli-entry.mjs',import.meta.url)))).toBe(false);
    expect(isLocalCliEntry(new URL('./local-cli-entry.mjs',import.meta.url).href,ownFile)).toBe(false);
  });
  it('denies missing/nonfile arguments without creating filesystem entries or commands',()=>{
    for(const argv of [null,'',42,ownFile+'.missing'])expect(isLocalCliEntry(ownUrl,argv)).toBe(false);
    for(const url of [null,'not-a-url','https://example.invalid/entry.mjs'])expect(isLocalCliEntry(url,ownFile)).toBe(false);
  });
});
