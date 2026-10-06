import Foundation
import CryptoKit

/** Semantic facts only. The protected native store owns these receipts; neither
 * a saved ID nor this codec supplies profile, review, rights or content approval.
 * Old completed nodes remain in Journey.Progress and are never guessed here. */
enum PlanetChildPassport {
    static let maximumCountries=2048,maximumLearning=2048,maximumJourneys=32,maximumBytes=8388608
    static let maximumBadges=256,maximumRoutes=32,maximumRouteBytes=524288,maximumRouteTotalBytes=2097152
    static func checksum(_ value: String) throws { try PlanetChildJourney.require(value.range(of:#"\A[a-f0-9]{64}\z"#,options:.regularExpression) != nil) }
    static func digest(_ bytes: Data) -> String { SHA256.hash(data:bytes).map { String(format:"%02x",$0) }.joined() }
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

    /** Versioned native-earned facts. Titles/approval never enter this ledger. */
    struct Badge: Equatable {
        let badgeId: String,ruleVersion: UInt64,programId: String,programVersion: UInt64,programChecksum: String,reviewChecksum: String
        let journeyId: String,journeyVersion: UInt64,contentVersion: UInt64,nodeIds: [String],displayId: String,displayChecksum: String,trigger: String
        init(badgeId: String,ruleVersion: UInt64,programId: String,programVersion: UInt64,programChecksum: String,reviewChecksum: String,journeyId: String,journeyVersion: UInt64,contentVersion: UInt64,nodeIds: [String],displayId: String,displayChecksum: String,trigger: String) throws {
            for id in [badgeId,programId,journeyId,displayId]+nodeIds { _=try PlanetChildJourney.identifier(id) }
            for value in [ruleVersion,programVersion,journeyVersion,contentVersion] { try PlanetChildJourney.require(value>0 && value<PlanetChildJourney.maxSafe) }
            for value in [programChecksum,reviewChecksum,displayChecksum] { try PlanetChildPassport.checksum(value) }
            try PlanetChildJourney.require(!nodeIds.isEmpty && nodeIds.count<=64 && Set(nodeIds).count==nodeIds.count && ["completed-journey","completed-learning"].contains(trigger))
            self.badgeId=badgeId;self.ruleVersion=ruleVersion;self.programId=programId;self.programVersion=programVersion;self.programChecksum=programChecksum;self.reviewChecksum=reviewChecksum;self.journeyId=journeyId;self.journeyVersion=journeyVersion;self.contentVersion=contentVersion;self.nodeIds=nodeIds;self.displayId=displayId;self.displayChecksum=displayChecksum;self.trigger=trigger
        }
        var identity: String { programId+"\n"+String(programVersion)+"\n"+programChecksum+"\n"+reviewChecksum+"\n"+badgeId+"\n"+String(ruleVersion) }
    }
    /** Actual bounded canonical route bytes, never an offline membership ID. */
    struct SavedRoute: Equatable {
        let journeyId: String,journeyVersion: UInt64,contentVersion: UInt64,packageId: String,packageVersion: UInt64,packageChecksum: String,packageReviewChecksum: String,policyVersion: String,policyChecksum: String,locale: String,exactAge: Int,snapshotChecksum: String
        private(set) var bytes: Data
        init(journeyId: String,journeyVersion: UInt64,contentVersion: UInt64,packageId: String,packageVersion: UInt64,packageChecksum: String,packageReviewChecksum: String,policyVersion: String,policyChecksum: String,locale: String,exactAge: Int,bytes: Data) throws {
            for id in [journeyId,packageId,policyVersion] { _=try PlanetChildJourney.identifier(id) }
            for version in [journeyVersion,contentVersion,packageVersion] { try PlanetChildJourney.require(version>0 && version<PlanetChildJourney.maxSafe) }
            for sum in [packageChecksum,packageReviewChecksum,policyChecksum] { try PlanetChildPassport.checksum(sum) }
            try PlanetChildJourney.require(["ru","en"].contains(locale) && (3...17).contains(exactAge) && !bytes.isEmpty && bytes.count<=PlanetChildPassport.maximumRouteBytes)
            self.journeyId=journeyId;self.journeyVersion=journeyVersion;self.contentVersion=contentVersion;self.packageId=packageId;self.packageVersion=packageVersion;self.packageChecksum=packageChecksum;self.packageReviewChecksum=packageReviewChecksum;self.policyVersion=policyVersion;self.policyChecksum=policyChecksum;self.locale=locale;self.exactAge=exactAge;self.bytes=Data(Array(bytes));self.snapshotChecksum=PlanetChildPassport.digest(bytes)
            try PlanetChildJourney.require(try PlanetChildPassportRouteCodec.validate(bytes,locale:locale)==journeyId)
        }
        mutating func dispose() { bytes.resetBytes(in:0..<bytes.count);bytes.removeAll() }
        func validate() throws { try PlanetChildJourney.require(!bytes.isEmpty && bytes.count<=PlanetChildPassport.maximumRouteBytes && PlanetChildPassport.digest(bytes)==snapshotChecksum);try PlanetChildJourney.require(try PlanetChildPassportRouteCodec.validate(bytes,locale:locale)==journeyId) }
    }
    struct Ledger: Equatable {
        var countries=[String](),learning=[Learning](),completedJourneys=[CompletedJourney]()
        var schemaVersion: UInt64=1,badges=[Badge](),downloadedRoutes=[SavedRoute]()
        func validate() throws {
            try PlanetChildJourney.require(countries.count<=maximumCountries && Set(countries).count==countries.count && learning.count<=maximumLearning && Set(learning.map { $0.identity }).count==learning.count && completedJourneys.count<=maximumJourneys && Set(completedJourneys.map { $0.identity }).count==completedJourneys.count)
            for id in countries { _=try PlanetChildJourney.identifier(id) }
            try PlanetChildJourney.require((schemaVersion==1 || schemaVersion==2) && (schemaVersion==2 || badges.isEmpty && downloadedRoutes.isEmpty) && badges.count<=maximumBadges && Set(badges.map { $0.identity }).count==badges.count && downloadedRoutes.count<=maximumRoutes && Set(downloadedRoutes.map { $0.journeyId+"\n"+$0.locale }).count==downloadedRoutes.count)
            var total=0
            for route in downloadedRoutes { try route.validate();try PlanetChildJourney.require(route.bytes.count<=maximumRouteTotalBytes-total);total+=route.bytes.count }
        }
        mutating func collect(_ awards: [Badge]) throws {
            var next=self
            for award in awards {
                if let old=next.badges.first(where:{ $0.identity==award.identity }) { try PlanetChildJourney.require(old==award) }
                else { try PlanetChildJourney.require(next.badges.count<maximumBadges);next.badges.append(award) }
            }
            if !awards.isEmpty { next.schemaVersion=2 };try next.validate();self=next
        }
        mutating func save(_ route: SavedRoute) throws {
            var next=self;next.schemaVersion=2
            if let index=next.downloadedRoutes.firstIndex(where:{ $0.journeyId==route.journeyId && $0.locale==route.locale }) { next.downloadedRoutes[index].dispose();next.downloadedRoutes[index]=route }
            else { try PlanetChildJourney.require(next.downloadedRoutes.count<maximumRoutes);next.downloadedRoutes.append(route) }
            try next.validate();self=next
        }
        mutating func clearDownloads() { schemaVersion=2;disposeRouteBytes();downloadedRoutes.removeAll() }
        mutating func disposeRouteBytes() { for index in downloadedRoutes.indices { downloadedRoutes[index].dispose() } }
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
            try validate();var w=Writer();try w.number(0x4c504c31,4);try w.number(schemaVersion,1);try w.number(UInt64(countries.count),2)
            for id in countries { try w.text(id) };try w.number(UInt64(learning.count),2)
            for row in learning { try w.text(row.journeyId);try w.text(row.nodeId);try w.number(row.kind=="writer" ? 1:2,1);try w.text(row.entityId);try w.number(row.journeyVersion,8);try w.number(row.contentVersion,8) }
            try w.number(UInt64(completedJourneys.count),1)
            for row in completedJourneys { try w.text(row.journeyId);try w.number(row.journeyVersion,8);try w.number(row.contentVersion,8);try w.number(UInt64(row.nodeIds.count),1);for id in row.nodeIds { try w.text(id) } }
            if schemaVersion==2 {
                try w.number(UInt64(badges.count),2)
                for row in badges { try w.text(row.badgeId);try w.number(row.ruleVersion,8);try w.text(row.programId);try w.number(row.programVersion,8);try w.text(row.programChecksum);try w.text(row.reviewChecksum);try w.text(row.journeyId);try w.number(row.journeyVersion,8);try w.number(row.contentVersion,8);try w.number(UInt64(row.nodeIds.count),1);for node in row.nodeIds { try w.text(node) };try w.text(row.displayId);try w.text(row.displayChecksum);try w.number(row.trigger=="completed-journey" ? 1:2,1) }
                try w.number(UInt64(downloadedRoutes.count),1)
                for row in downloadedRoutes { try w.text(row.journeyId);try w.number(row.journeyVersion,8);try w.number(row.contentVersion,8);try w.text(row.packageId);try w.number(row.packageVersion,8);try w.text(row.packageChecksum);try w.text(row.packageReviewChecksum);try w.text(row.policyVersion);try w.text(row.policyChecksum);try w.text(row.locale);try w.number(UInt64(row.exactAge),1);try w.text(row.snapshotChecksum);try w.number(UInt64(row.bytes.count),4);try w.data(row.bytes) }
            }
            return w.bytes
        }
        static func decode(_ bytes: Data) throws -> Ledger {
            try PlanetChildJourney.require(!bytes.isEmpty && bytes.count<=maximumBytes);var r=Reader(bytes:bytes)
            try PlanetChildJourney.require(try r.number(4)==0x4c504c31);let schema=try r.number(1);try PlanetChildJourney.require(schema==1 || schema==2)
            var value=Ledger();var handed=false;defer { if !handed { value.disposeRouteBytes() } };value.schemaVersion=schema;let countries=try r.number(2);try PlanetChildJourney.require(countries<=UInt64(maximumCountries))
            for _ in 0..<countries { value.countries.append(try r.text()) }
            let count=try r.number(2);try PlanetChildJourney.require(count<=UInt64(maximumLearning))
            for _ in 0..<count { let route=try r.text(),node=try r.text(),kind=try r.number(1);try PlanetChildJourney.require(kind==1 || kind==2);value.learning.append(try Learning(journeyId:route,nodeId:node,kind:kind==1 ? "writer":"work",entityId:r.text(),journeyVersion:r.number(8),contentVersion:r.number(8))) }
            let journeys=try r.number(1);try PlanetChildJourney.require(journeys<=UInt64(maximumJourneys))
            for _ in 0..<journeys { let route=try r.text(),version=try r.number(8),content=try r.number(8),nodes=try r.number(1);try PlanetChildJourney.require(nodes>0 && nodes<=64);var ids=[String]();for _ in 0..<nodes { ids.append(try r.text()) };value.completedJourneys.append(try CompletedJourney(journeyId:route,journeyVersion:version,contentVersion:content,nodeIds:ids)) }
            if schema==2 {
                let count=try r.number(2);try PlanetChildJourney.require(count<=UInt64(maximumBadges))
                for _ in 0..<count {
                    let badge=try r.text(),rule=try r.number(8),program=try r.text(),programVersion=try r.number(8),sum=try r.text(),review=try r.text(),route=try r.text(),version=try r.number(8),content=try r.number(8),count=try r.number(1);try PlanetChildJourney.require(count>0 && count<=64)
                    var nodes=[String]();for _ in 0..<count { nodes.append(try r.text()) };let display=try r.text(),displaySum=try r.text(),trigger=try r.number(1);try PlanetChildJourney.require(trigger==1 || trigger==2)
                    value.badges.append(try Badge(badgeId:badge,ruleVersion:rule,programId:program,programVersion:programVersion,programChecksum:sum,reviewChecksum:review,journeyId:route,journeyVersion:version,contentVersion:content,nodeIds:nodes,displayId:display,displayChecksum:displaySum,trigger:trigger==1 ? "completed-journey":"completed-learning"))
                }
                let routes=try r.number(1);try PlanetChildJourney.require(routes<=UInt64(maximumRoutes));var total=0
                for _ in 0..<routes {
                    let id=try r.text(),version=try r.number(8),content=try r.number(8),package=try r.text(),packageVersion=try r.number(8),sum=try r.text(),review=try r.text(),policy=try r.text(),policySum=try r.text(),locale=try r.text(),age=try r.number(1),snapshotSum=try r.text(),size=try r.number(4)
                    try PlanetChildJourney.require(size>0 && size<=UInt64(maximumRouteBytes) && size<=UInt64(maximumRouteTotalBytes-total));total+=Int(size)
                    var snapshot=try r.data(Int(size));defer { snapshot.resetBytes(in:0..<snapshot.count) }
                    let route=try SavedRoute(journeyId:id,journeyVersion:version,contentVersion:content,packageId:package,packageVersion:packageVersion,packageChecksum:sum,packageReviewChecksum:review,policyVersion:policy,policyChecksum:policySum,locale:locale,exactAge:Int(age),bytes:snapshot);try PlanetChildJourney.require(route.snapshotChecksum==snapshotSum);value.downloadedRoutes.append(route)
                }
            }
            try PlanetChildJourney.require(r.position==bytes.count);try value.validate();var exact=try value.encoded();defer { exact.resetBytes(in:0..<exact.count) };try PlanetChildJourney.require(exact==bytes);handed=true;return value
        }
    }
    private struct Writer {
        var bytes=Data()
        mutating func number(_ value: UInt64,_ count: Int) throws { try PlanetChildJourney.require(bytes.count+count<=maximumBytes);for shift in stride(from:(count-1)*8,through:0,by:-8) { bytes.append(UInt8(truncatingIfNeeded:value>>shift)) } }
        mutating func data(_ value: Data) throws { try PlanetChildJourney.require(value.count<=maximumBytes-bytes.count);bytes.append(value) }
        mutating func text(_ value: String) throws { let data=Data(value.utf8);try PlanetChildJourney.require(!data.isEmpty && data.count<=96 && bytes.count+data.count+2<=maximumBytes);try number(UInt64(data.count),2);bytes.append(data) }
    }
    private struct Reader {
        let bytes: Data;var position=0
        mutating func number(_ count: Int) throws -> UInt64 { try PlanetChildJourney.require(count>0 && count<=bytes.count-position);var value: UInt64=0;for _ in 0..<count { value=(value<<8)|UInt64(bytes[position]);position+=1 };return value }
        mutating func data(_ count: Int) throws -> Data { try PlanetChildJourney.require(count>=0 && count<=bytes.count-position);defer { position+=count };return Data(bytes[position..<position+count]) }
        mutating func text() throws -> String { let count=try number(2);try PlanetChildJourney.require(count>0 && count<=96 && count<=UInt64(bytes.count-position));defer { position+=Int(count) };guard let value=String(data:bytes[position..<position+Int(count)],encoding:.utf8) else { throw PlanetChildJourney.Failure.unavailable };return value }
    }
}
