package ru.probpera.literaryplanet;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.*;

/** Import profile shared by the signed scene compiler and the original output
 * permit. It never issues a resource claim or follows a URI. Compressed geometry,
 * KTX2 and extensions remain denied until measured platform support exists. */
final class PlanetChildModelImport {
    static final int MAX_ENCODED=33554432,MAX_JSON=1048576,MAX_OUTPUTS=67;
    private static void require(boolean value)throws PlanetChildVault.Unavailable {if(!value)throw new PlanetChildVault.Unavailable();}
    @SuppressWarnings("unchecked") private static Map<String,Object> object(Object value,String...fields)throws Exception {
        require(value instanceof Map);Map<String,Object> row=(Map<String,Object>)value;
        if(fields.length>0)require(row.keySet().equals(new HashSet<>(Arrays.asList(fields))));return row;
    }
    @SuppressWarnings("unchecked") private static List<Object> array(Object value,int maximum)throws Exception {
        require(value instanceof List&&((List<?>)value).size()<=maximum);return (List<Object>)value;
    }
    private static List<Object> optional(Object value,int maximum)throws Exception {return value==null?Collections.emptyList():array(value,maximum);}
    private static String text(Object value)throws Exception {require(value instanceof String);return (String)value;}
    private static int integer(Object value,int low,int high)throws Exception {
        require(value instanceof Long||value instanceof Integer);long n=((Number)value).longValue();require(n>=low&&n<=high);return (int)n;
    }
    private static int number(Map<String,Object> row,String name,int fallback,int low,int high)throws Exception {return row.containsKey(name)?integer(row.get(name),low,high):fallback;}
    private static double finite(Object value,double low,double high)throws Exception {
        require(value instanceof Number);double n=((Number)value).doubleValue();require(Double.isFinite(n)&&n>=low&&n<=high&&Double.doubleToRawLongBits(n)!=Double.doubleToRawLongBits(-0d));return n;
    }
    static boolean modelMime(String mime){return "model/gltf+json".equals(mime)||"model/gltf-binary".equals(mime);}
    static boolean binaryMime(String mime){return modelMime(mime)||"application/octet-stream".equals(mime);}
    static String extension(String mime)throws Exception {
        if("model/gltf+json".equals(mime))return "gltf";if("model/gltf-binary".equals(mime))return "glb";
        if("application/octet-stream".equals(mime))return "bin";
        if("image/png".equals(mime))return "png";if("image/jpeg".equals(mime))return "jpg";require("image/webp".equals(mime));return "webp";
    }
    static final class Binding {
        final String tier,slotId,kind,assetId,alias,mime,checksum;final int bytes,maxDecodedBytes,maxTriangles;
        final Map<String,Object> resource,model;
        private Binding(String tier,String slotId,Map<String,Object> resource,Map<String,Object> model,int decoded,int triangles)throws Exception {
            this.tier=tier;this.slotId=slotId;this.resource=resource;this.model=model;maxDecodedBytes=decoded;maxTriangles=triangles;
            kind=text(resource.get("kind"));assetId=text(resource.get("assetId"));alias=text(resource.get("alias"));mime=text(resource.get("mime"));checksum=text(resource.get("checksum"));bytes=integer(resource.get("encodedBytes"),1,MAX_ENCODED);
        }
    }
    private static Map<String,Object> resource(Object raw,String slot,String expected)throws Exception {
        Map<String,Object> r=object(raw,"assetId","entity","mime","checksum","encodedBytes","alias","kind"),entity=object(r.get("entity"),"kind","id","contentChecksum");
        require(text(r.get("assetId")).matches("[A-Za-z0-9][A-Za-z0-9._-]{0,95}")&&slot.equals(entity.get("kind"))&&text(entity.get("id")).matches("[A-Za-z0-9][A-Za-z0-9._-]{0,95}")
            &&text(entity.get("contentChecksum")).matches("[a-f0-9]{64}")&&text(r.get("checksum")).matches("[a-f0-9]{64}"));
        String kind=text(r.get("kind")),mime=text(r.get("mime")),alias=text(r.get("alias"));integer(r.get("encodedBytes"),1,MAX_ENCODED);
        require(Arrays.asList("model","buffer","texture").contains(kind)&&(expected==null||expected.equals(kind))&&alias.matches("[a-z0-9][a-z0-9_-]{0,63}\\.(gltf|glb|bin|png|jpg|webp)")&&alias.endsWith("."+extension(mime)));
        require("model".equals(kind)?modelMime(mime):"buffer".equals(kind)?"application/octet-stream".equals(mime):Arrays.asList("image/png","image/jpeg","image/webp").contains(mime));return r;
    }
    static List<Binding> bindings(Object raw)throws Exception {
        Map<String,Object> pack=object(raw,"schemaVersion","packageId","packageVersion","minAppVersion","formatProfile","tiers");
        require(integer(pack.get("schemaVersion"),1,1)==1&&integer(pack.get("minAppVersion"),1,1)==1&&"gltf2-static-v1".equals(pack.get("formatProfile"))
            &&text(pack.get("packageId")).matches("[A-Za-z0-9][A-Za-z0-9._-]{0,95}"));Object version=pack.get("packageVersion");require((version instanceof Long||version instanceof Integer)&&((Number)version).longValue()>0&&((Number)version).longValue()<=9007199254740991L);
        List<Object> tiers=array(pack.get("tiers"),3);require(tiers.size()==3);List<Binding> result=new ArrayList<>();Map<String,Map<String,Object>> identities=new HashMap<>();
        String[] order={"high","balanced","economy"};
        for(int i=0;i<3;i++) {
            Map<String,Object> tier=object(tiers.get(i),"tier","maxDecodedBytes","maxTriangles","models");require(order[i].equals(tier.get("tier")));
            int decoded=integer(tier.get("maxDecodedBytes"),1,67108864),triangles=integer(tier.get("maxTriangles"),1,200000);List<Object> models=array(tier.get("models"),2);require(!models.isEmpty());Set<String> slots=new HashSet<>();int outputs=3;long encoded=0;
            for(Object item:models) {
                Map<String,Object> model=object(item,"slotId","model","dependencies","bounds");String slot=text(model.get("slotId"));require(Arrays.asList("stand","background").contains(slot)&&slots.add(slot));
                Map<String,Object> bounds=object(model.get("bounds"),"min","max");List<Object> min=array(bounds.get("min"),3),max=array(bounds.get("max"),3);require(min.size()==3&&max.size()==3);
                for(int axis=0;axis<3;axis++)require(finite(min.get(axis),-12,12)<=finite(max.get(axis),-12,12));
                if("stand".equals(slot))require(((Number)max.get(1)).doubleValue()<=-1.05);List<Object> resources=new ArrayList<>();resources.add(resource(model.get("model"),slot,"model"));resources.addAll(array(model.get("dependencies"),16));
                Set<String> aliases=new HashSet<>(),ids=new HashSet<>();
                for(int n=0;n<resources.size();n++) {
                    Map<String,Object> row=resource(resources.get(n),slot,n==0?"model":null);require(n==0||!"model".equals(row.get("kind")));
                    Binding binding=new Binding(order[i],slot,row,model,decoded,triangles);require(!"texture".equals(binding.kind)||!"image/webp".equals(binding.mime)||"economy".equals(order[i]));require(aliases.add(binding.alias)&&ids.add(binding.assetId));Map<String,Object> identity=new LinkedHashMap<>(row);identity.remove("alias");Map<String,Object> prior=identities.putIfAbsent(binding.assetId,identity);require(prior==null||prior.equals(identity));
                    encoded+=binding.bytes;require(encoded<=67108864);result.add(binding);outputs++;
                }
            }require(outputs<=MAX_OUTPUTS);
        }require(identities.size()<=64);return Collections.unmodifiableList(result);
    }
    static Binding resolve(Object pack,String tier,String kind,String assetId)throws Exception {
        require(Arrays.asList("high","balanced","economy").contains(tier)&&Arrays.asList("model","buffer","texture").contains(kind));
        Binding found=null;for(Binding b:bindings(pack))if(b.tier.equals(tier)&&b.kind.equals(kind)&&b.assetId.equals(assetId)){require(found==null||found.resource.equals(b.resource));found=b;}require(found!=null);return found;
    }

    static String canonicalNumber(double value)throws Exception {
        require(Double.isFinite(value)&&Double.doubleToRawLongBits(value)!=Double.doubleToRawLongBits(-0d));
        if(value==0)return "0";double absolute=Math.abs(value);
        if(absolute>=0.000001&&absolute<1e21)return java.math.BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
        String raw=Double.toString(value).toLowerCase(Locale.ROOT);int at=raw.indexOf('e');if(at<0)return raw;String mantissa=raw.substring(0,at);if(mantissa.endsWith(".0"))mantissa=mantissa.substring(0,mantissa.length()-2);int exponent=Integer.parseInt(raw.substring(at+1));return mantissa+"e"+(exponent>=0?"+":"")+exponent;
    }
    static void validateSceneId(Object raw,String sceneId)throws Exception {
        Map<String,Object> pack=object(raw);Object version=pack.get("packageVersion");require(version instanceof Long||version instanceof Integer);long n=((Number)version).longValue();require(n>0&&n<=9007199254740991L&&sceneId!=null&&sceneId.length()<=96&&(text(pack.get("packageId"))+".v"+n).equals(sceneId));bindings(raw);
    }

    static Object json(byte[] bytes,int maximum)throws Exception {return PlanetChildVault.common3DJson(bytes,maximum);}
    private static void noExtensions(Object value)throws Exception {
        if(value instanceof Map)for(Map.Entry<?,?> e:((Map<?,?>)value).entrySet()){String key=text(e.getKey());require(!Arrays.asList("extensions","extensionsUsed","extensionsRequired","skins","cameras","animations","sparse","targets").contains(key));noExtensions(e.getValue());}
        else if(value instanceof List)for(Object item:(List<?>)value)noExtensions(item);
    }
    private static final class Accessor {
        final String alias,type;final int start,stride,count,component,components,width;int indexLimit=-1;
        Accessor(String alias,String type,int start,int stride,int count,int component,int components,int width){this.alias=alias;this.type=type;this.start=start;this.stride=stride;this.count=count;this.component=component;this.components=components;this.width=width;}
    }
    static final class Layout {
        final Map<String,Integer> buffers;final List<Accessor> accessors;final int triangles,decodedBytes;final Set<String> textures;final List<WorldPosition> positions;final double[] min,max;final int binStart;final Map<String,Integer> textureUses;
        private Layout(Map<String,Integer> buffers,List<Accessor> accessors,int triangles,Set<String> textures,int decodedBytes,List<WorldPosition> positions,double[] min,double[] max,int binStart,Map<String,Integer> textureUses){this.buffers=Collections.unmodifiableMap(new LinkedHashMap<>(buffers));this.accessors=Collections.unmodifiableList(accessors);this.triangles=triangles;this.textures=Collections.unmodifiableSet(textures);this.decodedBytes=decodedBytes;this.positions=Collections.unmodifiableList(positions);this.min=min.clone();this.max=max.clone();this.binStart=binStart;this.textureUses=Collections.unmodifiableMap(new HashMap<>(textureUses));}
        interface Current {void check()throws Exception;}
        /** Original worker supplies current, hash-framed native output copies. */
        void closure(byte[] modelBytes,Map<String,byte[]> external,boolean background,Current current)throws Exception {
            require(modelBytes!=null&&external!=null&&current!=null);current.check();
            Map<String,ByteBuffer> sources=new HashMap<>();Set<String> expected=new HashSet<>(buffers.keySet());expected.remove("@glb");require(external.keySet().equals(expected));
            for(Map.Entry<String,Integer> entry:buffers.entrySet()){
                String alias=entry.getKey();int length=entry.getValue();ByteBuffer source;
                if("@glb".equals(alias)){require(binStart>=0&&binStart<=modelBytes.length-length);source=ByteBuffer.wrap(modelBytes,binStart,length).slice().order(ByteOrder.LITTLE_ENDIAN);}
                else{byte[] bytes=external.get(alias);require(bytes!=null&&bytes.length==length);decode(alias,bytes,current);source=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);}
                sources.put(alias,source);current.check();
            }
            int rendered=0;double[] a=new double[3],b=new double[3],c=new double[3];
            for(WorldPosition position:positions){
                ByteBuffer vertices=sources.get(position.accessor.alias),indices=sources.get(position.indices.alias);require(vertices!=null&&indices!=null&&position.indices.count%3==0);
                for(int n=0;n<position.accessor.count;n++){if((n&1023)==0)current.check();point(position,vertices,n,a);}
                for(int n=0;n<position.indices.count;n+=3){
                    if((rendered&255)==0)current.check();
                    point(position,vertices,index(position.indices,indices,n,position.accessor.count),a);point(position,vertices,index(position.indices,indices,n+1,position.accessor.count),b);point(position,vertices,index(position.indices,indices,n+2,position.accessor.count),c);
                    double distance=triangleDistanceSquared(a,b,c);if(background)require(Double.isFinite(distance)&&distance>=1.35*1.35-1e-8);rendered++;require(rendered<=triangles);
                }
            }
            require(rendered==triangles&&rendered>0);current.check();
        }
        private void point(WorldPosition p,ByteBuffer bytes,int n,double[] out)throws Exception {
            Accessor a=p.accessor;require(n>=0&&n<a.count);int at=a.start+n*a.stride;require(at>=0&&at<=bytes.limit()-12);
            double x=bytes.getFloat(at),y=bytes.getFloat(at+4),z=bytes.getFloat(at+8);double[] m=p.matrix;
            for(int k=0;k<3;k++){out[k]=m[k]*x+m[k+4]*y+m[k+8]*z+m[k+12];require(Double.isFinite(out[k])&&Math.abs(out[k])<=12&&out[k]>=min[k]-.0001&&out[k]<=max[k]+.0001);}
        }
        private int index(Accessor a,ByteBuffer bytes,int n,int count)throws Exception {
            int at=a.start+n*a.stride;require(n>=0&&n<a.count&&at>=0&&at<=bytes.limit()-a.width);long value;
            if(a.component==5121)value=bytes.get(at)&255;else if(a.component==5123)value=bytes.getShort(at)&65535;else{require(a.component==5125);value=bytes.getInt(at)&0xffffffffL;}
            require(value>=0&&value<count);return (int)value;
        }
        void decode(String alias,byte[] bytes)throws Exception {decode(alias,bytes,null);}
        void decode(String alias,byte[] bytes,Current current)throws Exception {
            Integer expected=buffers.get(alias);require(expected!=null&&bytes!=null&&bytes.length==expected);ByteBuffer source=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
            for(Accessor a:accessors)if(a.alias.equals(alias))for(int n=0;n<a.count;n++)for(int c=0;c<a.components;c++) {
                if(current!=null&&c==0&&(n&1023)==0)current.check();int at=a.start+n*a.stride+c*a.width;require(at>=0&&at<=bytes.length-a.width);long index=-1;
                if(a.component==5126){float value=source.getFloat(at);require(Float.isFinite(value)&&Math.abs(value)<=12f);}
                else if(a.component==5121)index=bytes[at]&255;else if(a.component==5123)index=source.getShort(at)&65535;else if(a.component==5125)index=source.getInt(at)&0xffffffffL;
                else if(a.component==5120)source.get(at);else source.getShort(at);
                if(a.indexLimit>=0)require(index>=0&&index<a.indexLimit);
            }
            for(WorldPosition position:positions)if(position.accessor.alias.equals(alias)){
                Accessor a=position.accessor;double[] m=position.matrix;
                for(int n=0;n<a.count;n++){
                    if(current!=null&&(n&1023)==0)current.check();int at=a.start+n*a.stride;
                    double x=source.getFloat(at),y=source.getFloat(at+4),z=source.getFloat(at+8);
                    double[] point={m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]};
                    for(int k=0;k<3;k++)require(Double.isFinite(point[k])&&Math.abs(point[k])<=12&&point[k]>=min[k]-.0001&&point[k]<=max[k]+.0001);
                }
            }
        }
    }
    private static Map<String,Object> fields(Object raw,String[] required,String...optional)throws Exception {
        Map<String,Object> row=object(raw);Set<String> allowed=new HashSet<>(Arrays.asList(required));allowed.addAll(Arrays.asList(optional));require(allowed.containsAll(row.keySet())&&row.keySet().containsAll(Arrays.asList(required)));return row;
    }
    static Layout importModel(byte[] bytes,String mime,Map<String,Integer> declaredBuffers,Set<String> declaredTextures,int maxDecodedBytes,int maxTriangles)throws Exception {
        return importModel(bytes,mime,declaredBuffers,declaredTextures,maxDecodedBytes,maxTriangles,new double[]{-12,-12,-12},new double[]{12,12,12});
    }
    static Layout importModel(byte[] bytes,String mime,Map<String,Integer> declaredBuffers,Set<String> declaredTextures,int maxDecodedBytes,int maxTriangles,double[] min,double[] max)throws Exception {
        require(min!=null&&max!=null&&min.length==3&&max.length==3);for(int k=0;k<3;k++)require(Double.isFinite(min[k])&&Double.isFinite(max[k])&&min[k]>=-12&&max[k]<=12&&min[k]<=max[k]);
        require(bytes!=null&&bytes.length>0&&bytes.length<=MAX_ENCODED&&modelMime(mime));byte[] jsonBytes=bytes;int binStart=-1,binLength=0;boolean copied=false;
        try {
            if("model/gltf-binary".equals(mime)) {
                require(bytes.length>=28);ByteBuffer glb=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);require(glb.getInt()==0x46546c67&&glb.getInt()==2&&(glb.getInt()&0xffffffffL)==bytes.length);
                int length=glb.getInt(),kind=glb.getInt();require(length>0&&length<=MAX_JSON&&length%4==0&&kind==0x4e4f534a&&length<=bytes.length-20);
                jsonBytes=Arrays.copyOfRange(bytes,20,20+length);copied=true;int at=20+length;
                if(at<bytes.length){require(at<=bytes.length-8);binLength=glb.getInt(at);require(binLength>0&&binLength%4==0&&glb.getInt(at+4)==0x004e4942&&binLength==bytes.length-at-8);binStart=at+8;}
            }
            Map<String,Object> root=fields(json(jsonBytes,MAX_JSON),new String[]{"asset","scene","scenes","nodes","meshes","buffers","bufferViews","accessors"},"materials","textures","images","samplers");noExtensions(root);
            require("2.0".equals(fields(root.get("asset"),new String[]{"version"},"generator").get("version")));
            List<Object> bufferRows=array(root.get("buffers"),16),views=array(root.get("bufferViews"),256),rawAccessors=array(root.get("accessors"),512),meshes=array(root.get("meshes"),64);
            require(!bufferRows.isEmpty()&&!meshes.isEmpty());Map<String,Integer> actualBuffers=new LinkedHashMap<>();List<String> names=new ArrayList<>();
            for(int i=0;i<bufferRows.size();i++) {
                Map<String,Object> row=fields(bufferRows.get(i),new String[]{"byteLength"},"uri");int length=integer(row.get("byteLength"),1,MAX_ENCODED);String name;
                if("model/gltf-binary".equals(mime)){require(bufferRows.size()==1&&i==0&&!row.containsKey("uri")&&binStart>=0&&length<=binLength&&binLength-length<=3);name="@glb";}
                else{name=text(row.get("uri"));require(name.matches("[a-z0-9][a-z0-9_-]{0,63}\\.bin"));}
                require(actualBuffers.put(name,length)==null);names.add(name);
            }
            if(declaredBuffers!=null)require("model/gltf-binary".equals(mime)?declaredBuffers.isEmpty():actualBuffers.equals(declaredBuffers));
            for(Object raw:views){Map<String,Object> view=fields(raw,new String[]{"buffer","byteLength"},"byteOffset","byteStride","target");int index=integer(view.get("buffer"),0,names.size()-1),start=number(view,"byteOffset",0,0,MAX_ENCODED),length=integer(view.get("byteLength"),1,MAX_ENCODED);require((long)start+length<=actualBuffers.get(names.get(index)));if(view.get("byteStride")!=null)require(integer(view.get("byteStride"),4,252)%4==0);if(view.get("target")!=null)require(Arrays.asList(34962L,34963L).contains(view.get("target")));}
            Set<String> textures=new HashSet<>();List<Object> images=optional(root.get("images"),16);
            for(Object raw:images){String uri=text(fields(raw,new String[]{"uri"}).get("uri"));require(uri.matches("[a-z0-9][a-z0-9_-]{0,63}\\.(png|jpg|webp)")&&textures.add(uri));}
            if(declaredTextures!=null)require(textures.equals(declaredTextures));List<Object> textureRows=optional(root.get("textures"),16),materials=optional(root.get("materials"),64),samplers=optional(root.get("samplers"),16);
            for(Object raw:textureRows){Map<String,Object> row=fields(raw,new String[]{"source"},"sampler");integer(row.get("source"),0,images.size()-1);if(row.get("sampler")!=null)integer(row.get("sampler"),0,samplers.size()-1);}
            for(Object raw:samplers){Map<String,Object> row=fields(raw,new String[]{},"magFilter","minFilter","wrapS","wrapT");if(row.get("magFilter")!=null)require(Arrays.asList(9728L,9729L).contains(row.get("magFilter")));if(row.get("minFilter")!=null)require(Arrays.asList(9728L,9729L,9984L,9985L,9986L,9987L).contains(row.get("minFilter")));for(String field:new String[]{"wrapS","wrapT"})if(row.get(field)!=null)require(Arrays.asList(33071L,33648L,10497L).contains(row.get(field)));}
            for(Object raw:materials){Map<String,Object> material=fields(raw,new String[]{},"name","pbrMetallicRoughness","doubleSided");require(material.get("doubleSided")==null||material.get("doubleSided") instanceof Boolean);Map<String,Object> pbr=fields(material.get("pbrMetallicRoughness")==null?Collections.emptyMap():material.get("pbrMetallicRoughness"),new String[]{},"baseColorFactor","metallicFactor","roughnessFactor","baseColorTexture");
                if(pbr.get("baseColorFactor")!=null){List<Object> color=array(pbr.get("baseColorFactor"),4);require(color.size()==4);for(Object value:color)finite(value,0,1);require(((Number)color.get(3)).doubleValue()==1);}
                for(String factor:new String[]{"metallicFactor","roughnessFactor"})if(pbr.get(factor)!=null)finite(pbr.get(factor),0,1);
                if(pbr.get("baseColorTexture")!=null){Map<String,Object> texture=fields(pbr.get("baseColorTexture"),new String[]{"index"},"texCoord");integer(texture.get("index"),0,textureRows.size()-1);require(number(texture,"texCoord",0,0,0)==0);}
            }
            List<Accessor> accessors=new ArrayList<>();
            for(Object raw:rawAccessors) {
                Map<String,Object> row=fields(raw,new String[]{"bufferView","componentType","count","type"},"byteOffset","min","max","normalized"),view=object(views.get(integer(row.get("bufferView"),0,views.size()-1)));int bi=integer(view.get("buffer"),0,names.size()-1),viewStart=number(view,"byteOffset",0,0,MAX_ENCODED),viewLength=integer(view.get("byteLength"),1,MAX_ENCODED);
                String type=text(row.get("type"));int components;if("SCALAR".equals(type))components=1;else if("VEC2".equals(type))components=2;else{require("VEC3".equals(type));components=3;}
                int component=integer(row.get("componentType"),5121,5126);require(Arrays.asList(5121,5123,5125,5126).contains(component));int width=component==5126||component==5125?4:component==5123?2:1;
                int start=number(row,"byteOffset",0,0,MAX_ENCODED),count=integer(row.get("count"),1,600000),element=components*width,stride=number(view,"byteStride",element,element,252);
                require(start%width==0&&viewStart%width==0&&stride%width==0&&((long)start+(long)(count-1)*stride+element)<=viewLength&&(row.get("normalized")==null||Boolean.FALSE.equals(row.get("normalized"))));
                accessors.add(new Accessor(names.get(bi),type,viewStart+start,stride,count,component,components,width));
            }
            int triangles=0,primitives=0;long decodedBytes=0;List<Integer> meshTriangles=new ArrayList<>();Set<Accessor> usedAccessors=new LinkedHashSet<>();Set<Integer> usedTextureIndices=new HashSet<>();
            for(Object raw:meshes){int meshTriangleCount=0;for(Object item:array(fields(raw,new String[]{"primitives"},"name").get("primitives"),32)) {
                require(++primitives<=2048);Map<String,Object> primitive=fields(item,new String[]{"attributes","indices"},"mode","material"),attrs=fields(primitive.get("attributes"),new String[]{"POSITION"},"NORMAL","TEXCOORD_0");require(number(primitive,"mode",4,0,6)==4);
                Accessor position=accessors.get(integer(attrs.get("POSITION"),0,accessors.size()-1));require(position.component==5126&&"VEC3".equals(position.type));usedAccessors.add(position);decodedBytes+=(long)position.count*3*4;if(attrs.get("NORMAL")==null)decodedBytes+=(long)position.count*3*4;
                for(String field:new String[]{"NORMAL","TEXCOORD_0"})if(attrs.get(field)!=null){Accessor a=accessors.get(integer(attrs.get(field),0,accessors.size()-1));require(a.component==5126&&("NORMAL".equals(field)?"VEC3":"VEC2").equals(a.type)&&a.count==position.count);usedAccessors.add(a);decodedBytes+=(long)a.count*a.components*4;}
                Accessor a=accessors.get(integer(primitive.get("indices"),0,accessors.size()-1));require("SCALAR".equals(a.type)&&Arrays.asList(5121,5123,5125).contains(a.component));a.indexLimit=a.indexLimit<0?position.count:Math.min(a.indexLimit,position.count);usedAccessors.add(a);decodedBytes+=(long)a.count*4;
                if(primitive.get("material")!=null){Map<String,Object> material=object(materials.get(integer(primitive.get("material"),0,materials.size()-1)));Map<String,Object> pbr=object(material.get("pbrMetallicRoughness")==null?Collections.emptyMap():material.get("pbrMetallicRoughness"));if(pbr.get("baseColorTexture")!=null){require(attrs.get("TEXCOORD_0")!=null);usedTextureIndices.add(integer(object(pbr.get("baseColorTexture")).get("index"),0,textureRows.size()-1));}}require(a.count%3==0);triangles+=a.count/3;meshTriangleCount+=a.count/3;require(triangles<=maxTriangles&&decodedBytes<=maxDecodedBytes);
            }meshTriangles.add(meshTriangleCount);}require(triangles>0);
            List<Object> nodes=array(root.get("nodes"),128),scenes=array(root.get("scenes"),1);require(!nodes.isEmpty()&&scenes.size()==1&&integer(root.get("scene"),0,0)==0);Set<Integer> parents=new HashSet<>();
            for(Object raw:nodes){Map<String,Object> row=fields(raw,new String[]{},"name","mesh","children","translation","rotation","scale");if(row.get("mesh")!=null)integer(row.get("mesh"),0,meshes.size()-1);for(String field:new String[]{"translation","rotation","scale"})if(row.get(field)!=null){int count="rotation".equals(field)?4:3;List<Object> values=array(row.get(field),count);require(values.size()==count);double sum=0;for(Object value:values){double n=finite(value,"rotation".equals(field)?-1:-12,"rotation".equals(field)?1:12);if("scale".equals(field))require(n>0);sum+=n*n;}if("rotation".equals(field))require(Math.abs(Math.sqrt(sum)-1)<.0001);}for(Object child:optional(row.get("children"),128))require(parents.add(integer(child,0,nodes.size()-1)));}
            Set<Integer> seen=new HashSet<>();List<Object> roots=array(fields(scenes.get(0),new String[]{"nodes"},"name").get("nodes"),128);require(!roots.isEmpty());
            for(Object rootIndex:roots){int index=integer(rootIndex,0,nodes.size()-1);require(!parents.contains(index));node(index,nodes,meshes.size(),seen,new HashSet<>(),0);}require(seen.size()==nodes.size());
            long renderedTriangles=0;for(Object raw:nodes){Object mesh=object(raw).get("mesh");if(mesh!=null){renderedTriangles+=meshTriangles.get(integer(mesh,0,meshTriangles.size()-1));require(renderedTriangles<=maxTriangles);}}require(renderedTriangles>0);List<WorldPosition> positions=new ArrayList<>();
            for(Object rootIndex:roots)world(integer(rootIndex,0,nodes.size()-1),nodes,meshes,accessors,identity(),positions);
            Map<String,Integer> textureUses=new HashMap<>();for(int index:usedTextureIndices){Map<String,Object> texture=object(textureRows.get(index)),image=object(images.get(integer(texture.get("source"),0,images.size()-1)));String alias=text(image.get("uri"));textureUses.put(alias,textureUses.getOrDefault(alias,0)+1);}
            Layout layout=new Layout(actualBuffers,new ArrayList<>(usedAccessors),(int)renderedTriangles,textures,(int)decodedBytes,positions,min,max,binStart,textureUses);
            if(binStart>=0){byte[] bin=Arrays.copyOfRange(bytes,binStart,binStart+actualBuffers.get("@glb"));try{layout.decode("@glb",bin);}finally{Arrays.fill(bin,(byte)0);}}
            return layout;
        }finally{if(copied)Arrays.fill(jsonBytes,(byte)0);}
    }
    /** Actual world transforms are retained with each primitive POSITION usage.
     * External buffers are checked after their original claimed acquisition. */
    private static final class WorldPosition {
        final Accessor accessor,indices;final double[] matrix;
        WorldPosition(Accessor accessor,Accessor indices,double[] matrix){this.accessor=accessor;this.indices=indices;this.matrix=matrix.clone();}
    }
    /** Closest point to origin in the triangle's Voronoi regions. */
    static double triangleDistanceSquared(double[] a,double[] b,double[] c)throws Exception {
        double abx=b[0]-a[0],aby=b[1]-a[1],abz=b[2]-a[2],acx=c[0]-a[0],acy=c[1]-a[1],acz=c[2]-a[2];
        double cx=aby*acz-abz*acy,cy=abz*acx-abx*acz,cz=abx*acy-aby*acx;require(cx*cx+cy*cy+cz*cz>1e-20);
        double d1=-abx*a[0]-aby*a[1]-abz*a[2],d2=-acx*a[0]-acy*a[1]-acz*a[2];if(d1<=0&&d2<=0)return squared(a[0],a[1],a[2]);
        double d3=-abx*b[0]-aby*b[1]-abz*b[2],d4=-acx*b[0]-acy*b[1]-acz*b[2];if(d3>=0&&d4<=d3)return squared(b[0],b[1],b[2]);
        double vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){double v=d1/(d1-d3);return squared(a[0]+abx*v,a[1]+aby*v,a[2]+abz*v);}
        double d5=-abx*c[0]-aby*c[1]-abz*c[2],d6=-acx*c[0]-acy*c[1]-acz*c[2];if(d6>=0&&d5<=d6)return squared(c[0],c[1],c[2]);
        double vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){double w=d2/(d2-d6);return squared(a[0]+acx*w,a[1]+acy*w,a[2]+acz*w);}
        double va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){double w=(d4-d3)/((d4-d3)+(d5-d6));return squared(b[0]+(c[0]-b[0])*w,b[1]+(c[1]-b[1])*w,b[2]+(c[2]-b[2])*w);}
        double inverse=1/(va+vb+vc),v=vb*inverse,w=vc*inverse;return squared(a[0]+abx*v+acx*w,a[1]+aby*v+acy*w,a[2]+abz*v+acz*w);
    }
    private static double squared(double x,double y,double z){return x*x+y*y+z*z;}
    private static double[] identity(){return new double[]{1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1};}
    private static double[] multiply(double[] a,double[] b)throws Exception {
        double[] result=new double[16];for(int c=0;c<4;c++)for(int r=0;r<4;r++){for(int k=0;k<4;k++)result[r+4*c]+=a[r+4*k]*b[k+4*c];require(Double.isFinite(result[r+4*c]));}return result;
    }
    private static double[] transform(Map<String,Object> node)throws Exception {
        double[] t={0,0,0},q={0,0,0,1},s={1,1,1};
        for(String name:new String[]{"translation","rotation","scale"})if(node.get(name)!=null){List<Object> values=array(node.get(name),"rotation".equals(name)?4:3);double[] output="translation".equals(name)?t:"rotation".equals(name)?q:s;require(values.size()==output.length);for(int k=0;k<output.length;k++)output[k]=finite(values.get(k),"rotation".equals(name)?-1:-12,"rotation".equals(name)?1:12);}
        double x=q[0],y=q[1],z=q[2],w=q[3],xx=2*x*x,xy=2*x*y,xz=2*x*z,yy=2*y*y,yz=2*y*z,zz=2*z*z,wx=2*w*x,wy=2*w*y,wz=2*w*z;
        return new double[]{(1-yy-zz)*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,(xy-wz)*s[1],(1-xx-zz)*s[1],(yz+wx)*s[1],0,(xz+wy)*s[2],(yz-wx)*s[2],(1-xx-yy)*s[2],0,t[0],t[1],t[2],1};
    }
    private static void world(int index,List<Object> nodes,List<Object> meshes,List<Accessor> accessors,double[] parent,List<WorldPosition> positions)throws Exception {
        Map<String,Object> node=object(nodes.get(index));double[] matrix=multiply(parent,transform(node));
        if(node.get("mesh")!=null){Map<String,Object> mesh=object(meshes.get(integer(node.get("mesh"),0,meshes.size()-1)));for(Object raw:array(mesh.get("primitives"),32)){Map<String,Object> primitive=object(raw),attrs=object(primitive.get("attributes"));positions.add(new WorldPosition(accessors.get(integer(attrs.get("POSITION"),0,accessors.size()-1)),accessors.get(integer(primitive.get("indices"),0,accessors.size()-1)),matrix));}}
        for(Object child:optional(node.get("children"),128))world(integer(child,0,nodes.size()-1),nodes,meshes,accessors,matrix,positions);
    }
    private static void node(int index,List<Object> nodes,int meshes,Set<Integer> seen,Set<Integer> path,int depth)throws Exception {
        require(depth<=16&&path.add(index)&&seen.add(index));for(Object child:optional(object(nodes.get(index)).get("children"),128))node(integer(child,0,nodes.size()-1),nodes,meshes,seen,path,depth+1);path.remove(index);
    }

    static void preflight(byte[] bytes,String mime)throws Exception {
        require(bytes!=null&&bytes.length>0&&bytes.length<=MAX_ENCODED);
        if(modelMime(mime)){importModel(bytes,mime,null,null,67108864,200000);return;}
        if("application/octet-stream".equals(mime))return;
        PlanetChildMedia.preflight(bytes,mime);
    }
}
