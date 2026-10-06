package ru.probpera.literaryplanet;

import java.io.*;
import java.util.*;

/** Encrypted catalog data only; current original native permits remain the
 * authority for each independently signed locale generation and shared object. */
final class PlanetChildRouteDownload {
    static final int MAX_MEDIA=67,MAX_OBJECTS=8192,MAX_STAGES=128;
    static final long MAX_OBJECT_BYTES=2248146944L,MAX_POOL_BYTES=4L*MAX_OBJECT_BYTES,MAX_PROGRESS_BYTES=2248671232L;
    private static void require(boolean value)throws Exception {if(!value)throw new PlanetChildDataStore.Unavailable();}
    static final class ObjectRef {
        final String profileId,checksum,mime;final int bytes;
        ObjectRef(String profile,String checksum,String mime,int bytes)throws Exception {
            profileId=PlanetChildJourney.identifier(profile);require(checksum!=null&&checksum.matches("[a-f0-9]{64}"));this.checksum=checksum;
            PlanetChildResources.canonicalPath(checksum,mime);require(bytes>0&&bytes<=("audio/wav".equals(mime)?PlanetChildResources.MAX_AUDIO:PlanetChildResources.MAX_RASTER));this.mime=mime;this.bytes=bytes;
        }
        String key(){return profileId+"\n"+checksum+"\n"+mime;}
        @Override public boolean equals(Object value){return value instanceof ObjectRef&&key().equals(((ObjectRef)value).key())&&bytes==((ObjectRef)value).bytes;}
        @Override public int hashCode(){return Objects.hash(key(),bytes);}
    }
    static final class Stage implements AutoCloseable {
        final String profileId;final PlanetChildPassport.Route route;final int completed,reused;
        Stage(String profile,PlanetChildPassport.Route source,int completed,int reused)throws Exception {
            profileId=PlanetChildJourney.identifier(profile);require(source!=null&&PlanetChildVault.sharedPassportRoute(source));route=source.detached();
            boolean kept=false;try{int count=objects().size();require(count<=MAX_MEDIA&&completed>=0&&completed<=count&&reused>=0&&reused<=completed);this.completed=completed;this.reused=reused;kept=true;}finally{if(!kept)route.wipe();}
        }
        String key(){return profileId+"\n"+route.key();}
        List<ObjectRef> objects()throws Exception {return PlanetChildVault.sharedPassportRouteObjects(profileId,route);}
        Stage detached()throws Exception{return new Stage(profileId,route,completed,reused);}
        boolean ready()throws Exception{return completed==objects().size();}
        Map<String,Object> dto(String status)throws Exception {
            long bytes=route.byteLength(),done=route.byteLength();int shared=0;List<ObjectRef> refs=objects();for(int i=0;i<refs.size();i++){ObjectRef ref=refs.get(i);bytes+=ref.bytes;if(i<completed){done+=ref.bytes;if(!"audio/wav".equals(ref.mime))shared++;}}
            require(bytes<=MAX_PROGRESS_BYTES);Map<String,Object> value=new LinkedHashMap<>();value.put("status",status);value.put("journeyId",route.journeyId);value.put("locale",route.locale);value.put("completedItems",(long)completed+1);value.put("totalItems",(long)refs.size()+1);value.put("downloadedBytes",done);value.put("totalBytes",bytes);value.put("sharedItems",(long)shared);value.put("reusedItems",(long)reused);return Collections.unmodifiableMap(value);
        }
        public void close(){route.wipe();}
    }
    static Map<String,Object> empty(String status,String id,String locale)throws Exception {
        PlanetChildJourney.identifier(id);require(Arrays.asList("absent","cancelled").contains(status)&&Arrays.asList("ru","en").contains(locale));Map<String,Object> value=new LinkedHashMap<>();value.put("status",status);value.put("journeyId",id);value.put("locale",locale);for(String key:Arrays.asList("completedItems","totalItems","downloadedBytes","totalBytes","sharedItems","reusedItems"))value.put(key,0L);return Collections.unmodifiableMap(value);
    }
    static final class Catalog implements AutoCloseable {
        boolean present,checkpointTerminal;String checkpointProfile,checkpointLedger;long checkpointRevision;final TreeMap<String,ObjectRef> objects=new TreeMap<>();final TreeMap<String,Stage> stages=new TreeMap<>();
        void validate()throws Exception {if(checkpointProfile==null)require(checkpointLedger==null&&checkpointRevision==0&&!checkpointTerminal);else{PlanetChildJourney.identifier(checkpointProfile);require(checkpointRevision>0&&checkpointRevision<PlanetChildAppearance.MAX_SAFE&&checkpointLedger!=null&&checkpointLedger.matches("[a-f0-9]{64}"));}require(objects.size()<=MAX_OBJECTS&&stages.size()<=MAX_STAGES);long bytes=0;Map<String,Long> perProfile=new HashMap<>();for(Map.Entry<String,ObjectRef> row:objects.entrySet()){require(row.getKey().equals(row.getValue().key()));bytes+=row.getValue().bytes;require(bytes<=MAX_POOL_BYTES);long profileBytes=perProfile.getOrDefault(row.getValue().profileId,0L)+row.getValue().bytes;require(profileBytes<=MAX_OBJECT_BYTES);perProfile.put(row.getValue().profileId,profileBytes);}for(Map.Entry<String,Stage> row:stages.entrySet()){Stage stage=row.getValue();require(row.getKey().equals(stage.key()));List<ObjectRef> refs=stage.objects();for(int i=0;i<stage.completed;i++)require(refs.get(i).equals(objects.get(refs.get(i).key())));}}
        byte[] encode()throws Exception {validate();ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(bytes);out.writeInt(0x4c504433);out.writeByte(1);out.writeShort(objects.size());for(ObjectRef ref:objects.values()){out.writeUTF(ref.profileId);out.writeUTF(ref.checksum);out.writeUTF(ref.mime);out.writeInt(ref.bytes);}out.writeShort(stages.size());for(Stage stage:stages.values()){out.writeUTF(stage.profileId);out.writeByte(stage.completed);out.writeByte(stage.reused);byte[] b=new PlanetChildPassport.Ledger(Collections.emptyList(),Collections.emptyList(),Collections.emptyList(),Collections.emptyList(),Collections.singletonList(stage.route)).encode();try{out.writeInt(b.length);out.write(b);}finally{Arrays.fill(b,(byte)0);}}out.writeBoolean(checkpointProfile!=null);if(checkpointProfile!=null){out.writeUTF(checkpointProfile);out.writeLong(checkpointRevision);out.writeUTF(checkpointLedger);out.writeBoolean(checkpointTerminal);}out.flush();return bytes.toByteArray();}
        static Catalog decode(byte[] bytes)throws Exception {Catalog catalog=new Catalog();boolean kept=false;try{DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes));require(in.readInt()==0x4c504433&&in.readUnsignedByte()==1);catalog.present=true;int count=in.readUnsignedShort();require(count<=MAX_OBJECTS);for(int i=0;i<count;i++){ObjectRef ref=new ObjectRef(in.readUTF(),in.readUTF(),in.readUTF(),in.readInt());require(catalog.objects.put(ref.key(),ref)==null);}int stages=in.readUnsignedShort();require(stages<=MAX_STAGES);for(int i=0;i<stages;i++){String profile=in.readUTF();int completed=in.readUnsignedByte(),reused=in.readUnsignedByte(),length=in.readInt();require(length>0&&length<=PlanetChildPassport.MAX_BYTES&&length<=in.available());byte[] b=new byte[length];try{in.readFully(b);PlanetChildPassport.Ledger ledger=PlanetChildPassport.decode(b);try{require(ledger.countries.isEmpty()&&ledger.credits.isEmpty()&&ledger.completedJourneys.isEmpty()&&ledger.awards.isEmpty()&&ledger.routes.size()==1);Stage stage=new Stage(profile,ledger.routes.get(0),completed,reused);require(catalog.stages.put(stage.key(),stage)==null);}finally{ledger.wipe();}}finally{Arrays.fill(b,(byte)0);}}int checkpoint=in.readUnsignedByte();require(checkpoint<=1);if(checkpoint==1){catalog.checkpointProfile=in.readUTF();catalog.checkpointRevision=in.readLong();catalog.checkpointLedger=in.readUTF();int terminal=in.readUnsignedByte();require(terminal<=1);catalog.checkpointTerminal=terminal==1;}require(in.available()==0);catalog.validate();byte[] exact=catalog.encode();try{require(Arrays.equals(bytes,exact));}finally{Arrays.fill(exact,(byte)0);}kept=true;return catalog;}finally{if(!kept)catalog.close();}}
        void clearCheckpoint(){checkpointProfile=null;checkpointLedger=null;checkpointRevision=0;checkpointTerminal=false;}
        public void close(){clearCheckpoint();for(Stage stage:stages.values())stage.close();stages.clear();objects.clear();}
    }
}
