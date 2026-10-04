import Foundation
import CoreFoundation
import CryptoKit
import Capacitor

/** App-private QA bytes. The shared verifier owns signature and content policy;
 * this queue owns byte integrity, atomic selection and protected pruning. */
@objc(PlanetContentStorePlugin)
public class PlanetContentStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PlanetContentStorePlugin"
    public let jsName = "PlanetContentStore"
    public let pluginMethods: [CAPPluginMethod] = ["read", "write", "list", "remove", "commit", "retire", "capacity"].map {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    private static let io = DispatchQueue(label: "ru.probpera.literaryplanet.content-store")
    private static let prefix = "literary-planet-content-qa-v1-"
    private static let maxFile = 16 * 1024 * 1024
    private static let maxPackage = 64 * 1024 * 1024 + 256 * 1024
    private static let maxSafeInteger: Int64 = 9007199254740991
    private enum Failure: Error { case invalid }
    private struct Generation: Decodable, Equatable { let sha256: String; let version: Int64 }
    private struct Selection: Decodable {
        let schemaVersion: Int; let epoch: Int64?; let retired: Bool?
        let current: Generation; let previous: Generation?
        var storedEpoch: Int64 { epoch ?? 0 }
        var isRetired: Bool { retired ?? false }
    }
    private struct Receipt: Decodable { let key: String; let bytes: Int; let sha256: String }
    private struct Candidate: Decodable { let name: String; let entries: [Receipt] }

    private func queued(_ call: CAPPluginCall, _ operation: @escaping () throws -> JSObject) {
        Self.io.async {
            do { call.resolve(try operation()) }
            catch { call.reject("Native content storage operation failed", "CONTENT_STORAGE_UNAVAILABLE") }
        }
    }
    private func require(_ condition: Bool) throws { if !condition { throw Failure.invalid } }
    private func matches(_ value: String, _ pattern: String) -> Bool {
        value.range(of: "\\A" + pattern + "\\z", options: .regularExpression) != nil
    }
    private func scope(_ name: String) -> Bool { matches(name, Self.prefix + "[a-f0-9]{64}") }
    private func generation(_ name: String) -> Bool { matches(name, Self.prefix + "[a-f0-9]{64}-[a-f0-9]{64}") }
    private func hash(_ bytes: Data) -> String { SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined() }
    private func key(_ suffix: String) -> String { hash(Data(("https://localhost/__literary_content_qa__/" + suffix).utf8)) }
    @objc func capacity(_ call: CAPPluginCall) {
        queued(call) {
            let volume = URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
            let values = try volume.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
            guard let available = values.volumeAvailableCapacityForImportantUsage else { throw Failure.invalid }
            try self.require(available >= 0 && available <= 9007199254740991)
            return ["availableBytes": NSNumber(value: available)]
        }
    }
    private func root() throws -> URL {
        let manager = FileManager.default
        let parent = try manager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).resolvingSymlinksInPath()
        var target = parent.appendingPathComponent("literary-planet-content-qa-v1", isDirectory: true)
        try require(target.standardizedFileURL == target.resolvingSymlinksInPath().standardizedFileURL)
        try manager.createDirectory(at: target, withIntermediateDirectories: false)
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try target.setResourceValues(values)
        return target
    }
    private func directory(_ name: String, create: Bool) throws -> URL {
        try require(scope(name) || generation(name))
        let target = try root().appendingPathComponent(name, isDirectory: true)
        try require(target.standardizedFileURL == target.resolvingSymlinksInPath().standardizedFileURL)
        if create { try FileManager.default.createDirectory(at: target, withIntermediateDirectories: false) }
        return target
    }
    private func entry(_ name: String, _ entryKey: String, create: Bool) throws -> URL {
        try require(matches(entryKey, "[a-f0-9]{64}"))
        let target = try directory(name, create: create).appendingPathComponent(entryKey)
        try require(target.standardizedFileURL == target.resolvingSymlinksInPath().standardizedFileURL)
        return target
    }
    private func readBytes(_ name: String, _ entryKey: String, maximum: Int) throws -> Data? {
        let target = try entry(name, entryKey, create: false)
        if !FileManager.default.fileExists(atPath: target.path) { return nil }
        let file = try FileHandle(forReadingFrom: target)
        defer { try? file.close() }
        var data = Data()
        while let chunk = try file.read(upToCount: min(8192, maximum + 1 - data.count)), !chunk.isEmpty {
            data.append(chunk); try require(data.count <= maximum)
        }
        return data
    }
    private func writeBytes(_ name: String, _ entryKey: String, _ data: Data) throws {
        try require(!data.isEmpty && data.count <= Self.maxFile)
        try data.write(to: entry(name, entryKey, create: true), options: .atomic)
    }
    private func selection(_ data: Data) throws -> Selection {
        try require(!data.isEmpty && data.count <= 1024)
        guard let shape = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw Failure.invalid }
        let value = try JSONDecoder().decode(Selection.self, from: data)
        if value.schemaVersion == 1 {
            try require(Set(shape.keys) == Set(["schemaVersion", "current", "previous"]))
        } else {
            try require(value.schemaVersion == 2 && Set(shape.keys) == Set(["schemaVersion", "epoch", "retired", "current", "previous"]))
            try require(value.epoch != nil && value.storedEpoch >= 1 && value.storedEpoch <= Self.maxSafeInteger && value.retired != nil)
            if value.isRetired { try require(value.previous == nil) }
        }
        for name in ["current", "previous"] where !(shape[name] is NSNull) {
            guard let record = shape[name] as? [String: Any] else { throw Failure.invalid }
            try require(Set(record.keys) == Set(["sha256", "version"]))
        }
        for item in [value.current, value.previous].compactMap({ $0 }) {
            try require(matches(item.sha256, "[a-f0-9]{64}") && item.version >= 1 && item.version <= Self.maxSafeInteger)
        }
        if let prior = value.previous { try require(prior.version < value.current.version && prior.sha256 != value.current.sha256) }
        return value
    }
    private func fencedSelection(_ call: CAPPluginCall, _ name: String) throws -> Selection? {
        var expectedEpoch: Int64 = 0
        if let raw = call.options["epoch"] {
            guard let value = raw as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID() else { throw Failure.invalid }
            let number = value.doubleValue
            try require(number.isFinite && number >= 0 && number <= Double(Self.maxSafeInteger) && number.rounded(.down) == number)
            expectedEpoch = value.int64Value
        }
        let bytes = try readBytes(String(name.prefix(Self.prefix.count + 64)), key("selection.json"), maximum: 1024)
        let selected = try bytes.map { try selection($0) }
        try require(expectedEpoch == (selected?.storedEpoch ?? 0))
        return selected
    }
    @objc func read(_ call: CAPPluginCall) {
        queued(call) {
            guard let name = call.getString("name"), let entryKey = call.getString("key") else { throw Failure.invalid }
            let bytes = try self.readBytes(name, entryKey, maximum: Self.maxFile)
            return ["base64": bytes.map { $0.base64EncodedString() as JSValue } ?? NSNull()]
        }
    }
    @objc func write(_ call: CAPPluginCall) {
        queued(call) {
            guard let name = call.getString("name"), let entryKey = call.getString("key"), let encoded = call.getString("base64") else { throw Failure.invalid }
            try self.require(self.generation(name) && encoded.utf8.count <= ((Self.maxFile + 2) / 3) * 4)
            _ = try self.fencedSelection(call, name)
            guard let bytes = Data(base64Encoded: encoded) else { throw Failure.invalid }
            try self.writeBytes(name, entryKey, bytes)
            return [:]
        }
    }
    @objc func list(_ call: CAPPluginCall) {
        queued(call) {
            let names = try FileManager.default.contentsOfDirectory(atPath: self.root().path).filter { self.scope($0) || self.generation($0) }
            for name in names { _ = try self.directory(name, create: false) }
            return ["names": names]
        }
    }
    @objc func remove(_ call: CAPPluginCall) {
        queued(call) {
            guard let name = call.getString("name") else { throw Failure.invalid }
            try self.require(self.generation(name))
            let digest = String(name.suffix(64))
            if let selected = try self.fencedSelection(call, name), !selected.isRetired {
                if selected.current.sha256 == digest || selected.previous?.sha256 == digest { return ["removed": false] }
            }
            let target = try self.directory(name, create: false), manager = FileManager.default
            if !manager.fileExists(atPath: target.path) { return ["removed": false] }
            let files = try manager.contentsOfDirectory(atPath: target.path)
            // Never recursively delete an unexpected directory or follow a link.
            for file in files {
                try self.require(self.matches(file, "[a-f0-9]{64}"))
                let path = try self.entry(name, file, create: false)
                var isDirectory: ObjCBool = false
                try self.require(manager.fileExists(atPath: path.path, isDirectory: &isDirectory) && !isDirectory.boolValue)
            }
            for file in files { try manager.removeItem(at: self.entry(name, file, create: false)) }
            try manager.removeItem(at: target)
            return ["removed": true]
        }
    }
    @objc func retire(_ call: CAPPluginCall) {
        queued(call) {
            guard let input = call.options as? JSObject else { throw Failure.invalid }
            try self.require(Set(input.keys) == Set(["name", "key", "expectedSha256", "json"]))
            guard let name = call.getString("name"), let pointerKey = call.getString("key"), let expected = call.getString("expectedSha256"), let json = call.getString("json") else { throw Failure.invalid }
            try self.require(self.scope(name) && pointerKey == self.key("selection.json") && self.matches(expected, "[a-f0-9]{64}"))
            let bytes = Data(json.utf8), next = try self.selection(bytes)
            guard let old = try self.readBytes(name, pointerKey, maximum: 1024), self.hash(old) == expected else { return ["retired": false] }
            let before = try self.selection(old)
            try self.require(!before.isRetired && next.isRetired && before.storedEpoch < Self.maxSafeInteger && next.storedEpoch == before.storedEpoch + 1)
            try self.require(next.current == before.current && next.previous == nil)
            try self.writeBytes(name, pointerKey, bytes)
            try self.require(self.readBytes(name, pointerKey, maximum: 1024) == bytes)
            return ["retired": true]
        }
    }
    @objc func commit(_ call: CAPPluginCall) {
        queued(call) {
            guard let name = call.getString("name"), let pointerKey = call.getString("key"), let json = call.getString("json"), let candidateObject = call.getObject("candidate") else { throw Failure.invalid }
            let expected = call.getString("expectedSha256")
            try self.require(self.scope(name) && pointerKey == self.key("selection.json"))
            try self.require(call.options["expectedSha256"] != nil && (expected == nil || self.matches(expected!, "[a-f0-9]{64}")))
            let bytes = Data(json.utf8), next = try self.selection(bytes)
            let old = try self.readBytes(name, pointerKey, maximum: 1024)
            if old.map({ self.hash($0) }) != expected { return ["committed": false] }
            try self.require(!next.isRetired)
            if let old = old {
                let before = try self.selection(old)
                try self.require(next.storedEpoch == before.storedEpoch)
                if before.isRetired {
                    try self.require(next.previous == nil && (next.current == before.current || next.current.version > before.current.version))
                } else if before.current == next.current { try self.require(before.previous == next.previous) }
                else { try self.require(next.current.version > before.current.version && next.previous == before.current) }
            } else { try self.require(next.storedEpoch == 0 && next.previous == nil) }
            let candidate = try JSONDecoder().decode(Candidate.self, from: JSONSerialization.data(withJSONObject: candidateObject))
            try self.require(candidate.name == name + "-" + next.current.sha256 && candidate.entries.count >= 4 && candidate.entries.count <= 130)
            var seen = Set<String>(), total = 0
            for receipt in candidate.entries {
                try self.require(receipt.bytes > 0 && receipt.bytes <= Self.maxFile && self.matches(receipt.sha256, "[a-f0-9]{64}") && seen.insert(receipt.key).inserted)
                total += receipt.bytes; try self.require(total <= Self.maxPackage)
                guard let stored = try self.readBytes(candidate.name, receipt.key, maximum: receipt.bytes) else { throw Failure.invalid }
                try self.require(stored.count == receipt.bytes && self.hash(stored) == receipt.sha256)
            }
            try self.require(seen.contains(self.key("signature.json")) && seen.contains(self.key("complete.json")))
            try self.writeBytes(name, pointerKey, bytes)
            try self.require(self.readBytes(name, pointerKey, maximum: 1024) == bytes)
            return ["committed": true]
        }
    }
}

@objc(PlanetBridgeViewController)
class PlanetBridgeViewController: CAPBridgeViewController {
    private let planetChild=PlanetChildPlugin()
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PlanetContentStorePlugin())
        bridge?.registerPluginInstance(PlanetSecureStorePlugin())
        bridge?.registerPluginInstance(planetChild)
    }
    override func viewWillDisappear(_ animated: Bool) { planetChild.nativeViewWillDisappear();super.viewWillDisappear(animated) }
}
