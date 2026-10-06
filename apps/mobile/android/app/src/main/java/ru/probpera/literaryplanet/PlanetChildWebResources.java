package ru.probpera.literaryplanet;

import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import com.getcapacitor.BridgeWebViewClient;
import java.io.InputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;

/** Real BridgeWebViewClient interception; no caller-created output or scheme
 * fallback exists. The separately counted original native output survives its
 * acquisition command, but never the original context/deadline/navigation. */
final class PlanetChildWebResources extends BridgeWebViewClient {
    static final String SCHEME="planet-child-resource",ORIGIN="https://localhost";
    private final MainActivity activity;
    private final WebView web;
    private final Map<String,Output> outputs=new LinkedHashMap<>();
    private volatile long navigationEpoch;
    private volatile PlanetChildVault.LocalV2AppOwner owner;
    private PlanetChildWebResources(MainActivity activity)throws Exception {
        super(activity.getBridge());this.activity=activity;web=activity.getBridge().getWebView();
        require(web!=null&&ORIGIN.equals(activity.getBridge().getLocalUrl()));
    }
    static PlanetChildWebResources install(MainActivity activity)throws Exception {
        require(activity!=null&&activity.getClass()==MainActivity.class&&android.os.Looper.myLooper()==android.os.Looper.getMainLooper());
        PlanetChildWebResources actual=new PlanetChildWebResources(activity);activity.getBridge().setWebViewClient(actual);return actual;
    }
    private static void require(boolean value)throws PlanetChildVault.Unavailable {if(!value)throw new PlanetChildVault.Unavailable();}
    static String token(String uri)throws Exception {
        require(uri!=null&&uri.matches("planet-child-resource://local/[a-f0-9]{32}"));return uri.substring(uri.length()-32);
    }
    long epoch(){return navigationEpoch;}
    WebView web(){return web;}
    void bind(PlanetChildVault.LocalV2AppOwner original)throws Exception {
        require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()&&original!=null&&original.activity==activity);
        require(owner==null||owner==original);owner=original;currentMain(web,navigationEpoch);
    }
    void currentMain(WebView actual,long epoch)throws Exception {
        require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()&&actual==web&&epoch==navigationEpoch
            &&activity.getBridge().getWebView()==web&&!activity.isFinishing()&&!activity.isDestroyed()&&activity.hasWindowFocus()
            &&web.getWindowToken()!=null&&web.getWindowToken()==activity.getWindow().getDecorView().getWindowToken());
        String page=web.getUrl();require(page!=null&&(page.equals(ORIGIN)||page.startsWith(ORIGIN+"/")));
    }
    Output adopt(PlanetChildVault.LocalV2WebOutputPermit permit,byte[] bytes)throws Exception {
        require(permit!=null&&permit.handler()==this);permit.checkTransfer(bytes);Output out=new Output(this,permit,bytes);
        synchronized(this){require(outputs.size()<2*PlanetChildModelImport.MAX_OUTPUTS&&!outputs.containsKey(out.token));permit.adoptOutput(out);outputs.put(out.token,out);}return out;
    }
    void forget(Output out)throws Exception {synchronized(this){require(out!=null&&outputs.get(out.token)==out&&out.knownClosed());outputs.remove(out.token);}}
    synchronized boolean registered(Output out){return out!=null&&outputs.get(out.token)==out;}
    private void navigation(WebView actual){
        if(actual!=web)return;ArrayList<Output> prior;PlanetChildVault.LocalV2AppOwner original;
        synchronized(this){if(navigationEpoch==Long.MAX_VALUE){original=owner;}else{navigationEpoch++;original=owner;}prior=new ArrayList<>(outputs.values());}
        for(Output out:prior)out.revoke();if(original!=null)original.invalidate("cancelled");
    }
    @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){navigation(view);super.onPageStarted(view,url,icon);}
    @Override public boolean onRenderProcessGone(WebView view,android.webkit.RenderProcessGoneDetail detail){navigation(view);return super.onRenderProcessGone(view,detail);}
    @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        if(request!=null&&SCHEME.equalsIgnoreCase(request.getUrl().getScheme())){navigation(view);return true;}return super.shouldOverrideUrlLoading(view,request);
    }
    private static WebResourceResponse denied(){return new WebResourceResponse("text/plain","UTF-8",403,"Unavailable",java.util.Collections.singletonMap("Cache-Control","no-store"),new java.io.ByteArrayInputStream(new byte[0]));}
    @Override public WebResourceResponse shouldInterceptRequest(WebView actual,WebResourceRequest request){
        if(request==null||request.getUrl()==null)return denied();
        if(!SCHEME.equalsIgnoreCase(request.getUrl().getScheme()))return super.shouldInterceptRequest(actual,request);
        InputStream stream=null;
        try{
            require(actual==web&&!request.isForMainFrame()&&!(android.os.Build.VERSION.SDK_INT>=24&&request.isRedirect())&&"GET".equals(request.getMethod()));String key=token(request.getUrl().toString());
            for(Map.Entry<String,String> h:request.getRequestHeaders().entrySet()){
                if("Origin".equalsIgnoreCase(h.getKey()))require(ORIGIN.equals(h.getValue()));
                if("Referer".equalsIgnoreCase(h.getKey()))require(h.getValue()!=null&&h.getValue().startsWith(ORIGIN+"/"));
            }
            Output out;synchronized(this){out=outputs.get(key);}require(out!=null);stream=out.open(actual,navigationEpoch);
            Map<String,String> headers=new LinkedHashMap<>();headers.put("Cache-Control","no-store, max-age=0");headers.put("Pragma","no-cache");
            headers.put("X-Content-Type-Options","nosniff");headers.put("Content-Length",Integer.toString(out.permit.bytes()));headers.put("Access-Control-Allow-Origin",ORIGIN);
            headers.put("Cross-Origin-Resource-Policy","cross-origin");headers.put("Vary","Origin");out.permit.checkOutput(out,actual,navigationEpoch);
            WebResourceResponse result=new WebResourceResponse(out.permit.mime(),null,200,"OK",headers,stream);stream=null;return result;
        }catch(Exception unavailable){return denied();}finally{if(stream!=null)try{stream.close();}catch(IOException ignored){}}
    }
    /** All retained encoded bytes and live reader objects belong to this exact
     * native output. revoke denies first; close joins admitted read callbacks,
     * closes every handler stream, then wipes the original buffer. */
    static final class Output {
        final String token,uri;final PlanetChildVault.LocalV2WebOutputPermit permit;
        private final PlanetChildWebResources handler;
        private final HashSet<OwnedStream> streams=new HashSet<>();
        private final HashSet<Chunk> chunks=new HashSet<>();
        private byte[] bytes;private volatile boolean revoked,closed;private int callbacks;
        private Output(PlanetChildWebResources handler,PlanetChildVault.LocalV2WebOutputPermit permit,byte[] bytes){this.handler=handler;this.permit=permit;this.bytes=bytes;token=permit.token();uri=SCHEME+"://local/"+token;}
        InputStream open(WebView actual,long epoch)throws Exception {
            permit.checkOutput(this,actual,epoch);synchronized(this){require(!revoked&&!closed&&bytes!=null&&streams.size()<4);OwnedStream stream=new OwnedStream(this,actual,epoch);streams.add(stream);return stream;}
        }
        void revoke(){ArrayList<OwnedStream> prior;synchronized(this){revoked=true;prior=new ArrayList<>(streams);}for(OwnedStream s:prior)s.close();}
        void closeJoined()throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());revoke();boolean interrupted=false;
            try{synchronized(this){while(callbacks!=0)try{wait(10);}catch(InterruptedException ignored){interrupted=true;}
                require(streams.isEmpty());for(Chunk chunk:new ArrayList<>(chunks))chunk.wipeLocked();require(chunks.isEmpty());if(bytes!=null){Arrays.fill(bytes,(byte)0);bytes=null;}closed=true;}}
            finally{if(interrupted)Thread.currentThread().interrupt();}
        }
        synchronized boolean admitsOutput(){return !revoked&&!closed&&bytes!=null;}
        synchronized boolean knownClosed(){return revoked&&closed&&bytes==null&&callbacks==0&&streams.isEmpty()&&chunks.isEmpty();}
        static void chunkRange(int total,long offset,int length)throws Exception {
            require(total>0&&total<=33554432&&offset>=0&&offset<total&&length>=1&&length<=65536&&length<=total-offset);
        }
        /** Only the original SDK worker may reserve an already authenticated
         * typed Output. Registered idle jobs can be cancelled without holding
         * a callback while another original command joins this Output. */
        Chunk reserveChunk(PlanetChildDataTransport.V2Request request)throws Exception {
            permit.checkChunkWorker(this,request);boolean admitted=false;byte[] copy=null;
            try {
                synchronized(this){require(!revoked&&!closed&&bytes!=null&&bytes.length==permit.bytes()&&chunks.isEmpty());chunkRange(bytes.length,request.offset,request.byteLength);callbacks++;admitted=true;}
                permit.checkChunkWorker(this,request);
                synchronized(this){require(!revoked&&!closed&&bytes!=null);copy=Arrays.copyOfRange(bytes,(int)request.offset,(int)request.offset+request.byteLength);}
                permit.checkChunkWorker(this,request);
                synchronized(this){require(!revoked&&!closed&&bytes!=null&&chunks.isEmpty());Chunk chunk=new Chunk(this,request,copy);chunks.add(chunk);copy=null;return chunk;}
            }finally{if(copy!=null)Arrays.fill(copy,(byte)0);if(admitted)synchronized(this){callbacks--;notifyAll();}}
        }
        /** Worker-only copy participates in the existing output callback join.
         * It never exports a token or permission to JS. Caller wipes the copy. */
        byte[] copyForTopology()throws Exception {
            permit.checkTopologyWorker(this);boolean admitted=false;byte[] copy=null;
            try{
                synchronized(this){require(!revoked&&!closed&&bytes!=null&&bytes.length==permit.bytes());callbacks++;admitted=true;copy=bytes.clone();}
                permit.verifyTopologyCopy(this,copy);byte[] result=copy;copy=null;return result;
            }finally{if(copy!=null)Arrays.fill(copy,(byte)0);if(admitted)synchronized(this){callbacks--;notifyAll();}}
        }
        static final class Chunk {
            interface Consumer {void complete(byte[] bytes)throws Exception;}
            final Output output;final PlanetChildDataTransport.V2Request request;
            final int offset,byteLength,totalBytes;private byte[] bytes;private boolean consuming,closed;
            private Chunk(Output output,PlanetChildDataTransport.V2Request request,byte[] bytes){this.output=output;this.request=request;this.bytes=bytes;offset=(int)request.offset;byteLength=request.byteLength;totalBytes=output.permit.bytes();}
            private void currentLocked()throws Exception {require(!closed&&!output.revoked&&!output.closed&&bytes!=null&&bytes.length==byteLength&&output.chunks.contains(this)&&output.bytes!=null);}
            boolean matches(PlanetChildDataTransport.V2Request actual){return request==actual;}
            /** The actual SDK callback owns this reservation on native main.
             * Output retirement joins it before either source or chunk wipe. */
            void consume(Consumer consumer)throws Exception {
                require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()&&consumer!=null);
                synchronized(output){currentLocked();require(!consuming);consuming=true;output.callbacks++;}
                try{output.permit.checkChunkMain(output,request);consumer.complete(bytes);}
                finally{synchronized(output){consuming=false;output.callbacks--;wipeLocked();output.notifyAll();}}
            }
            private void wipeLocked(){if(bytes!=null){Arrays.fill(bytes,(byte)0);bytes=null;}closed=true;output.chunks.remove(this);}
            void close()throws Exception {synchronized(output){require(!consuming);wipeLocked();output.notifyAll();}}
            boolean knownClosed(){synchronized(output){return closed&&bytes==null&&!consuming&&!output.chunks.contains(this);}}
        }
        private int read(OwnedStream s,byte[] target,int start,int count)throws IOException {
            if(target==null)throw new NullPointerException();if(start<0||count<0||start>target.length-count)throw new IndexOutOfBoundsException();
            boolean admitted=false,eof=false;int copied=0;
            try{synchronized(this){require(!revoked&&!closed&&!s.closed&&streams.contains(s)&&bytes!=null);callbacks++;admitted=true;}
                permit.checkOutput(this,s.web,s.epoch);
                synchronized(this){require(!revoked&&!closed&&!s.closed&&bytes!=null);eof=count>0&&s.position==bytes.length;
                    if(!eof){copied=Math.min(Math.min(8192,count),bytes.length-s.position);System.arraycopy(bytes,s.position,target,start,copied);s.position+=copied;}}
                permit.checkOutput(this,s.web,s.epoch);return eof?-1:copied;
            }catch(Exception unavailable){if(copied>0)Arrays.fill(target,start,start+copied,(byte)0);s.close();throw new IOException("Native child resource unavailable",unavailable);}
            finally{if(admitted)synchronized(this){callbacks--;notifyAll();}}
        }
        private static final class OwnedStream extends InputStream {
            final Output output;final WebView web;final long epoch;final Thread handlerWorker=Thread.currentThread();private Thread readWorker;int position;volatile boolean closed;
            OwnedStream(Output output,WebView web,long epoch){this.output=output;this.web=web;this.epoch=epoch;}
            @Override public int read()throws IOException {byte[] one=new byte[1];try{int count=read(one,0,1);return count<0?-1:one[0]&255;}finally{one[0]=0;}}
            @Override public synchronized int read(byte[] bytes,int start,int count)throws IOException {if(readWorker==null)readWorker=Thread.currentThread();if(readWorker!=Thread.currentThread())throw new IOException("Native child output reader mismatch");return output.read(this,bytes,start,count);}
            @Override public void close(){synchronized(output){closed=true;output.streams.remove(this);output.notifyAll();}}
            @Override public boolean markSupported(){return false;}
        }
    }
}