import XCTest
@testable import App

/** Authored native software fixtures. NOT_COMPILED_NOT_RUN at authoring.
 * They do not mint a production claim, human review, TLS pin or device proof. */
final class PlanetChildResourcesRuntimeTests: XCTestCase {
    func testEmptySourceCatalogKeepsAccountlessBundleProjection() throws {
        XCTAssertEqual(try PlanetChildNativeResourcesRuntimeFixture.catalogScenario("empty-dev"),0)
    }
    func testFixedCatalogBindsExactMediaInventoryAndSource() throws {
        XCTAssertEqual(try PlanetChildNativeResourcesRuntimeFixture.catalogScenario("bound-source"),1)
    }
    func testCatalogRejectsCallerFieldsAndDuplicateJSONKeys() {
        for scenario in ["unknown-catalog-field","unknown-binding-field","duplicate-json-field"] { XCTAssertThrowsError(try PlanetChildNativeResourcesRuntimeFixture.catalogScenario(scenario),scenario) }
    }
    func testCatalogRejectsDuplicateBindingsAndOrphanOrigins() {
        for scenario in ["duplicate-binding","orphan-origin"] { XCTAssertThrowsError(try PlanetChildNativeResourcesRuntimeFixture.catalogScenario(scenario),scenario) }
    }
    func testCatalogRejectsSubstitutedSourceMissingMediaAndExtraOutputs() {
        for scenario in ["substituted-source","missing-media-binary","orphan-resource-output","bad-path"] { XCTAssertThrowsError(try PlanetChildNativeResourcesRuntimeFixture.catalogScenario(scenario),scenario) }
    }
    func testOriginRequiresCanonicalVettedHTTPSWithoutCallerURLControls() throws {
        XCTAssertEqual(try PlanetChildLocalV2ResourceRules.origin("https://resources.example.org").absoluteString,"https://resources.example.org")
        for raw in ["http://resources.example.org","https://resources.example.org/","https://user@resources.example.org","https://resources.example.org:443","https://127.0.0.1","https://resources.local","https://Resources.example.org","https://resources.example.org?url=evil","https://resources.example.org#restore"] { XCTAssertThrowsError(try PlanetChildLocalV2ResourceRules.origin(raw),raw) }
    }
    func testPathIsExactlyBinaryChecksumAndSupportedMIME() throws {
        let hash=String(repeating:"a",count:64)
        XCTAssertEqual(try PlanetChildLocalV2ResourceRules.path(hash,"image/png"),"/objects/"+hash+".png")
        XCTAssertThrowsError(try PlanetChildLocalV2ResourceRules.path(hash,"image/svg+xml"))
        XCTAssertThrowsError(try PlanetChildLocalV2ResourceRules.path("../"+hash,"image/png"))
        XCTAssertThrowsError(try PlanetChildLocalV2ResourceRules.path(hash+"\n","image/png"))
    }
    func testContinuousDeadlineAndRightsExpiryCannotRenew() throws {
        try PlanetChildLocalV2ResourceRules.lifetime(30_000_000_001,1,99,100)
        XCTAssertThrowsError(try PlanetChildLocalV2ResourceRules.lifetime(30_000_000_001,30_000_000_001,99,100))
        XCTAssertThrowsError(try PlanetChildLocalV2ResourceRules.lifetime(60_000_000_002,1,99,100))
        XCTAssertThrowsError(try PlanetChildLocalV2ResourceRules.lifetime(30_000_000_001,1,100,100))
        XCTAssertThrowsError(try PlanetChildLocalV2ResourceRules.lifetime(30_000_000_001,0,99,100))
    }
    func testResponseRequiresExactStatusURLMIMEAndEncodedLength() throws {
        let url=URL(string:"https://resources.example.org/objects/"+String(repeating:"a",count:64)+".png")!
        let location=PlanetChildLocalV2ResourceHTTPS(url:url,origin:"https://resources.example.org",keyChecksums:[String(repeating:"b",count:64)])
        let headers=["Content-Type":"image/png","Content-Length":"4"]
        try PlanetChildLocalV2ResourceRules.response(HTTPURLResponse(url:url,statusCode:200,httpVersion:"HTTP/1.1",headerFields:headers)!,location,"image/png",4)
        for status in [206,302,404] { XCTAssertThrowsError(try PlanetChildLocalV2ResourceRules.response(HTTPURLResponse(url:url,statusCode:status,httpVersion:"HTTP/1.1",headerFields:headers)!,location,"image/png",4)) }
        for changed in [["Content-Type":"image/jpeg","Content-Length":"4"],["Content-Type":"image/png; charset=utf-8","Content-Length":"4"],["Content-Type":"image/png","Content-Length":"5"],["Content-Type":"image/png","Content-Length":"4","Content-Encoding":"gzip"]] { XCTAssertThrowsError(try PlanetChildLocalV2ResourceRules.response(HTTPURLResponse(url:url,statusCode:200,httpVersion:"HTTP/1.1",headerFields:changed)!,location,"image/png",4)) }
        XCTAssertThrowsError(try PlanetChildLocalV2ResourceRules.response(HTTPURLResponse(url:URL(string:"https://substitute.example.org/objects/a.png")!,statusCode:200,httpVersion:"HTTP/1.1",headerFields:headers)!,location,"image/png",4))
    }
    func testOwnedEncodedBufferRejectsOverflowAndOneUseTransfer() throws {
        let buffer=PlanetChildLocalV2ResourceBuffer(4)
        try buffer.append(Data([1,2]));try buffer.append(Data([3,4]))
        XCTAssertThrowsError(try buffer.append(Data([5])))
        let hash=PlanetChildLocalV2ResourceRules.digest(Data([1,2,3,4]))
        XCTAssertEqual(try buffer.transfer(hash),Data([1,2,3,4]));XCTAssertEqual(buffer.count,0)
        XCTAssertThrowsError(try buffer.transfer(hash));XCTAssertThrowsError(try buffer.append(Data([1])))
    }
    func testOwnedEncodedBufferRetirementWipesAndPreventsLateCallbackBytes() throws {
        let buffer=PlanetChildLocalV2ResourceBuffer(4);try buffer.append(Data([1,2,3]))
        buffer.close();buffer.close();XCTAssertEqual(buffer.count,0)
        XCTAssertThrowsError(try buffer.append(Data([4])))
        XCTAssertThrowsError(try buffer.transfer(PlanetChildLocalV2ResourceRules.digest(Data([1,2,3,4]))))
    }
    func testEncodedBytesMustMatchApprovedBinaryBeforeDecode() throws {
        let bytes=Data([1,2,3,4]),hash=PlanetChildLocalV2ResourceRules.digest(Data([1,2,3,4]))
        try PlanetChildLocalV2ResourceRules.encoded(bytes,4,hash)
        XCTAssertThrowsError(try PlanetChildLocalV2ResourceRules.encoded(bytes,3,hash))
        XCTAssertThrowsError(try PlanetChildLocalV2ResourceRules.encoded(Data([1,2,3,5]),4,hash))
    }
}
