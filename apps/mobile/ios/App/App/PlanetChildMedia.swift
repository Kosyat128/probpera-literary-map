import Foundation
import UIKit
import ImageIO
import AVFoundation

/** Actual LOCAL2 codecs/pixels/audio. A private original native permit is the
 * sole production constructor input; no URL, JS bytes, scope or Boolean grant. */
enum PlanetChildLocalV2MediaError: Error { case malformed, unsupported, revoked }
struct PlanetChildLocalV2MediaLayout {
    let x: Int,y: Int,width: Int,height: Int,viewportWidth: Int,viewportHeight: Int
    static func decode(_ raw: Any?) throws -> PlanetChildLocalV2MediaLayout {
        guard let r=raw as? [String:Any],Set(r.keys)==Set(["x","y","width","height","viewportWidth","viewportHeight"]) else { throw PlanetChildLocalV2MediaError.malformed }
        func n(_ k: String,_ minimum: UInt64) throws -> Int { Int(try PlanetChildLocalV2Wire.integer(r[k],minimum:minimum,maximum:8192)) }
        let v=try PlanetChildLocalV2MediaLayout(x:n("x",0),y:n("y",0),width:n("width",1),height:n("height",1),viewportWidth:n("viewportWidth",1),viewportHeight:n("viewportHeight",1))
        guard v.x+v.width<=v.viewportWidth,v.y+v.height<=v.viewportHeight else { throw PlanetChildLocalV2MediaError.malformed };return v
    }
    func frame(in bounds: CGRect) throws -> CGRect {
        guard bounds.width>0,bounds.height>0,bounds.width.isFinite,bounds.height.isFinite else { throw PlanetChildLocalV2MediaError.revoked }
        let sx=bounds.width/CGFloat(viewportWidth),sy=bounds.height/CGFloat(viewportHeight)
        // Rotation/layout changes cannot stretch an old web viewport into a new
        // native surface. CSS pixels are untrusted placement, never admission.
        guard abs(sx-sy)<=max(sx,sy)*0.02 else { throw PlanetChildLocalV2MediaError.revoked }
        let frame=CGRect(x:CGFloat(x)*sx,y:CGFloat(y)*sy,width:CGFloat(width)*sx,height:CGFloat(height)*sy)
        guard bounds.contains(frame),frame.width>=1,frame.height>=1 else { throw PlanetChildLocalV2MediaError.malformed };return frame
    }
}
enum PlanetChildLocalV2MediaCodec {
    static let maximumDimension=2048,maximumPixels=4*1024*1024,maximumRasterBytes=32*1024*1024,maximumAudioBytes=24*1024*1024
    struct Header { let mime: String,width: Int,height: Int,sampleRate: Int,channels: Int,bits: Int,offset: Int,count: Int }
    private static func insist(_ value: Bool) throws { if !value { throw PlanetChildLocalV2MediaError.malformed } }
    private static func tag(_ a: [UInt8],_ at: Int) -> String { String(bytes:a[at..<at+4],encoding:.ascii) ?? "" }
    private static func be16(_ a: [UInt8],_ p: Int) -> Int { Int(a[p])<<8|Int(a[p+1]) }
    private static func le16(_ a: [UInt8],_ p: Int) -> Int { Int(a[p])|Int(a[p+1])<<8 }
    private static func be32(_ a: [UInt8],_ p: Int) -> Int { Int(a[p])<<24|Int(a[p+1])<<16|Int(a[p+2])<<8|Int(a[p+3]) }
    private static func le32(_ a: [UInt8],_ p: Int) -> Int { Int(a[p])|Int(a[p+1])<<8|Int(a[p+2])<<16|Int(a[p+3])<<24 }
    private static func le24(_ a: [UInt8],_ p: Int) -> Int { Int(a[p])|Int(a[p+1])<<8|Int(a[p+2])<<16 }
    private static func image(_ mime: String,_ w: Int,_ h: Int) throws -> Header {
        try insist(w>0 && h>0 && w<=maximumDimension && h<=maximumDimension && w*h<=maximumPixels)
        return Header(mime:mime,width:w,height:h,sampleRate:0,channels:0,bits:0,offset:0,count:0)
    }
    private static func crc(_ bytes: ArraySlice<UInt8>) -> UInt32 {
        var value: UInt32=0xffffffff
        for byte in bytes { value ^= UInt32(byte);for _ in 0..<8 { value=(value>>1) ^ ((value&1)==0 ? 0:0xedb88320) } };return value ^ 0xffffffff
    }
    static func preflight(_ bytes: Data,_ mime: String) throws -> Header {
        let maximum=mime=="audio/wav" ? maximumAudioBytes:maximumRasterBytes
        try insist(!bytes.isEmpty && bytes.count<=maximum);var a=Array(bytes);defer { a.withUnsafeMutableBytes { $0.initializeMemory(as:UInt8.self,repeating:0) } }
        if mime=="image/png" {
            try insist(a.count>=57 && Array(a[0..<8])==[137,80,78,71,13,10,26,10])
            var at=8,chunks=0,header: Header?,idat=false,ended=false,idatEnded=false
            while at<a.count {
                try insist(a.count-at>=12 && chunks<4096);chunks+=1
                let length=be32(a,at);try insist(length<=a.count-at-12);let kind=tag(a,at+4),p=at+8,end=p+length
                try insist(kind.utf8.count==4 && kind.utf8.allSatisfy { (65...90).contains($0) || (97...122).contains($0) })
                try insist(crc(a[(at+4)..<end])==UInt32(be32(a,end)))
                if header==nil {
                    try insist(kind=="IHDR" && length==13);header=try image(mime,be32(a,p),be32(a,p+4))
                    let depth=a[p+8],color=a[p+9]
                    try insist((color==0 && [1,2,4,8,16].contains(depth) || color==2 && [8,16].contains(depth) || color==3 && [1,2,4,8].contains(depth) || [4,6].contains(color) && [8,16].contains(depth)) && a[p+10]==0 && a[p+11]==0 && a[p+12]<=1)
                } else {
                    try insist(!["IHDR","acTL","fcTL","fdAT"].contains(kind))
                    if kind=="IDAT" { try insist(!idatEnded && length>0);idat=true }
                    else if idat { idatEnded=true }
                    if kind=="IEND" { try insist(length==0 && idat && end+4==a.count);ended=true;at=end+4;break }
                    if a[at+4]>=65 && a[at+4]<=90 { try insist(["IDAT","PLTE","IEND"].contains(kind)) }
                };at=end+4
            }
            try insist(ended && at==a.count);return header!
        }
        if mime=="image/jpeg" {
            try insist(a.count>=4 && a[0]==255 && a[1]==216)
            var at=2,header: Header?,inScan=false,scans=0,markers=0,ended=false
            while at<a.count {
                if inScan {
                    while at<a.count {
                        if a[at] != 255 { at+=1;continue };try insist(at+1<a.count)
                        if a[at+1]==0 { at+=2;continue }
                        if (0xd0...0xd7).contains(a[at+1]) { at+=2;continue }
                        if a[at+1]==255 { at+=1;continue };inScan=false;break
                    }
                }
                try insist(at+1<a.count && a[at]==255 && markers<4096);markers+=1
                while at<a.count && a[at]==255 { at+=1 };try insist(at<a.count);let marker=a[at];at+=1
                if marker==0xd9 { try insist(header != nil && scans>0 && at==a.count);ended=true;break }
                try insist(![0,0xd8,0x01,0xdc].contains(marker) && !(0xd0...0xd7).contains(marker) && at+2<=a.count)
                let count=be16(a,at);try insist(count>=2 && count<=a.count-at);let p=at+2
                if [0xc0,0xc2].contains(marker) {
                    try insist(header==nil && count>=8 && a[p]==8)
                    let components=Int(a[p+5]);try insist([1,3,4].contains(components) && count==8+components*3)
                    header=try image(mime,be16(a,p+3),be16(a,p+1))
                } else if (0xc0...0xcf).contains(marker) { try insist([0xc4,0xc8,0xcc].contains(marker) && marker != 0xc8 && marker != 0xcc) }
                if marker==0xda { try insist(header != nil && count>=6 && scans<64);scans+=1;inScan=true }
                at+=count
            }
            try insist(ended);return header!
        }
        if mime=="image/webp" {
            try insist(a.count>=20 && tag(a,0)=="RIFF" && tag(a,8)=="WEBP" && le32(a,4)==a.count-8)
            var at=12,chunks=0,canvas: Header?,coded: Header?
            while at<a.count {
                try insist(a.count-at>=8 && chunks<4096);chunks+=1
                let kind=tag(a,at),count=le32(a,at+4),p=at+8;try insist(count<=a.count-p)
                let next=p+count+(count&1);try insist(next<=a.count && (count&1==0 || a[p+count]==0))
                if kind=="VP8X" {
                    try insist(at==12 && count==10 && canvas==nil && a[p]&0xc3==0 && a[p+1]==0 && a[p+2]==0 && a[p+3]==0)
                    canvas=try image(mime,le24(a,p+4)+1,le24(a,p+7)+1)
                } else if kind=="VP8 " {
                    try insist(coded==nil && count>=10 && a[p]&1==0 && Array(a[(p+3)..<(p+6)])==[0x9d,0x01,0x2a])
                    coded=try image(mime,le16(a,p+6)&0x3fff,le16(a,p+8)&0x3fff)
                } else if kind=="VP8L" {
                    try insist(coded==nil && count>=5 && a[p]==0x2f && a[p+4]&0xe0==0)
                    coded=try image(mime,(Int(a[p+1])|Int(a[p+2]&0x3f)<<8)+1,(Int(a[p+2])>>6|Int(a[p+3])<<2|Int(a[p+4]&0x0f)<<10)+1)
                } else { try insist(["ALPH","ICCP","EXIF","XMP "].contains(kind)) }
                at=next
            }
            try insist(at==a.count && coded != nil)
            if let canvas { try insist(canvas.width==coded!.width && canvas.height==coded!.height) };return coded!
        }
        if mime=="audio/wav" {
            try insist(a.count>=44 && tag(a,0)=="RIFF" && tag(a,8)=="WAVE" && le32(a,4)==a.count-8)
            var at=12,chunks=0,rate=0,channels=0,bits=0,offset=0,count=0
            while at<a.count {
                try insist(a.count-at>=8 && chunks<4096);chunks+=1
                let kind=tag(a,at),size=le32(a,at+4),p=at+8;try insist(size<=a.count-p);let next=p+size+(size&1)
                try insist(next<=a.count && (size&1==0 || a[p+size]==0))
                if kind=="fmt " {
                    try insist(rate==0 && [16,18].contains(size) && le16(a,p)==1)
                    channels=le16(a,p+2);rate=le32(a,p+4);bits=le16(a,p+14)
                    try insist([1,2].contains(channels) && (8000...48000).contains(rate) && [8,16].contains(bits) && le16(a,p+12)==channels*bits/8 && le32(a,p+8)==rate*channels*bits/8 && (size==16 || le16(a,p+16)==0))
                } else if kind=="data" { try insist(rate>0 && offset==0 && size>0);offset=p;count=size }
                else { try insist(kind=="JUNK") };at=next
            }
            try insist(at==a.count && rate>0 && offset>0 && count%(channels*bits/8)==0 && count/(channels*bits/8)<=rate*60)
            return Header(mime:mime,width:0,height:0,sampleRate:rate,channels:channels,bits:bits,offset:offset,count:count)
        }
        throw PlanetChildLocalV2MediaError.unsupported
    }
    static func sourceFrame(_ full:Int,_ start:Int,_ rendered:Int64)throws -> Int {guard full>0,start>=0,start<full,rendered>=0,rendered<=Int64(full-start) else{throw PlanetChildLocalV2MediaError.malformed};return min(full-1,start+Int(rendered))}
    static func decode(_ permit: PlanetChildLocalV2MediaPermit) throws -> PlanetChildLocalV2MediaResource {
        try permit.workerCurrent();var bytes=try permit.readEncoded();defer { bytes.resetBytes(in:0..<bytes.count) }
        let header=try preflight(bytes,permit.mime);try permit.validateEncodedHeader(header);try permit.workerCurrent()
        let result: PlanetChildLocalV2MediaResource=try autoreleasepool {
            if header.mime=="audio/wav" { return try PlanetChildLocalV2MediaResource.audio(bytes,header,startFrame:try permit.preparedStartFrame()) }
            return try PlanetChildLocalV2MediaResource.raster(bytes,header)
        }
        do { try permit.workerCurrent();permit.releaseEncoded();return result } catch { result.close();throw error }
    }
}
/** Both mutable decoded pixels/samples and opaque OS codec output stay here.
 * Conceal clears actual output immediately; close releases/zeros all owned
 * sources after the original native command has returned. */
final class PlanetChildLocalV2MediaResource {
    fileprivate var image: CGImage?,audio: AVAudioPCMBuffer?;fileprivate var sourceStartFrame=0,sourceFrameCount=0
    private var pixels=Data(),closed=false;private let lock=NSLock()
    var footprint: Int { lock.lock();defer { lock.unlock() };return pixels.count+(image.map { $0.width*$0.height*4 } ?? 0)+(audio.map { Int($0.frameCapacity)*Int($0.format.channelCount)*4 } ?? 0) }
    private init() {}
    static func raster(_ bytes: Data,_ header: PlanetChildLocalV2MediaCodec.Header) throws -> PlanetChildLocalV2MediaResource {
        let r=PlanetChildLocalV2MediaResource();var handed=false;defer { if !handed { r.close() } }
        guard let source=CGImageSourceCreateWithData(bytes as CFData,[kCGImageSourceShouldCache:false] as CFDictionary),CGImageSourceGetCount(source)==1,
            let properties=CGImageSourceCopyPropertiesAtIndex(source,0,nil) as? [String:Any],
            (properties[kCGImagePropertyPixelWidth as String] as? NSNumber)?.intValue==header.width,(properties[kCGImagePropertyPixelHeight as String] as? NSNumber)?.intValue==header.height,
            let original=CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary),
            original.width==header.width,original.height==header.height,let color=CGColorSpace(name:CGColorSpace.sRGB) else { throw PlanetChildLocalV2MediaError.malformed }
        r.pixels=Data(count:header.width*header.height*4)
        r.image=try r.pixels.withUnsafeMutableBytes { buffer in
            guard let context=CGContext(data:buffer.baseAddress,width:header.width,height:header.height,bitsPerComponent:8,bytesPerRow:header.width*4,space:color,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else { throw PlanetChildLocalV2MediaError.malformed }
            context.setBlendMode(.copy);context.draw(original,in:CGRect(x:0,y:0,width:header.width,height:header.height))
            guard let image=context.makeImage() else { throw PlanetChildLocalV2MediaError.malformed };return image
        };handed=true;return r
    }
    static func audio(_ bytes: Data,_ h: PlanetChildLocalV2MediaCodec.Header,startFrame:Int=0) throws -> PlanetChildLocalV2MediaResource {
        let r=PlanetChildLocalV2MediaResource();var handed=false;defer { if !handed { r.close() } }
        let fullFrames=h.count/(h.channels*h.bits/8);guard startFrame>=0,startFrame<fullFrames else {throw PlanetChildLocalV2MediaError.malformed};let frames=fullFrames-startFrame;r.sourceStartFrame=startFrame;r.sourceFrameCount=fullFrames
        guard let format=AVAudioFormat(standardFormatWithSampleRate:Double(h.sampleRate),channels:AVAudioChannelCount(h.channels)),
            let buffer=AVAudioPCMBuffer(pcmFormat:format,frameCapacity:AVAudioFrameCount(frames)),let planes=buffer.floatChannelData else { throw PlanetChildLocalV2MediaError.malformed }
        buffer.frameLength=AVAudioFrameCount(frames)
        bytes.withUnsafeBytes { raw in let a=raw.bindMemory(to:UInt8.self)
            for frame in 0..<frames { for channel in 0..<h.channels { let p=h.offset+((startFrame+frame)*h.channels+channel)*h.bits/8
                let sample: Float=h.bits==8 ? Float(Int(a[p])-128)/128:Float(Int16(bitPattern:UInt16(a[p])|UInt16(a[p+1])<<8))/32768
                planes[channel][frame]=sample
            } }
        };r.audio=buffer;handed=true;return r
    }
    func close() {
        lock.lock();defer { lock.unlock() };if closed { return };closed=true;image=nil
        if let audio,let planes=audio.floatChannelData { for channel in 0..<Int(audio.format.channelCount) { planes[channel].initialize(repeating:0,count:Int(audio.frameCapacity)) };audio.frameLength=0 };audio=nil
        pixels.resetBytes(in:0..<pixels.count);pixels.removeAll(keepingCapacity:false)
    }
    deinit { close() }
}
/** Above the existing web view; it never makes a second globe or exports bytes.
 * Audio permission is the actual native button touch, not a JS action/callback. */
final class PlanetChildLocalV2MediaPresentation: NSObject {
    let token: String,permit: PlanetChildLocalV2MediaPermit
    private let resource: PlanetChildLocalV2MediaResource,container=UIView(),picture=UIImageView(),label=UILabel(),play=UIButton(type:.system),stop=UIButton(type:.system),mute=UIButton(type:.system),volume=UISlider(),transcriptScroll=UIScrollView()
    private let engine=AVAudioEngine(),player=AVAudioPlayerNode(),lock=NSLock()
    private static weak var audiblePresentation: PlanetChildLocalV2MediaPresentation?
    private var concealed=false,closed=false,playing=false,watch: DispatchWorkItem?,engineAttached=false,sessionActive=false,lastAudibleVolume: Float=1,playbackSequence: UInt64=0
    private var observers=[NSObjectProtocol]();private var nativePlayReservation:UInt64?,nativePlayConsumed=false,observedSequence:UInt64=0,observedSourceFrame:Int = -1,observedValid=false
    private weak var attachedParent: UIView?;private var attachedBounds=CGRect.zero
    var footprint: Int { resource.footprint }
    func ownsNativeControl(_ view: UIView) -> Bool {
        lock.lock();let allowed = !concealed && !closed;lock.unlock()
        return allowed && Self.ownsTranscriptControl(view,in:transcriptScroll) && view.isUserInteractionEnabled && !view.isHidden
    }
    /** The passthrough surface must retain native transcript scroll gestures,
     * including hits on stack/slider descendants, inside this presentation. */
    static func ownsTranscriptControl(_ view: UIView,in scroll: UIScrollView) -> Bool {
        scroll.superview != nil && (view === scroll || view.isDescendant(of:scroll))
    }
    init(token: String,permit: PlanetChildLocalV2MediaPermit,resource: PlanetChildLocalV2MediaResource) { self.token=token;self.permit=permit;self.resource=resource;super.init() }
    func attach(to parent: UIView,layout: PlanetChildLocalV2MediaLayout) throws {
        guard Thread.isMainThread else { throw PlanetChildLocalV2MediaError.revoked };try permit.mainCurrent()
        lock.lock();let denied=concealed || closed;lock.unlock();guard !denied else { throw PlanetChildLocalV2MediaError.revoked }
        attachedParent=parent;attachedBounds=parent.bounds;container.frame=try layout.frame(in:parent.bounds);container.backgroundColor = .clear;container.clipsToBounds=true;container.accessibilityIdentifier="child-native-media-"+permit.assetId
        if let image=resource.image {
            picture.image=UIImage(cgImage:image);picture.contentMode = .scaleAspectFit;picture.frame=container.bounds;picture.autoresizingMask=[.flexibleWidth,.flexibleHeight];picture.isAccessibilityElement=true;picture.accessibilityLabel=permit.altText;picture.accessibilityLanguage=permit.locale;container.addSubview(picture)
        } else if resource.audio != nil {
            guard permit.audioEnabled,let transcript=permit.transcript,!transcript.isEmpty else { throw PlanetChildLocalV2MediaError.revoked }
            // The complete same-locale transcript remains readable with voice
            // muted, large type, VoiceOver and a small native media viewport.
            let scroll=transcriptScroll,stack=UIStackView();scroll.frame=container.bounds;scroll.autoresizingMask=[.flexibleWidth,.flexibleHeight];stack.axis = .vertical;stack.spacing=8;stack.translatesAutoresizingMaskIntoConstraints=false
            container.addSubview(scroll);scroll.addSubview(stack)
            NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo:scroll.contentLayoutGuide.leadingAnchor),stack.trailingAnchor.constraint(equalTo:scroll.contentLayoutGuide.trailingAnchor),stack.topAnchor.constraint(equalTo:scroll.contentLayoutGuide.topAnchor),stack.bottomAnchor.constraint(equalTo:scroll.contentLayoutGuide.bottomAnchor),stack.widthAnchor.constraint(equalTo:scroll.frameLayoutGuide.widthAnchor)])
            label.text=transcript;label.numberOfLines=0;label.font = .preferredFont(forTextStyle:.body);label.adjustsFontForContentSizeCategory=true;label.isAccessibilityElement=true;label.accessibilityLanguage=permit.locale
            let ru=permit.locale=="ru";play.setTitle(ru ? "Слушать":"Play",for:.normal);stop.setTitle(ru ? "Стоп":"Stop",for:.normal);mute.setTitle(ru ? "Выключить голос":"Mute voice",for:.normal)
            play.accessibilityLabel=(ru ? "Слушать на русском: ":"Listen in English: ")+permit.altText;stop.accessibilityLabel=ru ? "Остановить озвучивание":"Stop narration";mute.accessibilityLabel=ru ? "Выключить голос":"Mute voice"
            for control in [play,stop,mute] { control.accessibilityLanguage=permit.locale;control.heightAnchor.constraint(greaterThanOrEqualToConstant:44).isActive=true }
            volume.minimumValue=0;volume.maximumValue=1;volume.value=1;volume.accessibilityLabel=ru ? "Громкость озвучивания":"Narration volume";volume.accessibilityLanguage=permit.locale;volume.heightAnchor.constraint(greaterThanOrEqualToConstant:44).isActive=true
            play.isEnabled=true;stop.isEnabled=false
            play.addTarget(self,action:#selector(touchedPlay),for:.touchUpInside);stop.addTarget(self,action:#selector(touchedStop),for:.touchUpInside);mute.addTarget(self,action:#selector(touchedMute),for:.touchUpInside);volume.addTarget(self,action:#selector(changedVolume),for:.valueChanged)
            for v in [label,play,stop,mute,volume] { stack.addArrangedSubview(v) }
            let center=NotificationCenter.default
            for name in [AVAudioSession.interruptionNotification,UIApplication.willResignActiveNotification,UIAccessibility.voiceOverStatusDidChangeNotification,UIAccessibility.reduceMotionStatusDidChangeNotification] {
                observers.append(center.addObserver(forName:name,object:nil,queue:.main) { [weak self] _ in self?.pausePlayback() })
            }
            observers.append(center.addObserver(forName:AVAudioSession.routeChangeNotification,object:nil,queue:.main) { [weak self] note in
                let reason=(note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? NSNumber)?.uintValue
                // Setting our category during an explicit native Play touch
                // does not authorize any subsequent automatic restart.
                if reason != AVAudioSession.RouteChangeReason.categoryChange.rawValue { self?.pausePlayback() }
            })
            observers.append(center.addObserver(forName:AVAudioSession.mediaServicesWereResetNotification,object:nil,queue:.main) { [weak self] _ in self?.conceal();self?.permit.failedPresentation() })
        } else { throw PlanetChildLocalV2MediaError.malformed }
        try permit.mainCurrent();parent.addSubview(container);try permit.mainCurrent();schedule()
    }
    private func schedule() {
        guard Thread.isMainThread else { return };lock.lock();let done=concealed || closed;lock.unlock();if done { return }
        do { guard let attachedParent,container.superview === attachedParent,attachedParent.bounds==attachedBounds else { throw PlanetChildLocalV2MediaError.revoked };try permit.mainCurrent();if playing {try observeSourceFrame()};let next=DispatchWorkItem { [weak self] in self?.schedule() };watch=next;DispatchQueue.main.asyncAfter(deadline:.now()+.milliseconds(10),execute:next) } catch { conceal();permit.failedPresentation() }
    }
    @objc private func touchedPlay() {
        guard Thread.isMainThread,permit.audioEnabled,resource.audio != nil else { return }
        do {
            try permit.mainCurrent();lock.lock();let denied=concealed || closed || playing || nativePlayReservation != nil || (permit.hasNarrationCue && nativePlayConsumed);lock.unlock();guard !denied else { return }
            guard playbackSequence<9007199254740991 else {throw PlanetChildLocalV2MediaError.revoked};playbackSequence+=1;let sequence=playbackSequence
            nativePlayReservation=sequence;play.isEnabled=false
            if permit.hasNarrationCue {permit.prepareNativePlay(self,sequence)}else{try beginReservedPlayback(sequence)}
        }catch{conceal();permit.failedPresentation()}
    }
    /** Only touchedPlay creates this private reservation. A queued worker never
     * creates a touch, and interruption/conceal invalidates the original one. */
    func nativePlayCurrent(_ sequence:UInt64) -> Bool {
        guard Thread.isMainThread else {return false};lock.lock();defer{lock.unlock()};return !concealed && !closed && !playing && nativePlayReservation==sequence && playbackSequence==sequence
    }
    func beginReservedPlayback(_ sequence:UInt64)throws {
        guard nativePlayCurrent(sequence),permit.audioEnabled,let buffer=resource.audio else{throw PlanetChildLocalV2MediaError.revoked};try permit.mainCurrent()
        if let other=Self.audiblePresentation,other !== self {other.pausePlayback()};try permit.mainCurrent();guard nativePlayCurrent(sequence) else{throw PlanetChildLocalV2MediaError.revoked}
        let session=AVAudioSession.sharedInstance();try session.setCategory(.playback,mode:.spokenAudio,options:[]);try permit.mainCurrent();try session.setActive(true);sessionActive=true;Self.audiblePresentation=self
        if !engineAttached {engine.attach(player);engine.connect(player,to:engine.mainMixerNode,format:buffer.format);engineAttached=true}
        engine.mainMixerNode.outputVolume=volume.value;player.stop();lock.lock();observedSequence=sequence;observedSourceFrame = -1;observedValid=true;lock.unlock()
        player.scheduleBuffer(buffer,at:nil,options:[],completionCallbackType:.dataPlayedBack){[weak self] _ in DispatchQueue.main.async{
            guard let self,self.playbackSequence==sequence else{return}
            do {let frame=try self.pauseForCheckpoint();if self.permit.hasNarrationCue {try self.permit.observeNativeFrame(self,sequence,frame,stop:true)}else{self.pausePlayback()}}
            catch{self.conceal();self.permit.failedPresentation()}
        }}
        try permit.mainCurrent();try engine.start();try permit.mainCurrent();guard nativePlayCurrent(sequence) else{throw PlanetChildLocalV2MediaError.revoked};player.play();nativePlayReservation=nil;if permit.hasNarrationCue{nativePlayConsumed=true}
        lock.lock();playing=true;lock.unlock();play.isEnabled=false;stop.isEnabled=true
    }
    /** Actual rendered node samples, not submitted bytes or a wall-clock estimate.
     * The retained full signed frame count bounds the decoded suffix. */
    private func observeSourceFrame()throws {
        guard Thread.isMainThread,playing,let buffer=resource.audio else{return};try permit.mainCurrent()
        guard let node=player.lastRenderTime,let time=player.playerTime(forNodeTime:node) else{return}
        guard time.isSampleTimeValid,time.sampleRate==buffer.format.sampleRate,time.sampleTime>=0,time.sampleTime<=AVAudioFramePosition(buffer.frameLength) else{throw PlanetChildLocalV2MediaError.malformed}
        let frame=try PlanetChildLocalV2MediaCodec.sourceFrame(resource.sourceFrameCount,resource.sourceStartFrame,time.sampleTime);lock.lock();let previous=observedSourceFrame;lock.unlock();guard frame>=resource.sourceStartFrame,frame>=previous else{throw PlanetChildLocalV2MediaError.malformed}
        lock.lock();observedSourceFrame=frame;let sequence=observedSequence;lock.unlock();try permit.observeNativeFrame(self,sequence,frame,stop:false)
    }
    func observationCurrent(_ sequence:UInt64,_ frame:Int) -> Bool {
        lock.lock();defer{lock.unlock()};return !concealed && !closed && sequence>0 && observedValid && observedSequence==sequence && frame>=resource.sourceStartFrame && frame<=observedSourceFrame && frame<resource.sourceFrameCount
    }
    func pauseForCheckpoint()throws -> Int {
        guard Thread.isMainThread else{throw PlanetChildLocalV2MediaError.revoked};try permit.mainCurrent();try observeSourceFrame();player.pause();engine.pause();lock.lock();playing=false;let frame=observedSourceFrame;lock.unlock();play.isEnabled=false;stop.isEnabled=false;return frame
    }
    /** Interruption end, Bluetooth/headphone change, application resume and
     * accessibility changes never call Play. Only a fresh native touch may. */
    private func pausePlayback() {
        guard Thread.isMainThread else { return };nativePlayReservation=nil;if playbackSequence<9007199254740991 { playbackSequence+=1 };player.stop();engine.pause();lock.lock();playing=false;observedValid=false;let denied=concealed || closed;lock.unlock()
        if sessionActive,Self.audiblePresentation === self {
            do { try AVAudioSession.sharedInstance().setActive(false,options:.notifyOthersOnDeactivation);Self.audiblePresentation=nil;sessionActive=false }
            catch { conceal();permit.failedPresentation();return }
        } else { sessionActive=false }
        do { if !denied { try permit.mainCurrent() };play.isEnabled = !denied && permit.audioEnabled && !(permit.hasNarrationCue && nativePlayConsumed);stop.isEnabled=false }
        catch { conceal();permit.failedPresentation() }
    }
    @objc private func touchedStop() {if !permit.hasNarrationCue {pausePlayback();return};do{let frame=try pauseForCheckpoint();try permit.observeNativeFrame(self,observedSequence,frame,stop:true)}catch{conceal();permit.failedPresentation()}}
    @objc private func changedVolume() {
        guard Thread.isMainThread else { return }
        do { try permit.mainCurrent();engine.mainMixerNode.outputVolume=volume.value;if volume.value>0 { lastAudibleVolume=volume.value };updateMuteCopy() }
        catch { conceal();permit.failedPresentation() }
    }
    @objc private func touchedMute() {
        guard Thread.isMainThread else { return }
        do { try permit.mainCurrent();if volume.value>0 { lastAudibleVolume=volume.value;volume.value=0 } else { volume.value=max(0.1,lastAudibleVolume) };engine.mainMixerNode.outputVolume=volume.value;updateMuteCopy() }
        catch { conceal();permit.failedPresentation() }
    }
    private func updateMuteCopy() {
        let ru=permit.locale=="ru",muted=volume.value==0
        let text=muted ? (ru ? "Включить голос":"Unmute voice"):(ru ? "Выключить голос":"Mute voice")
        mute.setTitle(text,for:.normal);mute.accessibilityLabel=text;volume.accessibilityValue=String(Int((volume.value*100).rounded()))+"%"
    }
    /** Fast native entry fence. Resource/session cleanup joins on the worker. */
    func conceal() {
        guard Thread.isMainThread else { return };nativePlayReservation=nil;if playbackSequence<9007199254740991 { playbackSequence+=1 };lock.lock();concealed=true;playing=false;observedValid=false;lock.unlock();watch?.cancel();watch=nil
        for observer in observers { NotificationCenter.default.removeObserver(observer) };observers.removeAll()
        container.isHidden=true;container.layer.removeAllAnimations();picture.image=nil;label.text=nil;play.isEnabled=false;stop.isEnabled=false;mute.isEnabled=false;volume.isEnabled=false;player.stop();engine.pause();container.removeFromSuperview()
    }
    func closeJoined() throws {
        guard !Thread.isMainThread else { throw PlanetChildLocalV2MediaError.revoked }
        try DispatchQueue.main.sync { conceal();play.removeTarget(self,action:#selector(touchedPlay),for:.touchUpInside);stop.removeTarget(self,action:#selector(touchedStop),for:.touchUpInside);mute.removeTarget(self,action:#selector(touchedMute),for:.touchUpInside);volume.removeTarget(self,action:#selector(changedVolume),for:.valueChanged)
            if sessionActive,Self.audiblePresentation === self { try AVAudioSession.sharedInstance().setActive(false,options:.notifyOthersOnDeactivation);Self.audiblePresentation=nil };sessionActive=false
        }
        player.stop();engine.stop()
        if engineAttached { engine.disconnectNodeOutput(player);engine.detach(player);engineAttached=false }
        resource.close();permit.close();lock.lock();closed=true;playing=false;lock.unlock()
    }
    var knownClosed: Bool { lock.lock();defer { lock.unlock() };return closed }
}

#if DEBUG
extension PlanetChildNativeMediaRuntimeFixture {
    static func fixtureImage(_ resource: PlanetChildLocalV2MediaResource) throws -> UIImage {
        guard let image=resource.image else { throw PlanetChildLocalV2MediaError.malformed };return UIImage(cgImage:image)
    }
}
#endif
