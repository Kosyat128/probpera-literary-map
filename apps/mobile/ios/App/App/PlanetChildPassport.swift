import Foundation

/** Semantic facts only. The protected native store owns these receipts; neither
 * a saved ID nor this codec supplies profile, review, rights or content approval.
 * Old completed nodes remain in Journey.Progress and are never guessed here. */
enum PlanetChildPassport {
    static let maximumCountries=2048,maximumLearning=2048,maximumJourneys=32,maximumBytes=2097152
    struct Learning: Equatable {
        let journeyId: String,nodeId: String,kind: String,entityId: String,journeyVersion: UInt64,contentVersion: UInt64
        init(journeyId: String,nodeId: String,kind: String,entityId: String,journeyVersion: UInt64,contentVersion: UInt64) throws {
            _=try PlanetChildJourney.identifier(journeyId);_=try PlanetChildJourney.identifier(nodeId);_=try PlanetChildJourney.identifier(entityId)
            try PlanetChildJourney.require(["writer","work"].contains(kind) && journeyVersion>0 && journeyVersion<PlanetChildJourney.maxSafe && contentVersion>0 && contentVersion<PlanetChildJourney.maxSafe)
            self.journeyId=journeyId;self.nodeId=nodeId;self.kind=kind;self.entityId=entityId;self.journeyVersion=journeyVersion;self.contentVersion=contentVersion
        }
        var identity: String { journeyId+"\n"+String(journeyVersion)+"\n"+String(contentVersion)+"\n"+nodeId }
    }
    struct CompletedJourney: Equatable {
        let journeyId: String,journeyVersion: UInt64,contentVersion: UInt64,nodeIds: [String]
        init(journeyId: String,journeyVersion: UInt64,contentVersion: UInt64,nodeIds: [String]) throws {
            _=try PlanetChildJourney.identifier(journeyId)
            try PlanetChildJourney.require(journeyVersion>0 && journeyVersion<PlanetChildJourney.maxSafe && contentVersion>0 && contentVersion<PlanetChildJourney.maxSafe && !nodeIds.isEmpty && nodeIds.count<=64 && Set(nodeIds).count==nodeIds.count)
            for id in nodeIds { _=try PlanetChildJourney.identifier(id) }
            self.journeyId=journeyId;self.journeyVersion=journeyVersion;self.contentVersion=contentVersion;self.nodeIds=nodeIds
        }
        var identity: String { journeyId+"\n"+String(journeyVersion)+"\n"+String(contentVersion) }
    }
    struct Ledger: Equatable {
        var countries=[String](),learning=[Learning](),completedJourneys=[CompletedJourney]()
        func validate() throws {
            try PlanetChildJourney.require(countries.count<=maximumCountries && Set(countries).count==countries.count && learning.count<=maximumLearning && Set(learning.map { $0.identity }).count==learning.count && completedJourneys.count<=maximumJourneys && Set(completedJourneys.map { $0.identity }).count==completedJourneys.count)
            for id in countries { _=try PlanetChildJourney.identifier(id) }
        }
        mutating func openCountry(_ id: String) throws {
            _=try PlanetChildJourney.identifier(id)
            if !countries.contains(id) { try PlanetChildJourney.require(countries.count<maximumCountries);countries.append(id) }
            try validate()
        }
        mutating func complete(_ learning: Learning?,_ journey: CompletedJourney?) throws {
            // Validate a value copy first: a full archive or conflicting fact
            // must not partially append the other half of this completion.
            var next=self
            if let learning { if let old=next.learning.first(where:{ $0.identity==learning.identity }) { try PlanetChildJourney.require(old==learning) } else { try PlanetChildJourney.require(next.learning.count<maximumLearning);next.learning.append(learning) } }
            if let journey {
                if let old=next.completedJourneys.first(where:{ $0.identity==journey.identity }) { try PlanetChildJourney.require(old==journey) }
                else { try PlanetChildJourney.require(next.completedJourneys.count<maximumJourneys);next.completedJourneys.append(journey) }
            }
            try next.validate();self=next
        }
        func encoded() throws -> Data {
            try validate();var w=Writer();try w.number(0x4c504c31,4);try w.number(1,1);try w.number(UInt64(countries.count),2)
            for id in countries { try w.text(id) };try w.number(UInt64(learning.count),2)
            for row in learning { try w.text(row.journeyId);try w.text(row.nodeId);try w.number(row.kind=="writer" ? 1:2,1);try w.text(row.entityId);try w.number(row.journeyVersion,8);try w.number(row.contentVersion,8) }
            try w.number(UInt64(completedJourneys.count),1)
            for row in completedJourneys { try w.text(row.journeyId);try w.number(row.journeyVersion,8);try w.number(row.contentVersion,8);try w.number(UInt64(row.nodeIds.count),1);for id in row.nodeIds { try w.text(id) } }
            return w.bytes
        }
        static func decode(_ bytes: Data) throws -> Ledger {
            try PlanetChildJourney.require(!bytes.isEmpty && bytes.count<=maximumBytes);var r=Reader(bytes:bytes)
            try PlanetChildJourney.require(try r.number(4)==0x4c504c31 && r.number(1)==1)
            var value=Ledger();let countries=try r.number(2);try PlanetChildJourney.require(countries<=UInt64(maximumCountries))
            for _ in 0..<countries { value.countries.append(try r.text()) }
            let count=try r.number(2);try PlanetChildJourney.require(count<=UInt64(maximumLearning))
            for _ in 0..<count { let route=try r.text(),node=try r.text(),kind=try r.number(1);try PlanetChildJourney.require(kind==1 || kind==2);value.learning.append(try Learning(journeyId:route,nodeId:node,kind:kind==1 ? "writer":"work",entityId:r.text(),journeyVersion:r.number(8),contentVersion:r.number(8))) }
            let journeys=try r.number(1);try PlanetChildJourney.require(journeys<=UInt64(maximumJourneys))
            for _ in 0..<journeys { let route=try r.text(),version=try r.number(8),content=try r.number(8),nodes=try r.number(1);try PlanetChildJourney.require(nodes>0 && nodes<=64);var ids=[String]();for _ in 0..<nodes { ids.append(try r.text()) };value.completedJourneys.append(try CompletedJourney(journeyId:route,journeyVersion:version,contentVersion:content,nodeIds:ids)) }
            try PlanetChildJourney.require(r.position==bytes.count);try value.validate();var exact=try value.encoded();defer { exact.resetBytes(in:0..<exact.count) };try PlanetChildJourney.require(exact==bytes);return value
        }
    }
    private struct Writer {
        var bytes=Data()
        mutating func number(_ value: UInt64,_ count: Int) throws { try PlanetChildJourney.require(bytes.count+count<=maximumBytes);for shift in stride(from:(count-1)*8,through:0,by:-8) { bytes.append(UInt8(truncatingIfNeeded:value>>shift)) } }
        mutating func text(_ value: String) throws { let data=Data(value.utf8);try PlanetChildJourney.require(!data.isEmpty && data.count<=96 && bytes.count+data.count+2<=maximumBytes);try number(UInt64(data.count),2);bytes.append(data) }
    }
    private struct Reader {
        let bytes: Data;var position=0
        mutating func number(_ count: Int) throws -> UInt64 { try PlanetChildJourney.require(count>0 && count<=bytes.count-position);var value: UInt64=0;for _ in 0..<count { value=(value<<8)|UInt64(bytes[position]);position+=1 };return value }
        mutating func text() throws -> String { let count=try number(2);try PlanetChildJourney.require(count>0 && count<=96 && count<=UInt64(bytes.count-position));defer { position+=Int(count) };guard let value=String(data:bytes[position..<position+Int(count)],encoding:.utf8) else { throw PlanetChildJourney.Failure.unavailable };return value }
    }
}
