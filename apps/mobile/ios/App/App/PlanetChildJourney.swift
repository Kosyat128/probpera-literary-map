import Foundation
import CoreFoundation

/** Separately versioned semantic state. Only stable IDs are persisted; saved
 * state never supplies child-content, profile or approval authorization. */
enum PlanetChildJourney {
    enum Failure: Error { case unavailable }
    static let maxSafe: UInt64=9007199254740991,maximumBytes=7168,maximumNodes=64
    static func require(_ value: Bool) throws { if !value { throw Failure.unavailable } }
    static func identifier(_ value: String) throws -> String { try require(value.range(of:#"\A[A-Za-z0-9][A-Za-z0-9._-]{0,95}\z"#,options:.regularExpression) != nil);return value }
    static func next(_ value: UInt64) throws -> UInt64 { try require(value<maxSafe-1);return value+1 }
    struct Progress: Equatable {
        let journeyId: String,journeyVersion: UInt64,contentVersion: UInt64,currentNodeId: String?,completedNodeIds: [String],selectedCountryId: String?,selectedWriterId: String?,selectedWorkId: String?,lastSafeRoute: String
        init(journeyId: String,journeyVersion: UInt64,contentVersion: UInt64,currentNodeId: String?,completedNodeIds: [String],selectedCountryId: String?,selectedWriterId: String?,selectedWorkId: String?,lastSafeRoute: String) throws {
            _=try PlanetChildJourney.identifier(journeyId);try PlanetChildJourney.require(journeyVersion>0 && journeyVersion<PlanetChildJourney.maxSafe && contentVersion>0 && contentVersion<PlanetChildJourney.maxSafe)
            for id in [currentNodeId,selectedCountryId,selectedWriterId,selectedWorkId].compactMap({ $0 }) { _=try PlanetChildJourney.identifier(id) }
            try PlanetChildJourney.require(completedNodeIds.count<=PlanetChildJourney.maximumNodes && Set(completedNodeIds).count==completedNodeIds.count && ["journey","home"].contains(lastSafeRoute))
            for id in completedNodeIds { _=try PlanetChildJourney.identifier(id) }
            self.journeyId=journeyId;self.journeyVersion=journeyVersion;self.contentVersion=contentVersion;self.currentNodeId=currentNodeId;self.completedNodeIds=completedNodeIds;self.selectedCountryId=selectedCountryId;self.selectedWriterId=selectedWriterId;self.selectedWorkId=selectedWorkId;self.lastSafeRoute=lastSafeRoute
        }
        var dto: [String:Any] { ["schemaVersion":1,"journeyId":journeyId,"journeyVersion":journeyVersion,"contentVersion":contentVersion,"currentNodeId":currentNodeId as Any? ?? NSNull(),"completedNodeIds":completedNodeIds,"selectedCountryId":selectedCountryId as Any? ?? NSNull(),"selectedWriterId":selectedWriterId as Any? ?? NSNull(),"selectedWorkId":selectedWorkId as Any? ?? NSNull(),"lastSafeRoute":lastSafeRoute] }
        func encoded() throws -> Data {
            var w=Writer();try w.number(0x4c504a31,4);try w.number(1,1);try w.text(journeyId);try w.number(journeyVersion,8);try w.number(contentVersion,8);try w.optional(currentNodeId);try w.number(UInt64(completedNodeIds.count),1)
            for id in completedNodeIds { try w.text(id) };try w.optional(selectedCountryId);try w.optional(selectedWriterId);try w.optional(selectedWorkId);try w.number(lastSafeRoute=="journey" ? 1:0,1);return w.bytes
        }
        static func decode(_ bytes: Data) throws -> Progress {
            try PlanetChildJourney.require(!bytes.isEmpty && bytes.count<=PlanetChildJourney.maximumBytes);var r=Reader(bytes:bytes)
            try PlanetChildJourney.require(try r.number(4)==0x4c504a31 && r.number(1)==1);let journey=try r.text(),version=try r.number(8),content=try r.number(8),current=try r.optional(),count=try r.number(1);try PlanetChildJourney.require(count<=64)
            var completed=[String]();for _ in 0..<count { completed.append(try r.text()) };let country=try r.optional(),writer=try r.optional(),work=try r.optional(),route=try r.number(1);try PlanetChildJourney.require(route<=1 && r.position==bytes.count)
            let result=try Progress(journeyId:journey,journeyVersion:version,contentVersion:content,currentNodeId:current,completedNodeIds:completed,selectedCountryId:country,selectedWriterId:writer,selectedWorkId:work,lastSafeRoute:route==1 ? "journey":"home");var exact=try result.encoded();defer { exact.resetBytes(in:0..<exact.count) };try PlanetChildJourney.require(exact==bytes);return result
        }
        static func decodeDTO(_ raw: Any) throws -> Progress {
            guard let row=raw as? [String:Any],Set(row.keys)==Set(["schemaVersion","journeyId","journeyVersion","contentVersion","currentNodeId","completedNodeIds","selectedCountryId","selectedWriterId","selectedWorkId","lastSafeRoute"]),let completed=row["completedNodeIds"] as? [String] else { throw Failure.unavailable }
            func number(_ raw: Any?,_ minimum: UInt64=1) throws -> UInt64 { guard let n=raw as? NSNumber,CFGetTypeID(n) != CFBooleanGetTypeID(),n.doubleValue.isFinite,n.doubleValue.rounded(.towardZero)==n.doubleValue,n.doubleValue>=Double(minimum),n.doubleValue<Double(PlanetChildJourney.maxSafe) else { throw Failure.unavailable };return n.uint64Value }
            func text(_ raw: Any?) throws -> String { guard let s=raw as? String else { throw Failure.unavailable };return s }
            func optional(_ raw: Any?) throws -> String? { if raw is NSNull { return nil };return try text(raw) }
            try PlanetChildJourney.require(try number(row["schemaVersion"])==1)
            return try Progress(journeyId:text(row["journeyId"]),journeyVersion:number(row["journeyVersion"]),contentVersion:number(row["contentVersion"]),currentNodeId:optional(row["currentNodeId"]),completedNodeIds:completed,selectedCountryId:optional(row["selectedCountryId"]),selectedWriterId:optional(row["selectedWriterId"]),selectedWorkId:optional(row["selectedWorkId"]),lastSafeRoute:text(row["lastSafeRoute"]))
        }
    }
    /** Pure migration cannot admit content. Native graph compilation supplies
     * these current ordered IDs; completed IDs survive removed content. */
    static func migrate(_ saved: Progress?,journeyId: String,version: UInt64,nodeIds: [String],kinds: [String],restart: Bool=false) throws -> Progress {
        try require(!nodeIds.isEmpty && nodeIds.count<=64 && kinds.count==nodeIds.count && Set(nodeIds).count==nodeIds.count && !nodeIds.contains(journeyId))
        for node in nodeIds { _=try identifier(node) }
        guard let saved,saved.journeyId==journeyId else { return try Progress(journeyId:journeyId,journeyVersion:version,contentVersion:version,currentNodeId:nodeIds[0],completedNodeIds:[],selectedCountryId:nil,selectedWriterId:nil,selectedWorkId:nil,lastSafeRoute:"journey") }
        var current=saved.currentNodeId
        if restart { current=nodeIds[0] }
        else if current==nil { current=nodeIds.first(where:{ !saved.completedNodeIds.contains($0) }) }
        else if !nodeIds.contains(current!) {
            current=saved.completedNodeIds.reversed().first(where:{ nodeIds.contains($0) }) ?? nodeIds.first(where:{ !saved.completedNodeIds.contains($0) })
        }
        return try Progress(journeyId:journeyId,journeyVersion:version,contentVersion:version,currentNodeId:current,completedNodeIds:saved.completedNodeIds,selectedCountryId:saved.selectedCountryId,selectedWriterId:saved.selectedWriterId,selectedWorkId:saved.selectedWorkId,lastSafeRoute:"journey")
    }
    static func selectCurrent(_ saved: Progress,nodeId: String?,kind: String?) throws -> Progress {
        try require(nodeId==saved.currentNodeId)
        return try Progress(journeyId:saved.journeyId,journeyVersion:saved.journeyVersion,contentVersion:saved.contentVersion,currentNodeId:saved.currentNodeId,completedNodeIds:saved.completedNodeIds,selectedCountryId:kind=="country" ? nodeId:saved.selectedCountryId,selectedWriterId:kind=="writer" ? nodeId:saved.selectedWriterId,selectedWorkId:kind=="work" ? nodeId:saved.selectedWorkId,lastSafeRoute:saved.lastSafeRoute)
    }
    static func complete(_ saved: Progress,nodeIds: [String],currentNodeId: String,kind: String?=nil) throws -> Progress {
        try require(!nodeIds.isEmpty && nodeIds.count<=64 && Set(nodeIds).count==nodeIds.count && !nodeIds.contains(saved.journeyId));for node in nodeIds { _=try identifier(node) }
        guard saved.currentNodeId==currentNodeId,let position=nodeIds.firstIndex(of:currentNodeId) else { throw Failure.unavailable }
        var done=saved.completedNodeIds;if !done.contains(currentNodeId) { try require(done.count<64);done.append(currentNodeId) }
        let next=position+1<nodeIds.count ? nodeIds[position+1]:nodeIds.first(where:{ !done.contains($0) })
        return try Progress(journeyId:saved.journeyId,journeyVersion:saved.journeyVersion,contentVersion:saved.contentVersion,currentNodeId:next,completedNodeIds:done,selectedCountryId:kind=="country" ? currentNodeId:saved.selectedCountryId,selectedWriterId:kind=="writer" ? currentNodeId:saved.selectedWriterId,selectedWorkId:kind=="work" ? currentNodeId:saved.selectedWorkId,lastSafeRoute:"journey")
    }
    private struct Writer {
        var bytes=Data()
        mutating func number(_ value: UInt64,_ count: Int) throws { try PlanetChildJourney.require(bytes.count+count<=PlanetChildJourney.maximumBytes);for shift in stride(from:(count-1)*8,through:0,by:-8) { bytes.append(UInt8(truncatingIfNeeded:value>>shift)) } }
        mutating func text(_ value: String) throws { let data=Data(value.utf8);try PlanetChildJourney.require(!data.isEmpty && data.count<=96 && bytes.count+data.count+2<=PlanetChildJourney.maximumBytes);try number(UInt64(data.count),2);bytes.append(data) }
        mutating func optional(_ value: String?) throws { try number(value==nil ? 0:1,1);if let value { try text(value) } }
    }
    private struct Reader {
        let bytes: Data;var position=0
        mutating func number(_ count: Int) throws -> UInt64 { try PlanetChildJourney.require(count>0 && count<=bytes.count-position);var value: UInt64=0;for _ in 0..<count { value=(value<<8)|UInt64(bytes[position]);position+=1 };return value }
        mutating func text() throws -> String { let count=try number(2);try PlanetChildJourney.require(count>0 && count<=96 && count<=UInt64(bytes.count-position));defer { position+=Int(count) };guard let value=String(data:bytes[position..<position+Int(count)],encoding:.utf8) else { throw Failure.unavailable };return value }
        mutating func optional() throws -> String? { let flag=try number(1);try PlanetChildJourney.require(flag<=1);return flag==0 ? nil:try text() }
    }
}
