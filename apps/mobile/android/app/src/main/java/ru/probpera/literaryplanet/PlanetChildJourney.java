package ru.probpera.literaryplanet;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Semantic IDs only. Saved progress is never review or entity authority. */
final class PlanetChildJourney {
    static final int MAX_BYTES=7168, MAX_NODES=64;
    private PlanetChildJourney() {}
    private static void require(boolean value) throws PlanetChildDataStore.Unavailable {if(!value)throw new PlanetChildDataStore.Unavailable();}
    static String identifier(String value) throws Exception {return PlanetChildAppearance.identifier(value);}
    private static String nullable(String value) throws Exception {return value==null?null:identifier(value);}
    static final class Progress {
        final String journeyId,currentNodeId,selectedCountryId,selectedWriterId,selectedWorkId,lastSafeRoute;
        final long journeyVersion,contentVersion;final List<String> completedNodeIds;
        Progress(String journeyId,long journeyVersion,long contentVersion,String currentNodeId,List<String> completedNodeIds,String country,String writer,String work,String lastSafeRoute) throws Exception {
            require(journeyVersion>0&&journeyVersion<PlanetChildAppearance.MAX_SAFE&&contentVersion>0&&contentVersion<PlanetChildAppearance.MAX_SAFE
                &&completedNodeIds!=null&&completedNodeIds.size()<=MAX_NODES&&("journey".equals(lastSafeRoute)||"home".equals(lastSafeRoute)));
            this.journeyId=identifier(journeyId);this.journeyVersion=journeyVersion;this.contentVersion=contentVersion;this.currentNodeId=nullable(currentNodeId);
            ArrayList<String> ids=new ArrayList<>();HashSet<String> distinct=new HashSet<>();for(String id:completedNodeIds){require(distinct.add(identifier(id)));ids.add(id);}this.completedNodeIds=Collections.unmodifiableList(ids);
            selectedCountryId=nullable(country);selectedWriterId=nullable(writer);selectedWorkId=nullable(work);this.lastSafeRoute=lastSafeRoute;
        }
        Map<String,Object> dto(){return row("schemaVersion",1L,"journeyId",journeyId,"journeyVersion",journeyVersion,"contentVersion",contentVersion,"currentNodeId",currentNodeId,"completedNodeIds",completedNodeIds,"selectedCountryId",selectedCountryId,"selectedWriterId",selectedWriterId,"selectedWorkId",selectedWorkId,"lastSafeRoute",lastSafeRoute);}
        byte[] encode() throws Exception {
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(bytes);out.writeInt(0x4c504a31);out.writeByte(1);writeText(out,journeyId);out.writeLong(journeyVersion);out.writeLong(contentVersion);writeNullable(out,currentNodeId);out.writeByte(completedNodeIds.size());for(String id:completedNodeIds)writeText(out,id);writeNullable(out,selectedCountryId);writeNullable(out,selectedWriterId);writeNullable(out,selectedWorkId);out.writeByte("journey".equals(lastSafeRoute)?1:0);out.flush();byte[] result=bytes.toByteArray();require(result.length<=MAX_BYTES);return result;
        }
        @Override public boolean equals(Object raw){if(!(raw instanceof Progress))return false;Progress p=(Progress)raw;return dto().equals(p.dto());}
        @Override public int hashCode(){return dto().hashCode();}
    }
    private static Map<String,Object> row(Object... fields){Map<String,Object> out=new LinkedHashMap<>();for(int i=0;i<fields.length;i+=2)out.put((String)fields[i],fields[i+1]);return Collections.unmodifiableMap(out);}
    private static void writeText(DataOutputStream out,String value) throws Exception {byte[] bytes=value.getBytes(StandardCharsets.UTF_8);try{require(bytes.length>0&&bytes.length<=96);out.writeShort(bytes.length);out.write(bytes);}finally{Arrays.fill(bytes,(byte)0);}}
    private static void writeNullable(DataOutputStream out,String value) throws Exception {out.writeBoolean(value!=null);if(value!=null)writeText(out,value);}
    private static String readText(DataInputStream in) throws Exception {int length=in.readUnsignedShort();require(length>0&&length<=96&&length<=in.available());byte[] bytes=new byte[length];try{in.readFully(bytes);return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();}finally{Arrays.fill(bytes,(byte)0);}}
    private static String readNullable(DataInputStream in) throws Exception {int flag=in.readUnsignedByte();require(flag<=1);return flag==0?null:readText(in);}
    static Progress decode(byte[] bytes) throws Exception {
        require(bytes!=null&&bytes.length>0&&bytes.length<=MAX_BYTES);DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes));require(in.readInt()==0x4c504a31&&in.readUnsignedByte()==1);String id=readText(in);long journey=in.readLong(),content=in.readLong();String current=readNullable(in);int count=in.readUnsignedByte();require(count<=MAX_NODES);List<String> completed=new ArrayList<>();for(int i=0;i<count;i++)completed.add(readText(in));String country=readNullable(in),writer=readNullable(in),work=readNullable(in);int route=in.readUnsignedByte();require(route<=1&&in.available()==0);Progress result=new Progress(id,journey,content,current,completed,country,writer,work,route==1?"journey":"home");byte[] exact=result.encode();try{require(Arrays.equals(exact,bytes));}finally{Arrays.fill(exact,(byte)0);}return result;
    }
    /** Migration preserves completion evidence, including retired canonical IDs.
     * Only an explicit complete operation can add a completed ID. */
    static Progress reanchor(Progress saved,String id,long version,List<String> nodes) throws Exception {
        validateNodes(id,nodes);if(saved==null||!saved.journeyId.equals(id))return new Progress(id,version,version,nodes.get(0),Collections.emptyList(),null,null,null,"journey");
        String current=saved.currentNodeId;if(current==null){for(String node:nodes)if(!saved.completedNodeIds.contains(node)){current=node;break;}}
        else if(!nodes.contains(current)){current=null;for(int i=saved.completedNodeIds.size()-1;i>=0;i--){String checkpoint=saved.completedNodeIds.get(i);if(nodes.contains(checkpoint)){current=checkpoint;break;}}if(current==null)for(String node:nodes)if(!saved.completedNodeIds.contains(node)){current=node;break;}}
        return new Progress(id,version,version,current,saved.completedNodeIds,saved.selectedCountryId,saved.selectedWriterId,saved.selectedWorkId,"journey");
    }
    static void validateNodes(String id,List<String> nodes) throws Exception {identifier(id);require(nodes!=null&&!nodes.isEmpty()&&nodes.size()<=MAX_NODES);Set<String> seen=new HashSet<>();for(String node:nodes)require(!id.equals(identifier(node))&&seen.add(node));}
    static Progress selectCurrent(Progress saved,String kind) throws Exception {String current=saved.currentNodeId;return new Progress(saved.journeyId,saved.journeyVersion,saved.contentVersion,current,saved.completedNodeIds,"country".equals(kind)?current:saved.selectedCountryId,"writer".equals(kind)?current:saved.selectedWriterId,"work".equals(kind)?current:saved.selectedWorkId,saved.lastSafeRoute);}
    static Progress advance(Progress saved,List<String> nodes,String current,String action,String kind) throws Exception {
        require(saved!=null&&Objects.equals(saved.currentNodeId,current));validateNodes(saved.journeyId,nodes);require("complete".equals(action)||"restart".equals(action));
        if("restart".equals(action))return new Progress(saved.journeyId,saved.journeyVersion,saved.contentVersion,nodes.get(0),saved.completedNodeIds,saved.selectedCountryId,saved.selectedWriterId,saved.selectedWorkId,"journey");
        int at=nodes.indexOf(current);require(current!=null&&at>=0);List<String> completed=new ArrayList<>(saved.completedNodeIds);if(!completed.contains(current)){require(completed.size()<MAX_NODES);completed.add(current);}
        String next=at+1<nodes.size()?nodes.get(at+1):null;if(next==null)for(String node:nodes)if(!completed.contains(node)){next=node;break;}
        return new Progress(saved.journeyId,saved.journeyVersion,saved.contentVersion,next,completed,"country".equals(kind)?current:saved.selectedCountryId,"writer".equals(kind)?current:saved.selectedWriterId,"work".equals(kind)?current:saved.selectedWorkId,"journey");
    }
}
