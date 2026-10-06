import Foundation
import CoreFoundation

/** Pure typed import probe. This code grants no native acquisition capability;
 * the original Vault ResourceClaim validates every byte and current authority. */
enum PlanetChildModelImport {
    /** Cache framing only. Authority, full dependency decode and scene commit
     * are checked independently on the original claimed acquisition path. */
    static func cached(_ bytes: Data,_ mime: String) throws {
        try require(!bytes.isEmpty && bytes.count<=33554432)
        if mime=="model/gltf+json" || mime=="model/gltf-binary" { try container(bytes,mime) }
        else if mime != "application/octet-stream" { _=try PlanetChildLocalV2MediaCodec.preflight(bytes,mime) }
    }
    private static func container(_ bytes: Data,_ mime: String) throws {
        let raw: [String:Any]
        if mime=="model/gltf-binary" { try require(bytes.count>=28 && u32(bytes,0)==0x46546c67 && u32(bytes,4)==2 && Int(u32(bytes,8))==bytes.count);let n=Int(try u32(bytes,12));try require(n>0 && n<=1048576 && 20+n<=bytes.count);raw=try json(Data(bytes[20..<20+n])) } else { raw=try json(bytes) }
        let entity: [String:Any]=["kind":"stand","id":"cache-framing","contentChecksum":String(repeating:"0",count:64)]
        var dependencies=[Resource]()
        for (i,b) in try array(raw["buffers"],16).enumerated() { let row=try object(b,["byteLength"],["uri"]);if let alias=row["uri"] { dependencies.append(Resource(id:"cache-buffer-"+String(i),entity:entity,mime:"application/octet-stream",checksum:String(repeating:"0",count:64),bytes:try integer(row["byteLength"],1,33554432),alias:try text(alias,"[a-z0-9][a-z0-9_-]{0,63}\\.bin"),kind:"buffer")) } }
        for (i,b) in try array(raw["images"] ?? [],16).enumerated() { let row=try object(b,["uri"]),alias=try text(row["uri"],"[a-z0-9][a-z0-9_-]{0,63}\\.(png|jpg|webp)");dependencies.append(Resource(id:"cache-image-"+String(i),entity:entity,mime:alias.hasSuffix(".png") ? "image/png":alias.hasSuffix(".jpg") ? "image/jpeg":"image/webp",checksum:String(repeating:"0",count:64),bytes:1,alias:alias,kind:"texture")) }
        let descriptor=Model(slot:"stand",model:Resource(id:"cache-model",entity:entity,mime:mime,checksum:String(repeating:"0",count:64),bytes:bytes.count,alias:"cache."+(mime=="model/gltf-binary" ? "glb":"gltf"),kind:"model"),dependencies:dependencies,min:[-12,-12,-12],max:[12,12,12])
        _=try model(bytes,descriptor,Tier(id:"economy",decodedBytes:67108864,triangles:200000,models:[descriptor]))
    }
    enum Failure: Error { case refused }
    struct Resource {
        let id: String, entity: [String:Any], mime: String, checksum: String, bytes: Int, alias: String, kind: String
    }
    struct Model { let slot: String, model: Resource, dependencies: [Resource], min: [Double], max: [Double] }
    struct Tier { let id: String, decodedBytes: Int, triangles: Int, models: [Model] }
    struct Package { let id: String, version: Int64, tiers: [Tier] }
    static func require(_ ok: Bool) throws { if !ok { throw Failure.refused } }
    static func object(_ raw: Any?,_ required: [String],_ optional: [String]=[]) throws -> [String:Any] {
        guard let row=raw as? [String:Any],Set(required).isSubset(of:Set(row.keys)),Set(row.keys).isSubset(of:Set(required+optional)) else { throw Failure.refused };return row
    }
    static func array(_ raw: Any?,_ max: Int) throws -> [Any] { guard let a=raw as? [Any],a.count<=max else { throw Failure.refused };return a }
    static func number(_ raw: Any?,_ min: Double,_ max: Double) throws -> Double {
        guard let n=raw as? NSNumber,CFGetTypeID(n) != CFBooleanGetTypeID(),n.doubleValue.isFinite,n.doubleValue>=min,n.doubleValue<=max,!(n.doubleValue==0 && n.doubleValue.sign == .minus) else { throw Failure.refused };return n.doubleValue
    }
    static func integer(_ raw: Any?,_ min: Int,_ max: Int) throws -> Int { let n=try number(raw,Double(min),Double(max));try require(n.rounded(.towardZero)==n);return Int(n) }
    static func boolean(_ raw: Any?) throws -> Bool { guard let n=raw as? NSNumber,CFGetTypeID(n)==CFBooleanGetTypeID() else { throw Failure.refused };return n.boolValue }
    static func text(_ raw: Any?,_ pattern: String) throws -> String { guard let s=raw as? String,s.range(of:"^(?:"+pattern+")$",options:.regularExpression) != nil else { throw Failure.refused };return s }
    static func resource(_ raw: Any,_ slot: String) throws -> Resource {
        let r=try object(raw,["assetId","entity","mime","checksum","encodedBytes","alias","kind"]),e=try object(r["entity"],["kind","id","contentChecksum"])
        try require(e["kind"] as? String==slot);_ = try text(e["id"],"[A-Za-z0-9][A-Za-z0-9._-]{0,95}");_ = try text(e["contentChecksum"],"[a-f0-9]{64}")
        let mime=try text(r["mime"],"model/gltf\\+json|model/gltf-binary|application/octet-stream|image/png|image/jpeg|image/webp"),kind=try text(r["kind"],"model|buffer|texture"),alias=try text(r["alias"],"[a-z0-9][a-z0-9_-]{0,63}\\.(gltf|glb|bin|png|jpg|webp)")
        let ext=["model/gltf+json":"gltf","model/gltf-binary":"glb","application/octet-stream":"bin","image/png":"png","image/jpeg":"jpg","image/webp":"webp"][mime]!
        try require(alias.hasSuffix("."+ext) && (kind=="model" ? mime.hasPrefix("model/"):kind=="buffer" ? mime=="application/octet-stream":mime.hasPrefix("image/")))
        return Resource(id:try text(r["assetId"],"[A-Za-z0-9][A-Za-z0-9._-]{0,95}"),entity:e,mime:mime,checksum:try text(r["checksum"],"[a-f0-9]{64}"),bytes:try integer(r["encodedBytes"],1,33554432),alias:alias,kind:kind)
    }
    static func package(_ raw: Any) throws -> Package {
        let p=try object(raw,["schemaVersion","packageId","packageVersion","minAppVersion","formatProfile","tiers"]);try require(integer(p["schemaVersion"],1,1)==1 && integer(p["minAppVersion"],1,1)==1 && p["formatProfile"] as? String=="gltf2-static-v1")
        let id=try text(p["packageId"],"[A-Za-z0-9][A-Za-z0-9._-]{0,95}"),version=try integer(p["packageVersion"],1,9007199254740991),rows=try array(p["tiers"],3);try require(rows.count==3)
        var tiers=[Tier](),identities=[String:String]()
        for (i,rawTier) in rows.enumerated() {
            let t=try object(rawTier,["tier","maxDecodedBytes","maxTriangles","models"]),tier=["high","balanced","economy"][i];try require(t["tier"] as? String==tier)
            var models=[Model](),slots=Set<String>(),encoded=0
            for rawModel in try array(t["models"],2) {
                let m=try object(rawModel,["slotId","model","dependencies","bounds"]),slot=try text(m["slotId"],"stand|background"),b=try object(m["bounds"],["min","max"])
                let min=try array(b["min"],3).map { try number($0,-12,12) },max=try array(b["max"],3).map { try number($0,-12,12) };try require(min.count==3 && max.count==3 && slots.insert(slot).inserted && (0..<3).allSatisfy { min[$0]<=max[$0] })
                if slot=="stand" { try require(max[1]<=(-1.05)) }
                let model=try resource(m["model"]!,slot);try require(model.kind=="model");var deps=[Resource](),aliases=Set([model.alias]),ids=Set([model.id])
                for d in try array(m["dependencies"],16) { let r=try resource(d,slot);try require(r.kind != "model" && aliases.insert(r.alias).inserted && ids.insert(r.id).inserted);try require(r.kind != "texture" || r.mime != "image/webp" || tier=="economy");deps.append(r) }
                for r in [model]+deps {
                    let e=try JSONSerialization.data(withJSONObject:r.entity,options:.sortedKeys),identity=String(decoding:e,as:UTF8.self)+"/"+r.mime+"/"+r.checksum+"/"+String(r.bytes)+"/"+r.kind
                    try require(identities[r.id]==nil || identities[r.id]==identity);identities[r.id]=identity;encoded+=r.bytes
                }
                models.append(Model(slot:slot,model:model,dependencies:deps,min:min,max:max))
            }
            try require(!models.isEmpty && encoded<=67108864 && identities.count<=64)
            tiers.append(Tier(id:tier,decodedBytes:try integer(t["maxDecodedBytes"],1,67108864),triangles:try integer(t["maxTriangles"],1,200000),models:models))
        }
        return Package(id:id,version:Int64(version),tiers:tiers)
    }
    static func json(_ data: Data) throws -> [String:Any] {
        try require(!data.isEmpty && data.count<=1048576);guard let s=String(data:data,encoding:.utf8) else { throw Failure.refused }
        let regex=try NSRegularExpression(pattern:"\"(?:\\\\.|[^\"\\\\])*\"|[{}\\[\\],:]|-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?")
        var stack=[Set<String>?](),key=false,tokens=0
        for match in regex.matches(in:s,range:NSRange(s.startIndex...,in:s)) {
            tokens+=1;try require(tokens<=100000);let token=String(s[Range(match.range,in:s)!])
            if token=="{" { stack.append(Set());key=true } else if token=="[" { stack.append(nil);key=false }
            else if token=="}" || token=="]" { try require(!stack.isEmpty);stack.removeLast();key=false }
            else if token=="," { key=stack.last.map { $0 != nil } ?? false } else if token==":" { key=false }
            else if token.hasPrefix("\"") && key { let v=try JSONSerialization.jsonObject(with:Data(token.utf8),options:.fragmentsAllowed);guard let name=v as? String,var set=stack.last ?? nil,!set.contains(name) else { throw Failure.refused };set.insert(name);stack[stack.count-1]=set;key=false }
            try require(stack.count<=16)
        }
        return try object(JSONSerialization.jsonObject(with:data),[],Array((try JSONSerialization.jsonObject(with:data) as? [String:Any] ?? [:]).keys))
    }
    static func u32(_ data: Data,_ at: Int) throws -> UInt32 { try require(at>=0 && at+4<=data.count);return (0..<4).reduce(UInt32(0)) { $0 | UInt32(data[at+$1]) << UInt32(8*$1) } }
    struct WorldPosition { let accessor: Int,indices: Int,matrix: [Double] }
    struct Probe {
        let document: [String:Any],sources: [[String:Any]],views: [[String:Any]],accessors: [[String:Any]],model: Model,tier: Tier,internalBytes: Data?
        let decodedBytes: Int,triangles: Int,positions: [WorldPosition],binStart: Int?,textureUses: [String:Int]
        /** Own acquired output copies only; no URI or JS-supplied geometry. */
        func closure(_ encodedModel: Data,_ external: [String:Data],_ current: () throws -> Void) throws {
            try current();var sourceBytes=[Data](),offsets=[Int](),lengths=[Int]();let expected=Set(sources.compactMap { $0["uri"] as? String });try PlanetChildModelImport.require(Set(external.keys)==expected)
            for source in sources {
                let length=try PlanetChildModelImport.integer(source["byteLength"],1,33554432)
                if let alias=source["uri"] as? String { guard let bytes=external[alias] else { throw Failure.refused };try decodeBuffer(sourceBytes.count,bytes,current);sourceBytes.append(bytes);offsets.append(0) }
                else { guard let start=binStart else { throw Failure.refused };try PlanetChildModelImport.require(start>=0 && start<=encodedModel.count-length);sourceBytes.append(encodedModel);offsets.append(start) }
                lengths.append(length);try current()
            }
            func layout(_ ix: Int,_ index: Bool) throws -> (Int,Int,Int,Int,Int) {
                let a=accessors[ix],v=views[try PlanetChildModelImport.integer(a["bufferView"],0,views.count-1)],source=try PlanetChildModelImport.integer(v["buffer"],0,sources.count-1),component=try PlanetChildModelImport.integer(a["componentType"],5121,5126),size=component==5121 ? 1:component==5123 ? 2:4
                let start=try PlanetChildModelImport.integer(v["byteOffset"] ?? 0,0,33554432)+PlanetChildModelImport.integer(a["byteOffset"] ?? 0,0,33554432),stride=try PlanetChildModelImport.integer(v["byteStride"] ?? (index ? size:12),index ? size:12,252),count=try PlanetChildModelImport.integer(a["count"],1,600000);return (source,start,stride,count,size)
            }
            var rendered=0
            for position in positions {
                let v=try layout(position.accessor,false),ix=try layout(position.indices,true),m=position.matrix
                func point(_ n: Int) throws -> Point {
                    try PlanetChildModelImport.require(n>=0 && n<v.3);let at=v.1+n*v.2;try PlanetChildModelImport.require(at>=0 && at<=lengths[v.0]-12)
                    let bytes=sourceBytes[v.0],base=offsets[v.0]+at,x=Double(Float(bitPattern:try PlanetChildModelImport.u32(bytes,base))),y=Double(Float(bitPattern:try PlanetChildModelImport.u32(bytes,base+4))),z=Double(Float(bitPattern:try PlanetChildModelImport.u32(bytes,base+8)))
                    let p=Point(x:m[0]*x+m[4]*y+m[8]*z+m[12],y:m[1]*x+m[5]*y+m[9]*z+m[13],z:m[2]*x+m[6]*y+m[10]*z+m[14]),values=[p.x,p.y,p.z]
                    for k in 0..<3 { try PlanetChildModelImport.require(values[k].isFinite && abs(values[k])<=12 && values[k]>=model.min[k]-0.0001 && values[k]<=model.max[k]+0.0001) };return p
                }
                func index(_ n: Int) throws -> Int {
                    let at=ix.1+n*ix.2;try PlanetChildModelImport.require(n>=0 && n<ix.3 && at>=0 && at<=lengths[ix.0]-ix.4);let bytes=sourceBytes[ix.0],base=offsets[ix.0]+at;var value: UInt32=0
                    for k in 0..<ix.4 { value |= UInt32(bytes[base+k]) << UInt32(8*k) };try PlanetChildModelImport.require(Int(value)<v.3);return Int(value)
                }
                for n in 0..<v.3 { if (n & 1023)==0 { try current() };_ = try point(n) }
                try PlanetChildModelImport.require(ix.3%3==0)
                for n in stride(from:0,to:ix.3,by:3) {
                    if (rendered & 255)==0 { try current() };let distance=try PlanetChildModelImport.triangleDistance(try point(index(n)),try point(index(n+1)),try point(index(n+2)))
                    if model.slot=="background" { try PlanetChildModelImport.require(distance.isFinite && distance>=1.35*1.35-1e-8) };rendered+=1;try PlanetChildModelImport.require(rendered<=triangles)
                }
            }
            try PlanetChildModelImport.require(rendered==triangles && rendered>0);try current()
        }
        func buffer(_ alias: String,_ bytes: Data) throws {
            guard let index=sources.firstIndex(where: { $0["uri"] as? String==alias }) else { throw Failure.refused };try decodeBuffer(index,bytes)
        }
        func decodeBuffer(_ index: Int,_ bytes: Data,_ current: () throws -> Void = {}) throws {
            let length=try PlanetChildModelImport.integer(sources[index]["byteLength"],1,33554432);try PlanetChildModelImport.require(sources[index]["uri"] != nil ? bytes.count==length:bytes.count>=length && bytes.count-length<4)
            let meshes=try PlanetChildModelImport.array(document["meshes"],64)
            var usages=[(Int,Bool,Int)]()
            for m in meshes { let row=try PlanetChildModelImport.object(m,["primitives"],["name"])
                for p in try PlanetChildModelImport.array(row["primitives"],32) { let prim=try PlanetChildModelImport.object(p,["attributes","indices"],["mode","material"]),a=try PlanetChildModelImport.object(prim["attributes"],["POSITION"],["NORMAL","TEXCOORD_0"]),pi=try PlanetChildModelImport.integer(a["POSITION"],0,accessors.count-1),count=try PlanetChildModelImport.integer(accessors[pi]["count"],1,600000)
                    for (name,value) in a { let ix=try PlanetChildModelImport.integer(value,0,accessors.count-1);usages.append((ix,false,name=="TEXCOORD_0" ? 2:3)) }
                    let ix=try PlanetChildModelImport.integer(prim["indices"],0,accessors.count-1);usages.append((ix,true,count))
                }
            }
            for (ix,isIndex,limit) in usages {
                let a=accessors[ix],view=views[try PlanetChildModelImport.integer(a["bufferView"],0,views.count-1)];if try PlanetChildModelImport.integer(view["buffer"],0,sources.count-1) != index { continue }
                let component=try PlanetChildModelImport.integer(a["componentType"],5121,5126),size=component==5121 ? 1:component==5123 ? 2:4,width=isIndex ? 1:limit,count=try PlanetChildModelImport.integer(a["count"],1,600000),stride=try PlanetChildModelImport.integer(view["byteStride"] ?? (size*width),size*width,252),start=try PlanetChildModelImport.integer(view["byteOffset"] ?? 0,0,33554432)+PlanetChildModelImport.integer(a["byteOffset"] ?? 0,0,33554432)
                for n in 0..<count { if (n & 1023)==0 { try current() };for c in 0..<width { let at=start+n*stride+c*size
                    if isIndex { var v: UInt32=0;for b in 0..<size { v |= UInt32(bytes[at+b]) << UInt32(b*8) };try PlanetChildModelImport.require(Int(v)<limit) }
                    else { let v=Float(bitPattern:try PlanetChildModelImport.u32(bytes,at));try PlanetChildModelImport.require(v.isFinite && abs(v)<=12) }
                } }
            }
            for position in positions {
                let a=accessors[position.accessor],view=views[try PlanetChildModelImport.integer(a["bufferView"],0,views.count-1)]
                if try PlanetChildModelImport.integer(view["buffer"],0,sources.count-1) != index { continue }
                let count=try PlanetChildModelImport.integer(a["count"],1,600000),stride=try PlanetChildModelImport.integer(view["byteStride"] ?? 12,12,252),start=try PlanetChildModelImport.integer(view["byteOffset"] ?? 0,0,33554432)+PlanetChildModelImport.integer(a["byteOffset"] ?? 0,0,33554432),m=position.matrix
                for n in 0..<count {
                    if (n & 1023)==0 { try current() };let at=start+n*stride,x=Double(Float(bitPattern:try PlanetChildModelImport.u32(bytes,at))),y=Double(Float(bitPattern:try PlanetChildModelImport.u32(bytes,at+4))),z=Double(Float(bitPattern:try PlanetChildModelImport.u32(bytes,at+8)))
                    let point=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]]
                    for k in 0..<3 { try PlanetChildModelImport.require(point[k].isFinite && abs(point[k])<=12 && point[k]>=model.min[k]-0.0001 && point[k]<=model.max[k]+0.0001) }
                }
            }
        }
    }
    fileprivate struct Point {
        let x: Double,y: Double,z: Double
        func sub(_ p: Point) -> Point { Point(x:x-p.x,y:y-p.y,z:z-p.z) }
        func dot(_ p: Point) -> Double { x*p.x+y*p.y+z*p.z }
        func at(_ edge: Point,_ t: Double) -> Point { Point(x:x+edge.x*t,y:y+edge.y*t,z:z+edge.z*t) }
        var squared: Double { dot(self) }
    }
    static func triangleDistanceSquared(_ a: [Double],_ b: [Double],_ c: [Double]) throws -> Double {
        try require(a.count==3 && b.count==3 && c.count==3);return try triangleDistance(Point(x:a[0],y:a[1],z:a[2]),Point(x:b[0],y:b[1],z:b[2]),Point(x:c[0],y:c[1],z:c[2]))
    }
    fileprivate static func triangleDistance(_ a: Point,_ b: Point,_ c: Point) throws -> Double {
        let ab=b.sub(a),ac=c.sub(a),cross=Point(x:ab.y*ac.z-ab.z*ac.y,y:ab.z*ac.x-ab.x*ac.z,z:ab.x*ac.y-ab.y*ac.x);try require(cross.squared>1e-20)
        let ap=Point(x:-a.x,y:-a.y,z:-a.z),d1=ab.dot(ap),d2=ac.dot(ap);if d1<=0 && d2<=0 { return a.squared }
        let bp=Point(x:-b.x,y:-b.y,z:-b.z),d3=ab.dot(bp),d4=ac.dot(bp);if d3>=0 && d4<=d3 { return b.squared }
        let vc=d1*d4-d3*d2;if vc<=0 && d1>=0 && d3<=0 { return a.at(ab,d1/(d1-d3)).squared }
        let cp=Point(x:-c.x,y:-c.y,z:-c.z),d5=ab.dot(cp),d6=ac.dot(cp);if d6>=0 && d5<=d6 { return c.squared }
        let vb=d5*d2-d1*d6;if vb<=0 && d2>=0 && d6<=0 { return a.at(ac,d2/(d2-d6)).squared }
        let va=d3*d6-d5*d4;if va<=0 && d4-d3>=0 && d5-d6>=0 { return b.at(c.sub(b),(d4-d3)/((d4-d3)+(d5-d6))).squared }
        let inverse=1/(va+vb+vc);return a.at(ab,vb*inverse).at(ac,vc*inverse).squared
    }
    private static let identity: [Double]=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
    private static func multiply(_ a: [Double],_ b: [Double]) throws -> [Double] {
        var result=[Double](repeating:0,count:16)
        for c in 0..<4 { for r in 0..<4 { for k in 0..<4 { result[r+4*c]+=a[r+4*k]*b[k+4*c] };try require(result[r+4*c].isFinite) } };return result
    }
    private static func transform(_ node: [String:Any]) throws -> [Double] {
        let t=try array(node["translation"] ?? [0,0,0],3).map { try number($0,-12,12) },q=try array(node["rotation"] ?? [0,0,0,1],4).map { try number($0,-1,1) },s=try array(node["scale"] ?? [1,1,1],3).map { try number($0,-12,12) }
        try require(t.count==3 && q.count==4 && s.count==3)
        let x=q[0],y=q[1],z=q[2],w=q[3],xx=2*x*x,xy=2*x*y,xz=2*x*z,yy=2*y*y,yz=2*y*z,zz=2*z*z,wx=2*w*x,wy=2*w*y,wz=2*w*z
        return [(1-yy-zz)*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,(xy-wz)*s[1],(1-xx-zz)*s[1],(yz+wx)*s[1],0,(xz+wy)*s[2],(yz-wx)*s[2],(1-xx-yy)*s[2],0,t[0],t[1],t[2],1]
    }
    static func model(_ bytes: Data,_ model: Model,_ tier: Tier) throws -> Probe {
        try require(bytes.count==model.model.bytes && model.min.count==3 && model.max.count==3 && (0..<3).allSatisfy { model.min[$0].isFinite && model.max[$0].isFinite && model.min[$0]>=(-12) && model.max[$0]<=12 && model.min[$0]<=model.max[$0] });var raw: [String:Any],internalBytes: Data?,binStart: Int?
        defer { if var bin=internalBytes { internalBytes=nil;bin.resetBytes(in:0..<bin.count) } }
        if model.model.mime=="model/gltf-binary" {
            try require(bytes.count>=28 && u32(bytes,0)==0x46546c67 && u32(bytes,4)==2 && Int(u32(bytes,8))==bytes.count)
            let n=Int(try u32(bytes,12));try require(n%4==0 && n<=1048576 && 20+n<=bytes.count && u32(bytes,16)==0x4e4f534a);raw=try json(Data(bytes[20..<20+n]));let at=20+n
            if at<bytes.count { try require(at+8<=bytes.count && u32(bytes,at+4)==0x004e4942);let size=Int(try u32(bytes,at));try require(size%4==0 && at+8+size==bytes.count);internalBytes=Data(bytes[at+8..<bytes.count]);binStart=at+8 }
        } else { try require(model.model.mime=="model/gltf+json");raw=try json(bytes) }
        _ = try object(raw,["asset","scene","scenes","nodes","meshes","buffers","bufferViews","accessors"],["materials","images","textures","samplers"]);let asset=try object(raw["asset"],["version"],["generator"]);try require(asset["version"] as? String=="2.0")
        var declared=[String:Resource]();for r in model.dependencies { try require(declared[r.alias]==nil);declared[r.alias]=r };var used=Set<String>()
        let sources=try array(raw["buffers"],16).enumerated().map { i,b -> [String:Any] in
            let r=try object(b,["byteLength"],["uri"]);_ = try integer(r["byteLength"],1,33554432)
            if let alias=r["uri"] as? String { try require(model.model.mime=="model/gltf+json" && internalBytes==nil && declared[alias]?.kind=="buffer");used.insert(alias);try require(declared[alias]?.bytes==integer(r["byteLength"],1,33554432)) }
            else { try require(model.model.mime=="model/gltf-binary" && r["uri"]==nil && i==0 && internalBytes != nil && (raw["buffers"] as? [Any])?.count==1) };return r
        }
        let views=try array(raw["bufferViews"],256).map { b -> [String:Any] in
            let r=try object(b,["buffer","byteLength"],["byteOffset","byteStride","target"]),index=try integer(r["buffer"],0,sources.count-1),length=try integer(r["byteLength"],1,33554432),start=try integer(r["byteOffset"] ?? 0,0,33554432);try require(start+length<=integer(sources[index]["byteLength"],1,33554432))
            if r["byteStride"] != nil { let stride=try integer(r["byteStride"],4,252);try require(stride%4==0) };if r["target"] != nil { try require([34962,34963].contains(integer(r["target"],34962,34963))) };return r
        }
        let accessors=try array(raw["accessors"],512).map { try object($0,["bufferView","componentType","count","type"],["byteOffset","min","max","normalized"]) };var decoded=0,triangles=0,usedTextureIndices=Set<Int>()
        func accessor(_ value: Any?,_ type: String,_ index: Bool=false) throws -> Int {
            let ix=try integer(value,0,accessors.count-1),a=accessors[ix],view=views[try integer(a["bufferView"],0,views.count-1)],component=try integer(a["componentType"],5121,5126),count=try integer(a["count"],1,600000),size=component==5121 ? 1:component==5123 ? 2:4,width=type=="VEC3" ? 3:type=="VEC2" ? 2:1,stride=try integer(view["byteStride"] ?? (size*width),size*width,252),start=try integer(a["byteOffset"] ?? 0,0,33554432)
            try require(a["type"] as? String==type && (index ? [5121,5123,5125].contains(component):component==5126) && (a["normalized"]==nil || boolean(a["normalized"])==false) && start%size==0 && stride%size==0 && integer(view["byteOffset"] ?? 0,0,33554432)%size==0 && start+(count-1)*stride+size*width<=integer(view["byteLength"],1,33554432));decoded+=count*width*4;try require(decoded<=tier.decodedBytes);return count
        }
        let materials=try array(raw["materials"] ?? [],64),meshes=try array(raw["meshes"],64);var meshTriangles=[Int]()
        for m in meshes { let row=try object(m,["primitives"],["name"]);var meshCount=0;for p in try array(row["primitives"],32) {
            let prim=try object(p,["attributes","indices"],["mode","material"]),a=try object(prim["attributes"],["POSITION"],["NORMAL","TEXCOORD_0"]);try require(prim["mode"]==nil || integer(prim["mode"],4,4)==4)
            let positions=try accessor(a["POSITION"],"VEC3"),indices=try accessor(prim["indices"],"SCALAR",true);try require(indices%3==0);triangles+=indices/3;meshCount+=indices/3
            if a["NORMAL"]==nil { decoded+=positions*12;try require(decoded<=tier.decodedBytes) }
            if a["NORMAL"] != nil { try require(accessor(a["NORMAL"],"VEC3")==positions) };if a["TEXCOORD_0"] != nil { try require(accessor(a["TEXCOORD_0"],"VEC2")==positions) };if let material=prim["material"] { let r=try object(materials[integer(material,0,materials.count-1)],[],["name","pbrMetallicRoughness","doubleSided"]),pbr=try object(r["pbrMetallicRoughness"] ?? [:],[],["baseColorFactor","metallicFactor","roughnessFactor","baseColorTexture"]);if let texture=pbr["baseColorTexture"] { try require(a["TEXCOORD_0"] != nil);let t=try object(texture,["index"],["texCoord"]);usedTextureIndices.insert(try integer(t["index"],0,15)) } }
        };meshTriangles.append(meshCount) };try require(!meshes.isEmpty && triangles>0 && triangles<=tier.triangles)
        let images=try array(raw["images"] ?? [],16),textures=try array(raw["textures"] ?? [],16),samplers=try array(raw["samplers"] ?? [],16)
        for i in images { let r=try object(i,["uri"]),alias=try text(r["uri"],"[a-z0-9][a-z0-9_-]{0,63}\\.(png|jpg|webp)");try require(declared[alias]?.kind=="texture");used.insert(alias) }
        for t in textures { let r=try object(t,["source"],["sampler"]);_ = try integer(r["source"],0,images.count-1);if r["sampler"] != nil { _ = try integer(r["sampler"],0,samplers.count-1) } }
        for s in samplers { let r=try object(s,[],["magFilter","minFilter","wrapS","wrapT"]);for f in ["magFilter","minFilter","wrapS","wrapT"] { if r[f] != nil { let value=try integer(r[f],0,33648),allowed=f=="magFilter" ? [9728,9729]:f=="minFilter" ? [9728,9729,9984,9985,9986,9987]:[33071,33648,10497];try require(allowed.contains(value)) } } }
        for m in materials { let r=try object(m,[],["name","pbrMetallicRoughness","doubleSided"]),pbr=try object(r["pbrMetallicRoughness"] ?? [:],[],["baseColorFactor","metallicFactor","roughnessFactor","baseColorTexture"])
            if r["doubleSided"] != nil { _ = try boolean(r["doubleSided"]) };if let color=pbr["baseColorFactor"] { let c=try array(color,4).map { try number($0,0,1) };try require(c.count==4 && c[3]==1) };for f in ["metallicFactor","roughnessFactor"] { if pbr[f] != nil { _ = try number(pbr[f],0,1) } };if let texture=pbr["baseColorTexture"] { let t=try object(texture,["index"],["texCoord"]);_ = try integer(t["index"],0,textures.count-1);if t["texCoord"] != nil { _ = try integer(t["texCoord"],0,0) } }
        }
        let nodes=try array(raw["nodes"],128).map { try object($0,[],["name","mesh","children","translation","rotation","scale"]) };var parents=Set<Int>()
        for n in nodes { if n["mesh"] != nil { _ = try integer(n["mesh"],0,meshes.count-1) };for (f,width) in [("translation",3),("rotation",4),("scale",3)] { if n[f] != nil { let values=try array(n[f],width).map { try number($0,f=="rotation" ? -1:-12,f=="rotation" ? 1:12) };try require(values.count==width && (f != "scale" || values.allSatisfy { $0>0 }) && (f != "rotation" || abs(sqrt(values.reduce(0) { $0+$1*$1 })-1)<0.0001)) } };for c in try array(n["children"] ?? [],128) { try require(parents.insert(integer(c,0,nodes.count-1)).inserted) } }
        var instanceTriangles=0;for node in nodes { if let ix=node["mesh"] { instanceTriangles+=meshTriangles[try integer(ix,0,meshes.count-1)];try require(instanceTriangles<=tier.triangles) } };try require(instanceTriangles>0)
        let scenes=try array(raw["scenes"],1);try require(scenes.count==1 && integer(raw["scene"],0,0)==0);let roots=try array(object(scenes[0],["nodes"],["name"])["nodes"],128);var seen=Set<Int>()
        func walk(_ ix: Int,_ depth: Int) throws { try require(depth<=16 && seen.insert(ix).inserted);for c in try array(nodes[ix]["children"] ?? [],128) { try walk(integer(c,0,nodes.count-1),depth+1) } }
        for r in roots { let ix=try integer(r,0,nodes.count-1);try require(!parents.contains(ix));try walk(ix,0) };try require(!roots.isEmpty && seen.count==nodes.count && used==Set(declared.keys))
        var positions=[WorldPosition]()
        func world(_ ix: Int,_ parent: [Double]) throws {
            let matrix=try multiply(parent,transform(nodes[ix]))
            if let mesh=nodes[ix]["mesh"] { let row=try object(meshes[integer(mesh,0,meshes.count-1)],["primitives"],["name"]);for p in try array(row["primitives"],32) { let primitive=try object(p,["attributes","indices"],["mode","material"]),attrs=try object(primitive["attributes"],["POSITION"],["NORMAL","TEXCOORD_0"]);positions.append(WorldPosition(accessor:try integer(attrs["POSITION"],0,accessors.count-1),indices:try integer(primitive["indices"],0,accessors.count-1),matrix:matrix)) } }
            for child in try array(nodes[ix]["children"] ?? [],128) { try world(integer(child,0,nodes.count-1),matrix) }
        }
        for root in roots { try world(integer(root,0,nodes.count-1),identity) }
        var textureUses=[String:Int]();for index in usedTextureIndices { try require(index<textures.count);let t=try object(textures[index],["source"],["sampler"]),image=try object(images[integer(t["source"],0,images.count-1)],["uri"]),alias=try text(image["uri"],"[a-z0-9][a-z0-9_-]{0,63}\\.(png|jpg|webp)");textureUses[alias,default:0]+=1 }
        let probe=Probe(document:raw,sources:sources,views:views,accessors:accessors,model:model,tier:tier,internalBytes:nil,decodedBytes:decoded,triangles:instanceTriangles,positions:positions,binStart:binStart,textureUses:textureUses)
        if let internalBytes { try probe.decodeBuffer(0,internalBytes) };return probe
    }
}
