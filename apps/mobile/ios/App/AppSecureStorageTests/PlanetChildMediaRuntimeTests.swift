import Foundation
import XCTest
import UIKit
@testable import App

/** AUTHORED_NOT_RUN. Software fixtures exercise production format/codec/wire
 * mechanics; none grants real human rights/review, installed pins or OS QA. */
final class PlanetChildMediaRuntimeTests: XCTestCase {
    func testLocalV2MediaSharesExactBinaryAcrossDistinctActualOwnersOnly() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.mediaScenario("shared-binary")) }
    func testLocalV2MediaManifestRequiresIndependentCurrentReview() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.mediaScenario("independent-review")) }
    func testLocalV2MediaManifestOwnsExactOwnerAndPayload() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.mediaScenario("owner-payload")) }
    func testLocalV2MediaPolicyRejectsAgeLocaleTopicsAndPaidRights() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.mediaScenario("policy")) }
    func testLocalV2MediaReviewRequiresCompleteClosure() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.mediaScenario("complete-review")) }
    func testLocalV2MediaExpiryIntersectsPackageReviewAndRights() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.mediaScenario("expiry")) }
    func testLocalV2MediaNarrationRequiresExactScriptPerformerAndQuality() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.mediaScenario("audio-fields")) }
    func testLocalV2MediaCatalogRejectsOrphansAndSubstitutedSource() throws { XCTAssertTrue(try PlanetChildNativeMediaRuntimeFixture.catalog()) }
    func testLocalV2MediaStaticPNGRejectsAnimationCRCAndTail() throws { XCTAssertTrue(try PlanetChildNativeMediaRuntimeFixture.codecs("png")) }
    func testLocalV2MediaJPEGAndWebPRejectAnimationAndTail() throws { XCTAssertTrue(try PlanetChildNativeMediaRuntimeFixture.codecs("jpeg-webp")) }
    func testLocalV2MediaPCMRejectsCodecDurationAndMisalignment() throws { XCTAssertTrue(try PlanetChildNativeMediaRuntimeFixture.codecs("pcm")) }
    func testLocalV2MediaDecodedBuffersCloseAndZero() throws { XCTAssertTrue(try PlanetChildNativeMediaRuntimeFixture.codecs("close")) }
    func testLocalV2MediaWireRejectsCallerAuthorityAndURLs() throws {
        let token=String(repeating:"1",count:32),id=String(repeating:"2",count:32),owner: [String:Any]=["kind":"activity","id":"native-owner","contentChecksum":String(repeating:"3",count:64)]
        let base: [String:Any]=["version":2,"requestId":id,"contextToken":token,"owner":owner]
        let owned=try PlanetChildLocalV2Wire.decode("listMedia",base);XCTAssertEqual(owned.mediaOwner?["id"] as? String,"native-owner")
        for field in ["scope","review","trustedEpoch","permission","acknowledged","bytes","url","path"] {
            var invalid=base;invalid[field]=true;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("listMedia",invalid))
        }
        var external=owner;external["kind"]="external-link";var invalid=base;invalid["owner"]=external;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("listMedia",invalid))
        invalid=base;invalid["version"]=1;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("listMedia",invalid))
        invalid=base;invalid["version"]=true;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("listMedia",invalid))
        var presentation=base;presentation["assetId"]="owned-image";presentation["layout"]=["x":0,"y":0,"width":100,"height":100,"viewportWidth":300,"viewportHeight":600]
        XCTAssertNotNil(try PlanetChildLocalV2Wire.decode("presentMedia",presentation).mediaLayout)
        for name in ["https://example.invalid/a.png","../file.png","asset/image",""] { presentation["assetId"]=name;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("presentMedia",presentation)) }
        let refusal=PlanetChildLocalV2Wire.refusal("presentMedia",base,reason:"unavailable",generation:4)
        XCTAssertEqual(Set(refusal.keys),Set(["version","requestId","status","contextToken","generation","value"]));XCTAssertTrue(refusal["value"] is NSNull)
    }
    func testLocalV2MediaLayoutBoundsAndNullReleaseAreClosed() throws {
        let valid: [String:Any]=["x":4,"y":8,"width":20,"height":40,"viewportWidth":100,"viewportHeight":200]
        let layout=try PlanetChildLocalV2MediaLayout.decode(valid);XCTAssertEqual(try layout.frame(in:CGRect(x:0,y:0,width:100,height:200)),CGRect(x:4,y:8,width:20,height:40))
        for mutation: [String:Any] in [["x":-1],["width":0],["height":8193],["viewportWidth":12],["y":false],["x":0.5],["authority":true]] {
            var changed=valid;for (key,value) in mutation { changed[key]=value };XCTAssertThrowsError(try PlanetChildLocalV2MediaLayout.decode(changed))
        }
        XCTAssertThrowsError(try layout.frame(in:CGRect(x:0,y:0,width:200,height:100)))
        let request: [String:Any]=["version":2,"requestId":String(repeating:"4",count:32),"contextToken":String(repeating:"5",count:32),"presentationToken":NSNull()]
        XCTAssertNil(try PlanetChildLocalV2Wire.decode("releaseMedia",request).presentationToken)
        var known=request;known["presentationToken"]=String(repeating:"6",count:32);XCTAssertEqual(try PlanetChildLocalV2Wire.decode("releaseMedia",known).presentationToken as String?,String(repeating:"6",count:32))
        known["acknowledged"]=true;XCTAssertThrowsError(try PlanetChildLocalV2Wire.decode("releaseMedia",known))
    }
}


/** Source-authored regression obligations, NOT_COMPILED/NOT_RUN. */
extension PlanetChildMediaRuntimeTests {
    func testUnavailableSavedMediaPreservesCurrentEnglishTextGraph() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("media-unavailable-text-current")) }
    func testSavedMediaItemLimitMatchesSharedDTOAt64AndRejects65() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("route-item-limit")) }
    func testCaptureCountsTextAndProvenanceBeforeAcquiringNextBinary() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("capture-capacity")) }
    func testSavedMediaCannotSubstituteExactAgeOrLocale() throws {
        XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("wrong-age"));XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("locale-substitution"))
    }
    func testNarrationDurationUsesFractionalPCMMilliseconds() throws {
        let header=PlanetChildLocalV2MediaCodec.Header(mime:"audio/wav",width:0,height:0,sampleRate:8000,channels:1,bits:16,offset:44,count:34)
        XCTAssertThrowsError(try PlanetChildLocalV2NarrationProvenanceCodec.duration(1,header))
        XCTAssertNoThrow(try PlanetChildLocalV2NarrationProvenanceCodec.duration(2,header))
    }
    func testNativeTranscriptScrollOwnsDescendantHitsWithinItsSurfaceOnly() {
        let verify={
            let parent=UIView(),scroll=UIScrollView(),stack=UIStackView(),volume=UISlider(),foreign=UIView()
            parent.addSubview(scroll);scroll.addSubview(stack);stack.addArrangedSubview(volume)
            XCTAssertTrue(PlanetChildLocalV2MediaPresentation.ownsTranscriptControl(scroll,in:scroll))
            XCTAssertTrue(PlanetChildLocalV2MediaPresentation.ownsTranscriptControl(stack,in:scroll))
            XCTAssertTrue(PlanetChildLocalV2MediaPresentation.ownsTranscriptControl(volume,in:scroll))
            XCTAssertFalse(PlanetChildLocalV2MediaPresentation.ownsTranscriptControl(parent,in:scroll))
            XCTAssertFalse(PlanetChildLocalV2MediaPresentation.ownsTranscriptControl(foreign,in:scroll))
            scroll.removeFromSuperview();XCTAssertFalse(PlanetChildLocalV2MediaPresentation.ownsTranscriptControl(volume,in:scroll))
        }
        if Thread.isMainThread { verify() } else { DispatchQueue.main.sync(execute:verify) }
    }
    func testDownloadedMediaRoundtripCountsExactBinaryAndTranscriptBytes() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("roundtrip")) }
    func testDownloadedMediaCodecReturnsExactPersistedReviewedPCMBytes() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("cached-bytes")) }
    func testMissingEnglishAudioRetainsEnglishTextAndImages() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("text-fallback")) }
    func testSavedMediaCannotSupplyMissingCurrentNativeIndex() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("missing-index")) }
    func testSavedMediaRequiresCompleteCurrentRouteOwnedClosure() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("missing-asset")) }
    func testSavedMediaExpiresWithCurrentNativePackageRights() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("expired")) }
    func testSavedMediaDeniedAfterDifferentSignedFixtureRereview() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("re-reviewed")) }
    func testSavedMediaRejectsChangedBinaryBytes() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("binary-tamper")) }
    func testSavedMediaRejectsChangedTranscriptScript() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("transcript-tamper")) }
    func testSavedMediaRejectsChangedRawVoiceProvenance() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("provenance-tamper")) }
    func testSavedMediaRejectsIncorrectActualPCMDuration() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("duration-tamper")) }
    func testSavedMediaRejectsWrongLocaleVoiceProvenance() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("provenance-locale")) }
    func testSavedMediaRejectsClonedVoiceProvenance() throws { XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("voice-kind")) }
    func testSavedMediaRejectsCallerPermissionAndNoncanonicalOrdering() throws {
        XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("unknown-row"));XCTAssertTrue(try PlanetChildNativePackageRuntimeFixture.downloadedRouteMedia("reordered"))
    }
}
