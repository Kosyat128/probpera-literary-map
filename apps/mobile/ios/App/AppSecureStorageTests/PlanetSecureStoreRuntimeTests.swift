import Foundation
import XCTest
import UIKit
import WebKit
@testable import App

/** Synthetic data and an isolated own Keychain service only. Running this
 * target requires explicit per-run environment values; omission fails instead
 * of creating a demonstration PASS. Simulator results are not device proof. */
final class PlanetSecureStoreRuntimeTests: XCTestCase {
    @MainActor func testPreferencePhase() async throws {
        let environment = ProcessInfo.processInfo.environment
        let runId = try XCTUnwrap(environment["LITERARY_PLANET_SECURE_TEST_RUN_ID"]), phase = try XCTUnwrap(environment["LITERARY_PLANET_PREFERENCE_TEST_PHASE"])
        guard runId.range(of: "^[a-f0-9]{32}$", options: .regularExpression) != nil,
              ["write", "read", "remove", "corrupt", "unsupported-language", "unsupported-theme", "parallel", "plugin-failure", "timeout", "absent", "clear"].contains(phase)
        else { XCTFail("Unowned native preference fixture"); return }
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.first as? UIWindowScene)
        let controller = try XCTUnwrap(scene.windows.first(where: { $0.isKeyWindow })?.rootViewController as? PlanetBridgeViewController)
        let web = try XCTUnwrap(controller.bridge?.webView)
        let start = Date()
        while (try await web.evaluateJavaScript("typeof window.__LITERARY_PLANET_NATIVE_PREFERENCES_QA__?.run === 'function'") as? Bool) != true {
            guard Date().timeIntervalSince(start) < 15 else { XCTFail("Installed native diagnostic is unavailable"); return }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        _ = try await web.evaluateJavaScript("window.__LP_PREFERENCE_QA_RESULT__=null;window.__LITERARY_PLANET_NATIVE_PREFERENCES_QA__.run('\(runId)','\(phase)').then(r=>window.__LP_PREFERENCE_QA_RESULT__=r).catch(()=>window.__LP_PREFERENCE_QA_RESULT__={status:'FAIL'});'scheduled'")
        var result: [String: Any]? = nil
        let operation = Date()
        while result == nil {
            if let text = try await web.evaluateJavaScript("JSON.stringify(window.__LP_PREFERENCE_QA_RESULT__)") as? String, let data = text.data(using: .utf8) {
                result = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) as? [String: Any]
            }
            if result == nil {
                guard Date().timeIntervalSince(operation) < 15 else { XCTFail("Installed native diagnostic did not settle"); return }
                try await Task.sleep(nanoseconds: 50_000_000)
            }
        }
        XCTAssertEqual(result?["schemaVersion"] as? Int, 1); XCTAssertEqual(result?["runId"] as? String, runId); XCTAssertEqual(result?["case"] as? String, phase)
        XCTAssertEqual(result?["status"] as? String, "PASS")
        XCTAssertEqual(result?["backend"] as? String, phase == "plugin-failure" || phase == "timeout" ? "synthetic-boundary" : "native-os")
    }
    func testSecureStoragePhase() throws {
        let environment = ProcessInfo.processInfo.environment
        let runId = try XCTUnwrap(environment["LITERARY_PLANET_SECURE_TEST_RUN_ID"])
        let phase = try XCTUnwrap(environment["LITERARY_PLANET_SECURE_TEST_PHASE"])
        let store = try PlanetKeychainStore(syntheticRunId: runId), key = "secure-runtime-v1:" + runId
        let value = "synthetic-literary-planet-keychain-secret-v1"
        switch phase {
        case "write":
            try store.remove(key); XCTAssertNil(try store.get(key)); try store.set(key, value)
            XCTAssertTrue(try store.get(key) == value)
        case "read": XCTAssertTrue(try store.get(key) == value)
        case "parallel":
            let group = DispatchGroup(), lock = NSLock(); var failed = false
            for index in 0..<4 {
                group.enter()
                DispatchQueue.global().async {
                    do { try store.set(key, value + String(index)); if try store.get(key) == nil { lock.lock(); failed = true; lock.unlock() } }
                    catch { lock.lock(); failed = true; lock.unlock() }
                    group.leave()
                }
            }
            XCTAssertEqual(group.wait(timeout: .now() + 30), .success)
            lock.lock(); let result = failed; lock.unlock(); XCTAssertFalse(result)
        case "corrupt":
            try store.corruptSyntheticValue(key); XCTAssertThrowsError(try store.get(key))
        case "remove": try store.remove(key); XCTAssertNil(try store.get(key))
        case "absent": XCTAssertNil(try store.get(key))
        default: XCTFail("Unknown synthetic secure-storage phase")
        }
    }
}
