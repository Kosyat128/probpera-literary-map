import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

const roots=new WeakSet();
const fail=code=>{throw Error(code);};
const reserved=/^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3])(?:\.|$)/iu;
function rootPath(value){
  if(typeof value!=='string'||!value.length||/[\u0000-\u001f\u007f]/u.test(value))fail('storage_backup_unsafe_root');
  return path.resolve(value);
}
function portableSegment(value,code){
  if(typeof value!=='string'||!value||value==='.'||value==='..'||/[\\/<>:"|?*\u0000-\u001f\u007f]/u.test(value)
    ||/[. ]$/u.test(value)||reserved.test(value)||Buffer.byteLength(value,'utf8')>255)fail(code);
  return value;
}
function objectSegments(bucket,objectPath){
  if(typeof bucket!=='string'||!/^[a-z0-9][a-z0-9._-]{0,99}$/iu.test(bucket))fail('storage_backup_unsafe_bucket');
  portableSegment(bucket,'storage_backup_unsafe_bucket');
  if(typeof objectPath!=='string'||!objectPath.length)fail('storage_backup_unsafe_path');
  return [bucket,...objectPath.split('/').map(value=>portableSegment(value,'storage_backup_unsafe_path'))];
}
const contained=(root,target)=>target.startsWith(root.endsWith(path.sep)?root:root+path.sep);
export function storageBackupTarget(root,bucket,objectPath){
  const safeRoot=rootPath(root),target=path.resolve(safeRoot,...objectSegments(bucket,objectPath));
  if(!contained(safeRoot,target))fail('storage_backup_path_escape');
  return target;
}
export function storageBackupIdentity(bucket,objectPath){
  return objectSegments(bucket,objectPath).map(segment=>segment.normalize('NFC').toLowerCase()).join('\0');
}
export function storageBackupRootsOverlap(left,right){
  return left===right||contained(left,right)||contained(right,left);
}
async function physicalOperatorRoot(value){
  let cursor=rootPath(value);const missing=[];
  while(true){
    try{await lstat(cursor);const existing=await realpath(cursor);
      if(!(await lstat(existing)).isDirectory())fail('storage_backup_root_not_directory');
      return path.resolve(existing,...missing);
    }catch(error){
      if(error.code!=='ENOENT')throw error;
      const parent=path.dirname(cursor);if(parent===cursor)throw error;
      missing.unshift(path.basename(cursor));cursor=parent;
    }
  }
}

/** CLI roots are explicit operator choices and may resolve through an alias.
 * All archive-relative names are portable data; no symlink, hardlink or other
 * filesystem alias beneath the anchored physical root is followed. Backup roots
 * must be exclusively owned by the operator while running: portable Node lacks
 * openat() for atomically traversing parents against a concurrent local writer. */
export async function createStorageBackupRoot(value,{create=false,allowMissing=false}={}){
  const root=await physicalOperatorRoot(value);
  if(create)await mkdir(root,{recursive:true,mode:0o700});
  let initial;
  try{initial=await lstat(root);}catch(error){if(!allowMissing||error.code!=='ENOENT')throw error;}
  if(initial&&(!initial.isDirectory()||initial.isSymbolicLink()))fail('storage_backup_unsafe_filesystem');
  async function assertRoot(){
    const stat=await lstat(root),physical=await realpath(root);
    if(!initial||!stat.isDirectory()||stat.isSymbolicLink()||physical!==root
      ||stat.dev!==initial.dev||stat.ino!==initial.ino)fail('storage_backup_root_changed');
  }
  async function checkedFile(segments,{createDirectories=false}={}){
    await assertRoot();let parent=root;
    for(const segment of segments.slice(0,-1)){
      const directory=path.resolve(parent,segment);
      if(!contained(root,directory))fail('storage_backup_path_escape');
      if(createDirectories){try{await mkdir(directory,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}}
      const stat=await lstat(directory),physical=await realpath(directory);
      if(stat.isSymbolicLink()||!stat.isDirectory()||physical!==directory||!contained(root,physical))fail('storage_backup_unsafe_filesystem');
      parent=physical;
    }
    const target=path.resolve(parent,segments.at(-1));
    if(!contained(root,target))fail('storage_backup_path_escape');
    return target;
  }
  async function read(segments){
    const target=await checkedFile(segments),stat=await lstat(target),physical=await realpath(target);
    if(stat.isSymbolicLink()||!stat.isFile()||stat.nlink!==1||!contained(root,physical))fail('storage_backup_unsafe_filesystem');
    const handle=await open(physical,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
    try{
      const opened=await handle.stat();
      if(!opened.isFile()||opened.nlink!==1||opened.dev!==stat.dev||opened.ino!==stat.ino)fail('storage_backup_file_changed');
      await checkedFile(segments);
      if(process.platform==='linux'&&!contained(root,await realpath(`/proc/self/fd/${handle.fd}`)))fail('storage_backup_path_escape');
      return await handle.readFile();
    }finally{await handle.close();}
  }
  async function write(segments,bytes){
    const target=await checkedFile(segments,{createDirectories:true});
    const handle=await open(target,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|(constants.O_NOFOLLOW||0),0o600);
    try{
      await checkedFile(segments);
      const stat=await handle.stat();if(!stat.isFile()||stat.nlink!==1)fail('storage_backup_unsafe_filesystem');
      if(process.platform==='linux'&&!contained(root,await realpath(`/proc/self/fd/${handle.fd}`)))fail('storage_backup_path_escape');
      await handle.writeFile(bytes);
    }finally{await handle.close();}
  }
  const capability=Object.freeze({root,assertRoot,
    async requireEmpty(){await assertRoot();if((await readdir(root)).length)fail('storage_backup_output_not_empty');},
    readManifest:()=>read(['storage-manifest.json']),writeManifest:bytes=>write(['storage-manifest.json'],bytes),
    readObject:(bucket,objectPath)=>read(objectSegments(bucket,objectPath)),
    writeObject:(bucket,objectPath,bytes)=>write(objectSegments(bucket,objectPath),bytes)});
  roots.add(capability);return capability;
}
export const isStorageBackupRoot=value=>roots.has(value);
