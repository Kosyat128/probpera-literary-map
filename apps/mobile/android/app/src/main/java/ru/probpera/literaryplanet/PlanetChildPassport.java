package ru.probpera.literaryplanet;

import java.io.*;
import java.util.*;

/** Protected semantic facts only. Saved IDs never admit current content. */
final class PlanetChildPassport {
    static final int MAX_IDS=2048,MAX_BYTES=2097152;
    private PlanetChildPassport() {}
    private static void require(boolean value) throws Exception {if(!value)throw new PlanetChildDataStore.Unavailable();}
    static final class Credit {
        final String journeyId,nodeId,kind,entityId;final long journeyVersion,contentVersion;
        Credit(String journey,String node,String kind,String entity,long journeyVersion,long contentVersion) throws Exception {
            journeyId=PlanetChildJourney.identifier(journey);nodeId=PlanetChildJourney.identifier(node);
            require(Arrays.asList("writer","work").contains(kind)&&journeyVersion>0&&journeyVersion<PlanetChildAppearance.MAX_SAFE&&contentVersion>0&&contentVersion<PlanetChildAppearance.MAX_SAFE);
            this.kind=kind;entityId=PlanetChildJourney.identifier(entity);this.journeyVersion=journeyVersion;this.contentVersion=contentVersion;
        }
        String key(){return journeyId+"\n"+journeyVersion+"\n"+contentVersion+"\n"+nodeId;}
        @Override public boolean equals(Object raw){if(!(raw instanceof Credit))return false;Credit c=(Credit)raw;return key().equals(c.key())&&kind.equals(c.kind)&&entityId.equals(c.entityId)&&journeyVersion==c.journeyVersion&&contentVersion==c.contentVersion;}
        @Override public int hashCode(){return Objects.hash(key(),kind,entityId,journeyVersion,contentVersion);}
    }

    static final class CompletedJourney {
        final String journeyId;final long journeyVersion,contentVersion;final List<String> nodeIds;
        CompletedJourney(String id,long journeyVersion,long contentVersion,List<String> nodes)throws Exception {
            journeyId=PlanetChildJourney.identifier(id);require(journeyVersion>0&&journeyVersion<PlanetChildAppearance.MAX_SAFE&&contentVersion>0&&contentVersion<PlanetChildAppearance.MAX_SAFE);PlanetChildJourney.validateNodes(id,nodes);this.journeyVersion=journeyVersion;this.contentVersion=contentVersion;nodeIds=Collections.unmodifiableList(new ArrayList<>(nodes));
        }
        String key(){return journeyId+"\n"+journeyVersion+"\n"+contentVersion;}
        @Override public boolean equals(Object raw){if(!(raw instanceof CompletedJourney))return false;CompletedJourney j=(CompletedJourney)raw;return journeyId.equals(j.journeyId)&&journeyVersion==j.journeyVersion&&contentVersion==j.contentVersion&&nodeIds.equals(j.nodeIds);}
        @Override public int hashCode(){return Objects.hash(journeyId,journeyVersion,contentVersion,nodeIds);}
    }
    static final class Ledger {
        final List<String> countries;final List<Credit> credits;final List<CompletedJourney> completedJourneys;
        Ledger(List<String> countries,List<Credit> credits)throws Exception {this(countries,credits,Collections.emptyList());}
        Ledger(List<String> countries,List<Credit> credits,List<CompletedJourney> completedJourneys) throws Exception {
            require(countries!=null&&credits!=null&&countries.size()<=MAX_IDS&&credits.size()<=MAX_IDS);
            Set<String> seen=new HashSet<>();ArrayList<String> ids=new ArrayList<>();for(String id:countries){PlanetChildJourney.identifier(id);require(seen.add(id));ids.add(id);}this.countries=Collections.unmodifiableList(ids);
            seen.clear();ArrayList<Credit> learning=new ArrayList<>();for(Credit credit:credits){require(credit!=null&&seen.add(credit.key()));learning.add(credit);}this.credits=Collections.unmodifiableList(learning);require(completedJourneys!=null&&completedJourneys.size()<=32);seen.clear();ArrayList<CompletedJourney> finished=new ArrayList<>();for(CompletedJourney receipt:completedJourneys){require(receipt!=null&&seen.add(receipt.key()));finished.add(receipt);}this.completedJourneys=Collections.unmodifiableList(finished);
        }
        Ledger opened(String country) throws Exception {ArrayList<String> ids=new ArrayList<>(countries);if(!ids.contains(country)){require(ids.size()<MAX_IDS);ids.add(country);}return new Ledger(ids,credits,completedJourneys);}
        Ledger learned(Credit credit) throws Exception {if(credit==null)return this;ArrayList<Credit> next=new ArrayList<>(credits);for(Credit old:next)if(old.key().equals(credit.key())){require(old.kind.equals(credit.kind)&&old.entityId.equals(credit.entityId));return this;}require(next.size()<MAX_IDS);next.add(credit);return new Ledger(countries,next,completedJourneys);}

        Ledger finished(CompletedJourney receipt)throws Exception {if(receipt==null)return this;ArrayList<CompletedJourney> next=new ArrayList<>(completedJourneys);for(CompletedJourney old:next)if(old.key().equals(receipt.key())){require(old.equals(receipt));return this;}require(next.size()<32);next.add(receipt);return new Ledger(countries,credits,next);}
        @Override public boolean equals(Object raw){return raw instanceof Ledger&&countries.equals(((Ledger)raw).countries)&&credits.equals(((Ledger)raw).credits)&&completedJourneys.equals(((Ledger)raw).completedJourneys);}
        @Override public int hashCode(){return Objects.hash(countries,credits,completedJourneys);}
        byte[] encode() throws Exception {ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(bytes);out.writeInt(0x4c505031);out.writeByte(1);out.writeShort(countries.size());for(String id:countries)out.writeUTF(id);out.writeShort(credits.size());for(Credit c:credits){out.writeUTF(c.journeyId);out.writeUTF(c.nodeId);out.writeUTF(c.kind);out.writeUTF(c.entityId);out.writeLong(c.journeyVersion);out.writeLong(c.contentVersion);}out.writeByte(completedJourneys.size());for(CompletedJourney j:completedJourneys){out.writeUTF(j.journeyId);out.writeLong(j.journeyVersion);out.writeLong(j.contentVersion);out.writeByte(j.nodeIds.size());for(String id:j.nodeIds)out.writeUTF(id);}out.flush();byte[] result=bytes.toByteArray();require(result.length<=MAX_BYTES);return result;}
    }
    static Ledger empty() throws Exception {return new Ledger(Collections.emptyList(),Collections.emptyList());}
    static Ledger decode(byte[] bytes) throws Exception {require(bytes!=null&&bytes.length>0&&bytes.length<=MAX_BYTES);DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes));require(in.readInt()==0x4c505031&&in.readUnsignedByte()==1);int count=in.readUnsignedShort();require(count<=MAX_IDS);List<String> countries=new ArrayList<>();for(int i=0;i<count;i++)countries.add(in.readUTF());count=in.readUnsignedShort();require(count<=MAX_IDS);List<Credit> credits=new ArrayList<>();for(int i=0;i<count;i++)credits.add(new Credit(in.readUTF(),in.readUTF(),in.readUTF(),in.readUTF(),in.readLong(),in.readLong()));int n=in.readUnsignedByte();require(n<=32);List<CompletedJourney> finished=new ArrayList<>();for(int i=0;i<n;i++){String id=in.readUTF();long journey=in.readLong(),content=in.readLong();int k=in.readUnsignedByte();require(k>0&&k<=64);List<String> nodes=new ArrayList<>();for(int j=0;j<k;j++)nodes.add(in.readUTF());finished.add(new CompletedJourney(id,journey,content,nodes));}require(in.available()==0);Ledger ledger=new Ledger(countries,credits,finished);byte[] exact=ledger.encode();try{require(Arrays.equals(bytes,exact));}finally{Arrays.fill(exact,(byte)0);}return ledger;}
}
