package ru.probpera.literaryplanet;

import java.util.*;

/** Canonical personal bookmark and explicit reviewed localized anchors. No locale or media time is durable identity. */
final class PlanetChildReadingPosition {
    static final long MAX_SAFE=9007199254740991L;
    static void require(boolean value) throws Exception { if(!value)throw new Exception("READING_POSITION_REFUSED"); }
    static String id(Object value) throws Exception { require(value instanceof String&&((String)value).matches("[A-Za-z0-9][A-Za-z0-9._-]{0,95}"));return (String)value; }
    static long number(Object value,long min,long max) throws Exception { require(value instanceof Long&&((Long)value)>=min&&((Long)value)<=max);return (Long)value; }
    @SuppressWarnings("unchecked") static Map<String,Object> object(Object value,String... fields) throws Exception { require(value instanceof Map);Map<String,Object> result=(Map<String,Object>)value;require(result.keySet().equals(new HashSet<>(Arrays.asList(fields))));return result; }
    static Map<String,Object> row(Object... values){Map<String,Object> result=new LinkedHashMap<>();for(int i=0;i<values.length;i+=2)result.put((String)values[i],values[i+1]);return result;}
    static final class Record {
        final String kind,id,anchorId;final long anchorVersion;
        Record(String kind,String id,long version,String anchor) throws Exception { require(Arrays.asList("country","writer","biography","work","character","storyworld","fact","quote","activity","quiz").contains(kind));this.kind=kind;this.id=PlanetChildReadingPosition.id(id);anchorVersion=number(Long.valueOf(version),1,MAX_SAFE-1);anchorId=PlanetChildReadingPosition.id(anchor); }
        String key(){return kind+"/"+id;}
        Map<String,Object> dto(){return row("schemaVersion",1L,"entity",row("kind",kind,"id",id),"anchorVersion",anchorVersion,"anchorId",anchorId);}
        @Override public boolean equals(Object value){if(!(value instanceof Record))return false;Record other=(Record)value;return kind.equals(other.kind)&&id.equals(other.id)&&anchorVersion==other.anchorVersion&&anchorId.equals(other.anchorId);}
        @Override public int hashCode(){return Objects.hash(kind,id,anchorVersion,anchorId);}
    }
    static Record decode(Object raw) throws Exception {Map<String,Object> record=object(raw,"schemaVersion","entity","anchorVersion","anchorId"),entity=object(record.get("entity"),"kind","id");require(number(record.get("schemaVersion"),1,1)==1&&entity.get("kind") instanceof String);return new Record((String)entity.get("kind"),id(entity.get("id")),number(record.get("anchorVersion"),1,MAX_SAFE-1),id(record.get("anchorId")));}
    @SuppressWarnings("unchecked") static Map<String,Object> anchors(Object raw,String expectedText) throws Exception {
        Map<String,Object> map=object(raw,"schemaVersion","anchorVersion","segments","narration");number(map.get("schemaVersion"),1,1);long version=number(map.get("anchorVersion"),1,MAX_SAFE-1);require(map.get("segments") instanceof List);List<Object> segments=(List<Object>)map.get("segments");require(!segments.isEmpty()&&segments.size()<=128);
        Set<String> ids=new HashSet<>();List<Object> canonical=new ArrayList<>();StringBuilder joined=new StringBuilder();
        for(Object rawSegment:segments){Map<String,Object> segment=object(rawSegment,"anchorId","text");String anchor=id(segment.get("anchorId"));require(ids.add(anchor)&&segment.get("text") instanceof String);String text=(String)segment.get("text");require(!text.isEmpty()&&text.length()<=32768&&!text.matches("(?s).*[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f].*"));joined.append(text);require(joined.length()<=32768);canonical.add(row("anchorId",anchor,"text",text));}
        require(joined.toString().equals(expectedText));Object narration=null;
        if(map.get("narration")!=null){Map<String,Object> n=object(map.get("narration"),"assetId","sha256","sampleRate","frameCount","cues");String asset=id(n.get("assetId"));require(n.get("sha256") instanceof String&&((String)n.get("sha256")).matches("[a-f0-9]{64}"));long rate=number(n.get("sampleRate"),8000,48000),frames=number(n.get("frameCount"),1,MAX_SAFE-1);require(frames<=rate*60&&n.get("cues") instanceof List);List<Object> cues=(List<Object>)n.get("cues");require(cues.size()==canonical.size());List<Object> checked=new ArrayList<>();long previous=0;
            for(int i=0;i<cues.size();i++){Map<String,Object> cue=object(cues.get(i),"anchorId","startFrame","endFrame");String anchor=id(cue.get("anchorId"));long start=number(cue.get("startFrame"),0,frames-1),end=number(cue.get("endFrame"),1,frames);require(anchor.equals(((Map<String,Object>)canonical.get(i)).get("anchorId"))&&start==previous&&end>start);previous=end;checked.add(row("anchorId",anchor,"startFrame",start,"endFrame",end));}require(previous==frames);narration=row("assetId",asset,"sha256",n.get("sha256"),"sampleRate",rate,"frameCount",frames,"cues",checked);
        }
        return row("schemaVersion",1L,"anchorVersion",version,"segments",canonical,"narration",narration);
    }
    @SuppressWarnings("unchecked") static void membership(Record record,Map<String,Object> reference,Object rawAnchors,String text) throws Exception {
        require(record.kind.equals(reference.get("kind"))&&record.id.equals(reference.get("id")));Map<String,Object> map=anchors(rawAnchors,text);require(Long.valueOf(record.anchorVersion).equals(map.get("anchorVersion")));boolean found=false;for(Object raw:(List<Object>)map.get("segments"))found|=record.anchorId.equals(((Map<String,Object>)raw).get("anchorId"));require(found);
    }

    /** Internal protected-store JSON decoder retains exact integer types. */
    static Object storedJson(Object raw)throws Exception {if(raw==org.json.JSONObject.NULL)return null;if(raw instanceof org.json.JSONObject){org.json.JSONObject value=(org.json.JSONObject)raw;Map<String,Object> out=new LinkedHashMap<>();Iterator<String> keys=value.keys();while(keys.hasNext()){String key=keys.next();out.put(key,storedJson(value.get(key)));}return out;}if(raw instanceof org.json.JSONArray){org.json.JSONArray value=(org.json.JSONArray)raw;require(value.length()<=128);List<Object> out=new ArrayList<>();for(int i=0;i<value.length();i++)out.add(storedJson(value.get(i)));return out;}if(raw instanceof Integer)return Long.valueOf(((Integer)raw).longValue());return raw;}}