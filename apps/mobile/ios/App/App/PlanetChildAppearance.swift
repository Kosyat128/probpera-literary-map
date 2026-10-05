import Foundation
import CoreFoundation

/** Stable data only. This strict independently versioned typed codec stores
 * no content digest, token, URI, approval, review, bytes or reusable native
 * capability. Only the Vault's live-scene projection authorizes a write. */
enum PlanetChildAppearance {
    enum Failure: Error { case unavailable }
    static let maxSafe: UInt64=9007199254740991,maximumBytes=2048
    static let ownerKinds=Set(["country","writer","biography","work","character","storyworld","fact","quote","activity","quiz","search-result","recommendation","favorite","recent","offline-package","deep-link"])
    static func require(_ valid: Bool) throws { if !valid { throw Failure.unavailable } }
    static func identifier(_ value: String) throws -> String { try require(value.range(of:"\\A[A-Za-z0-9][A-Za-z0-9._-]{0,95}\\z",options:.regularExpression) != nil);return value }
    static func revision(_ value: UInt64) throws { try require(value<maxSafe) }
    static func next(_ value: UInt64) throws -> UInt64 { try require(value<maxSafe-1);return value+1 }
    struct Owner: Equatable { let kind: String,id: String }
    struct Slot: Equatable { let assetId: String,entityId: String }
    struct Geometry: Equatable { let geometryId: String,assetId: String,entityId: String }
    struct Selection: Equatable {
        let sceneId: String,owner: Owner,skin: Slot,stand: Geometry,background: Geometry
        init(sceneId: String,owner: Owner,skin: Slot,stand: Geometry,background: Geometry) throws {
            _=try PlanetChildAppearance.identifier(sceneId);try PlanetChildAppearance.require(PlanetChildAppearance.ownerKinds.contains(owner.kind));_=try PlanetChildAppearance.identifier(owner.id)
            for value in [skin.assetId,skin.entityId,stand.assetId,stand.entityId,background.assetId,background.entityId] { _=try PlanetChildAppearance.identifier(value) }
            try PlanetChildAppearance.require(stand.geometryId=="stand.base.child-book-cloud" && background.geometryId=="background.base.library")
            try PlanetChildAppearance.require(Set([skin.assetId,stand.assetId,background.assetId]).count==3)
            self.sceneId=sceneId;self.owner=owner;self.skin=skin;self.stand=stand;self.background=background
        }
        var dto: [String:Any] { ["schemaVersion":1,"sceneId":sceneId,"owner":["kind":owner.kind,"id":owner.id],"skin":["assetId":skin.assetId,"entityId":skin.entityId],"stand":["geometryId":stand.geometryId,"assetId":stand.assetId,"entityId":stand.entityId],"background":["geometryId":background.geometryId,"assetId":background.assetId,"entityId":background.entityId]] }
        func encoded() throws -> Data {
            var writer=Writer();try writer.number(0x4c505331,4);try writer.number(1,1)
            for value in [sceneId,owner.kind,owner.id,skin.assetId,skin.entityId,stand.geometryId,stand.assetId,stand.entityId,background.geometryId,background.assetId,background.entityId] { try writer.text(value) }
            return writer.bytes
        }
        static func decode(_ data: Data) throws -> Selection {
            try PlanetChildAppearance.require(!data.isEmpty && data.count<=PlanetChildAppearance.maximumBytes);var reader=Reader(bytes:data)
            try PlanetChildAppearance.require(try reader.number(4)==0x4c505331 && reader.number(1)==1)
            let scene=try reader.text(),kind=try reader.text(),id=try reader.text(),skin=try Slot(assetId:reader.text(),entityId:reader.text()),stand=try Geometry(geometryId:reader.text(),assetId:reader.text(),entityId:reader.text()),background=try Geometry(geometryId:reader.text(),assetId:reader.text(),entityId:reader.text())
            try PlanetChildAppearance.require(reader.position==data.count);let result=try Selection(sceneId:scene,owner:Owner(kind:kind,id:id),skin:skin,stand:stand,background:background)
            var exact=try result.encoded();defer { exact.resetBytes(in:0..<exact.count) };try PlanetChildAppearance.require(exact==data);return result
        }
        static func decodeDTO(_ raw: Any) throws -> Selection {
            func object(_ raw: Any?,_ keys: Set<String>) throws -> [String:Any] { guard let row=raw as? [String:Any],Set(row.keys)==keys else { throw Failure.unavailable };return row }
            func text(_ raw: Any?) throws -> String { guard let s=raw as? String else { throw Failure.unavailable };return s }
            let row=try object(raw,["schemaVersion","sceneId","owner","skin","stand","background"])
            guard let schema=row["schemaVersion"] as? NSNumber,CFGetTypeID(schema) != CFBooleanGetTypeID(),schema.doubleValue==1 else { throw Failure.unavailable }
            let owner=try object(row["owner"],["kind","id"]),skin=try object(row["skin"],["assetId","entityId"]),stand=try object(row["stand"],["geometryId","assetId","entityId"]),background=try object(row["background"],["geometryId","assetId","entityId"])
            return try Selection(sceneId:text(row["sceneId"]),owner:Owner(kind:text(owner["kind"]),id:text(owner["id"])),skin:Slot(assetId:text(skin["assetId"]),entityId:text(skin["entityId"])),stand:Geometry(geometryId:text(stand["geometryId"]),assetId:text(stand["assetId"]),entityId:text(stand["entityId"])),background:Geometry(geometryId:text(background["geometryId"]),assetId:text(background["assetId"]),entityId:text(background["entityId"])))
        }
    }
    private struct Writer {
        var bytes=Data()
        mutating func number(_ value: UInt64,_ count: Int) throws { try PlanetChildAppearance.require(bytes.count+count<=PlanetChildAppearance.maximumBytes);for shift in stride(from:(count-1)*8,through:0,by:-8) { bytes.append(UInt8(truncatingIfNeeded:value>>shift)) } }
        mutating func text(_ value: String) throws { var data=Data(value.utf8);defer { data.resetBytes(in:0..<data.count) };try PlanetChildAppearance.require(!data.isEmpty && data.count<=96 && bytes.count+data.count+2<=PlanetChildAppearance.maximumBytes);try number(UInt64(data.count),2);bytes.append(data) }
    }
    private struct Reader {
        let bytes: Data;var position=0
        mutating func number(_ count: Int) throws -> UInt64 { try PlanetChildAppearance.require(count>0 && count<=bytes.count-position);var n: UInt64=0;for _ in 0..<count { n=(n<<8)|UInt64(bytes[position]);position+=1 };return n }
        mutating func text() throws -> String { let count=try number(2);try PlanetChildAppearance.require(count>0 && count<=96 && count<=UInt64(bytes.count-position));defer { position+=Int(count) };guard let text=String(data:bytes[position..<position+Int(count)],encoding:.utf8) else { throw Failure.unavailable };return text }
    }
}
#if DEBUG
/** Owned software scheduling barrier only. It pauses an already genuine
 * native write after readback; it cannot mint/approve any native capability. */
enum PlanetChildAppearanceRuntimeDelay {
    private final class Gate { let condition=NSCondition();let phase: String;var entered=false,resumed=false;init(_ phase: String) { self.phase=phase } }
    private static let lock=NSLock();private static var gates=[String:Gate]()
    static func arm(_ commandId: String,phase: String="readback") throws { try PlanetChildAppearance.require(commandId.range(of:"\\A[a-f0-9]{32}\\z",options:.regularExpression) != nil && ["readback","completion"].contains(phase));lock.lock();defer { lock.unlock() };try PlanetChildAppearance.require(gates.isEmpty);gates[commandId]=Gate(phase) }
    static func entered(_ commandId: String) -> Bool { lock.lock();let gate=gates[commandId];lock.unlock();guard let gate else { return false };gate.condition.lock();defer { gate.condition.unlock() };return gate.entered }
    static func resume(_ commandId: String) { lock.lock();let gate=gates.removeValue(forKey:commandId);lock.unlock();guard let gate else { return };gate.condition.lock();gate.resumed=true;gate.condition.broadcast();gate.condition.unlock() }
    static func hold(_ commandId: String,phase: String="readback") throws {
        lock.lock();let gate=gates[commandId];lock.unlock();guard let gate,gate.phase==phase else { return };try PlanetChildAppearance.require(!Thread.isMainThread);let began=ProcessInfo.processInfo.systemUptime;gate.condition.lock();gate.entered=true;gate.condition.broadcast()
        while !gate.resumed { let now=ProcessInfo.processInfo.systemUptime;guard now>=began,now-began<5 else { gate.condition.unlock();throw PlanetChildAppearance.Failure.unavailable };_ = gate.condition.wait(until:Date(timeIntervalSinceNow:0.01)) };gate.condition.unlock()
    }
}
#endif
