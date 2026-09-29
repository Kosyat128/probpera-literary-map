import {describe,expect,it} from 'vitest';
import {mkdtemp,mkdir,readFile,writeFile,symlink,link,rename} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createStorageBackupRoot,storageBackupTarget,storageBackupRootsOverlap} from './storage-backup-filesystem.mjs';
async function fixture(){const parent=await mkdtemp(path.join(os.tmpdir(),'probpera-backup-path-')),
  root=path.join(parent,'archive'),outside=path.join(parent,'outside');
  await mkdir(root);await mkdir(outside);return{parent,root,outside};}
async function linked(context,target,name,type){try{await symlink(target,name,type);}catch(error){
  if(['EPERM','EACCES','ENOTSUP','ENOSYS'].includes(error.code)){context.skip();return;}throw error;
}}
describe('Physical portable Storage archive filesystem',()=>{
  it('rejects traversal, ADS, Windows aliases and nonstring coercion before using them as paths',()=>{
    for(const name of ['../escape','/absolute','folder/../escape','a\\b','a//b','a\u0000b','a.txt:stream',
      'name.','name ','CON','NUL.txt','COM1.webp','LPT9','COM\u00b9.txt','a?b','a*b','a|b'])
      expect(()=>storageBackupTarget('/safe-root','editorial-media',name)).toThrow('storage_backup_unsafe_path');
    expect(()=>storageBackupTarget('/safe-root','CON','file.webp')).toThrow('storage_backup_unsafe_bucket');
    let coerced=0;const object={toString(){coerced++;return 'safe.webp';}};
    for(const args of [[object,'media','a'],['/root',object,'a'],['/root','media',object]])
      expect(()=>storageBackupTarget(...args)).toThrow(/storage_backup_unsafe_/);
    expect(coerced).toBe(0);
  });
  it('preserves ordinary Russian filenames and writes an independent exclusive file',async()=>{
    const f=await fixture(),cap=await createStorageBackupRoot(f.root),bytes=Buffer.from('архив');
    await cap.writeObject('editorial-media','2026/Достоевский 2026.webp',bytes);
    expect(await cap.readObject('editorial-media','2026/Достоевский 2026.webp')).toEqual(bytes);
    await expect(cap.writeObject('editorial-media','2026/Достоевский 2026.webp',Buffer.from('replace'))).rejects.toMatchObject({code:'EEXIST'});
    expect(await cap.readObject('editorial-media','2026/Достоевский 2026.webp')).toEqual(bytes);
  });
  it('rejects a linked parent before reading or creating an outside object',async context=>{
    const f=await fixture(),cap=await createStorageBackupRoot(f.root);await writeFile(path.join(f.outside,'existing.webp'),'outside');
    await linked(context,f.outside,path.join(f.root,'editorial-media'),process.platform==='win32'?'junction':'dir');
    await expect(cap.readObject('editorial-media','existing.webp')).rejects.toThrow('storage_backup_unsafe_filesystem');
    await expect(cap.writeObject('editorial-media','new.webp',Buffer.from('unsafe'))).rejects.toThrow('storage_backup_unsafe_filesystem');
    expect(await readFile(path.join(f.outside,'existing.webp'),'utf8')).toBe('outside');
    await expect(readFile(path.join(f.outside,'new.webp'))).rejects.toMatchObject({code:'ENOENT'});
  });
  it('rejects a symlink leaf even when the linked bytes would match a manifest',async context=>{
    const f=await fixture(),cap=await createStorageBackupRoot(f.root);await mkdir(path.join(f.root,'media'));
    const external=path.join(f.outside,'outside.webp');await writeFile(external,'outside');
    await linked(context,external,path.join(f.root,'media','image.webp'),'file');
    await expect(cap.readObject('media','image.webp')).rejects.toThrow('storage_backup_unsafe_filesystem');
    await expect(cap.writeObject('media','image.webp',Buffer.from('unsafe'))).rejects.toMatchObject({code:'EEXIST'});
    expect(await readFile(external,'utf8')).toBe('outside');
  });
  it('rejects hardlinked outside bytes and a root replaced after capability creation',async context=>{
    const f=await fixture(),cap=await createStorageBackupRoot(f.root),external=path.join(f.outside,'outside.webp');
    await writeFile(external,'outside');await mkdir(path.join(f.root,'media'));
    try{await link(external,path.join(f.root,'media','image.webp'));}catch(error){
      if(['EPERM','EACCES','ENOTSUP','ENOSYS'].includes(error.code)){context.skip();return;}throw error;
    }
    await expect(cap.readObject('media','image.webp')).rejects.toThrow('storage_backup_unsafe_filesystem');
    await rename(f.root,path.join(f.parent,'original-archive'));
    await linked(context,f.outside,f.root,process.platform==='win32'?'junction':'dir');
    await expect(cap.writeManifest('unsafe')).rejects.toThrow('storage_backup_root_changed');
    await expect(readFile(path.join(f.outside,'storage-manifest.json'))).rejects.toMatchObject({code:'ENOENT'});
  });
  it('canonicalizes explicit root aliases and detects equality or ancestor overlap',async context=>{
    const f=await fixture(),alias=path.join(f.parent,'alias');
    await linked(context,f.root,alias,process.platform==='win32'?'junction':'dir');
    const direct=await createStorageBackupRoot(f.root),aliased=await createStorageBackupRoot(alias),child=await createStorageBackupRoot(path.join(alias,'new'),{allowMissing:true});
    expect(aliased.root).toBe(direct.root);expect(storageBackupRootsOverlap(aliased.root,direct.root)).toBe(true);
    expect(storageBackupRootsOverlap(child.root,direct.root)).toBe(true);
    expect(storageBackupRootsOverlap(f.root,f.outside)).toBe(false);
  });
});
