import Foundation
import UIKit
import WebKit
import Capacitor

/** Only the separately selected LOCAL2 SDK is registered. No JavaScript PIN,
 * caller scope, trusted epoch, owner ACK or review key reaches native objects. */
@objc(PlanetChildPlugin)
public final class PlanetChildPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier="PlanetChildPlugin"
    public let jsName="PlanetChild"
    public let pluginMethods: [CAPPluginMethod]=["bootstrap","readContext","perform","retire","readEntity","search","readCollection","writeCollection","listMedia","presentMedia","releaseMedia"].map { CAPPluginMethod(name:$0,returnType:CAPPluginReturnPromise) }
    private var transport: PlanetChildLocalV2DataTransport?,owner: PlanetChildLocalV2SDKOwner?
    public override func load() {
        DispatchQueue.main.async { [weak self] in guard let self,let host=self.bridge?.viewController else { return }
            do { let native=try PlanetChildLocalV2SDKOwner.nativeOwner(host:host,mediaScrollView:self.bridge?.webView?.scrollView,invalidated:{ [weak self] value in DispatchQueue.main.async { self?.notifyListeners("invalidated",data:value) } });self.owner=native;self.transport=PlanetChildLocalV2DataTransport(owner:native) }
            catch { self.owner=nil;self.transport=nil }
        }
    }
    private func invoke(_ name: String,_ call: CAPPluginCall) {
        let captured=call.options as? [String:Any] ?? [:]
        DispatchQueue.main.async { [weak self] in guard let self,let transport=self.transport else { call.resolve(PlanetChildLocalV2Wire.refusal(name,captured,reason:"unavailable"));return }
            transport.invoke(name,captured) { result in DispatchQueue.main.async { call.resolve(result) } }
        }
    }
    @objc public func bootstrap(_ call: CAPPluginCall) { invoke("bootstrap",call) }
    @objc public func readContext(_ call: CAPPluginCall) { invoke("readContext",call) }
    @objc public func perform(_ call: CAPPluginCall) { invoke("perform",call) }
    @objc public func retire(_ call: CAPPluginCall) { invoke("retire",call) }
    @objc public func readEntity(_ call: CAPPluginCall) { invoke("readEntity",call) }
    @objc public func search(_ call: CAPPluginCall) { invoke("search",call) }
    @objc public func readCollection(_ call: CAPPluginCall) { invoke("readCollection",call) }
    @objc public func writeCollection(_ call: CAPPluginCall) { invoke("writeCollection",call) }
    @objc public func listMedia(_ call: CAPPluginCall) { invoke("listMedia",call) }
    @objc public func presentMedia(_ call: CAPPluginCall) { invoke("presentMedia",call) }
    @objc public func releaseMedia(_ call: CAPPluginCall) { invoke("releaseMedia",call) }
    public override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        if navigationAction.targetFrame?.isMainFrame != false { owner?.routeWillChange() };return nil
    }
    func nativeViewWillDisappear() { owner?.nativeViewWillDisappear() }
    func routeWillChange() { transport?.routeWillChange() }
}