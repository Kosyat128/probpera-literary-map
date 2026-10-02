import Foundation
import Security
import Capacitor

/** Shared OS core, including the executable test fixture. Production creates
 * only the canonical service; a QA service requires an explicit Debug test run.
 * No UserDefaults/plaintext fallback, synchronization or shared access group. */
final class PlanetKeychainStore {
    private static let lock = NSRecursiveLock()
    private static let maxBytes = 131072
    private enum Failure: Error { case unavailable }
    private let service: String
    private let syntheticRunId: String?
    init(syntheticRunId: String? = nil) throws {
        guard let bundle = Bundle.main.bundleIdentifier else { throw Failure.unavailable }
        if let runId = syntheticRunId {
            #if DEBUG
            guard bundle == "ru.probpera.literaryplanet", runId.range(of: "\\A[a-f0-9]{32}\\z", options: .regularExpression) != nil,
                  ProcessInfo.processInfo.environment["LITERARY_PLANET_SECURE_TEST_RUN_ID"] == runId else { throw Failure.unavailable }
            service = bundle + ".literary-planet-secure-runtime-" + runId
            #else
            throw Failure.unavailable
            #endif
        } else { service = bundle + ".literary-planet-session-v1" }
        self.syntheticRunId = syntheticRunId
    }
    private func query(_ key: String?) throws -> [String: Any] {
        guard let key else { throw Failure.unavailable }
        if let runId = syntheticRunId { guard key == "secure-runtime-v1:" + runId else { throw Failure.unavailable } }
        else { guard key.range(of: "\\Aauth-(session|pkce|user)-v1:[a-z0-9]{20}\\z", options: .regularExpression) != nil else { throw Failure.unavailable } }
        return [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                kSecAttrAccount as String: key, kSecAttrSynchronizable as String: false]
    }
    func get(_ key: String?) throws -> String? {
        Self.lock.lock(); defer { Self.lock.unlock() }
        var request = try query(key); request[kSecReturnData as String] = true; request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data, !data.isEmpty, data.count <= Self.maxBytes,
              let value = String(data: data, encoding: .utf8) else { throw Failure.unavailable }
        return value
    }
    func set(_ key: String?, _ value: String?) throws {
        Self.lock.lock(); defer { Self.lock.unlock() }
        let request = try query(key)
        guard let value, !value.isEmpty, value.utf8.count <= Self.maxBytes else { throw Failure.unavailable }
        let changes: [String: Any] = [kSecValueData as String: Data(value.utf8), kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        var status = SecItemUpdate(request as CFDictionary, changes as CFDictionary)
        if status == errSecItemNotFound {
            var item = request; for (name, value) in changes { item[name] = value }
            status = SecItemAdd(item as CFDictionary, nil)
        }
        guard status == errSecSuccess, try get(key) == value else { throw Failure.unavailable }
    }
    func remove(_ key: String?) throws {
        Self.lock.lock(); defer { Self.lock.unlock() }
        let status = SecItemDelete(try query(key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound, try get(key) == nil else { throw Failure.unavailable }
    }
    #if DEBUG
    func corruptSyntheticValue(_ key: String) throws {
        Self.lock.lock(); defer { Self.lock.unlock() }
        guard syntheticRunId != nil, SecItemUpdate(try query(key) as CFDictionary, [kSecValueData as String: Data([0xff])] as CFDictionary) == errSecSuccess else { throw Failure.unavailable }
    }
    #endif
}

/** Device-only Keychain session capability; not child authority/anti-rollback. */
@objc(PlanetSecureStorePlugin)
public class PlanetSecureStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PlanetSecureStorePlugin"
    public let jsName = "PlanetSecureStore"
    public let pluginMethods = ["get", "set", "remove"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private static let io = DispatchQueue(label: "ru.probpera.literaryplanet.secure-store")
    private func queued(_ call: CAPPluginCall, _ work: @escaping () throws -> JSObject) {
        Self.io.async {
            do { call.resolve(try work()) }
            catch { call.reject("Secure storage is unavailable", "SECURE_STORAGE_UNAVAILABLE") }
        }
    }
    @objc func get(_ call: CAPPluginCall) {
        queued(call) {
            if let value = try PlanetKeychainStore().get(call.getString("key")) { return ["value": value] }
            return ["value": NSNull()]
        }
    }
    @objc func set(_ call: CAPPluginCall) {
        queued(call) {
            try PlanetKeychainStore().set(call.getString("key"), call.getString("value"))
            return ["stored": true]
        }
    }
    @objc func remove(_ call: CAPPluginCall) {
        queued(call) {
            try PlanetKeychainStore().remove(call.getString("key"))
            return ["removed": true]
        }
    }
}
