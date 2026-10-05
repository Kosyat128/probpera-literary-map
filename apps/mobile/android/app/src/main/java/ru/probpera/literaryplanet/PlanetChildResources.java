package ru.probpera.literaryplanet;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.MessageDigest;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;

/** Native acquisition owns the actual socket, input, worker and buffers.
 * Only Vault's private original SDK claim may enter this reader. Fixed catalog
 * parsing is source data, never a factory for a live child/media permission. */
final class PlanetChildResources {
    static final String CATALOG="child-native/resources/catalog-v2.json";
    static final int MAX_CATALOG=524288,MAX_RASTER=33554432,MAX_AUDIO=25165824;
    private static void require(boolean value)throws PlanetChildVault.Unavailable {if(!value)throw new PlanetChildVault.Unavailable();}
    private static String hash(byte[] value)throws Exception {byte[] digest=MessageDigest.getInstance("SHA-256").digest(value);try{StringBuilder out=new StringBuilder(64);for(byte b:digest){out.append("0123456789abcdef".charAt((b>>>4)&15));out.append("0123456789abcdef".charAt(b&15));}return out.toString();}finally{Arrays.fill(digest,(byte)0);}}
    static String canonicalOrigin(String raw)throws Exception {
        require(raw!=null&&raw.length()<=512&&raw.matches("https://[a-z0-9.-]+"));URI url=new URI(raw);
        String host=url.getHost();require(host!=null&&host.length()<=253&&raw.equals("https://"+host)&&url.getRawUserInfo()==null&&url.getPort()==-1&&url.getRawQuery()==null&&url.getRawFragment()==null&&url.getRawPath().isEmpty());
        String[] labels=host.split("\\.",-1);require(labels.length>=2&&!host.matches("[0-9.]+"));
        for(String label:labels)require(label.matches("[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"));
        require(!Arrays.asList("localhost","local","internal","lan","home").contains(labels[labels.length-1]));return raw;
    }
    static String canonicalPath(String checksum,String mime)throws Exception {
        require(checksum!=null&&checksum.matches("[a-f0-9]{64}"));String extension;
        if("image/png".equals(mime))extension="png";else if("image/jpeg".equals(mime))extension="jpg";else if("image/webp".equals(mime))extension="webp";else{require("audio/wav".equals(mime));extension="wav";}
        return "/objects/"+checksum+"."+extension;
    }
    static long originalRemaining(long deadline,long continuousNow,long until,long wallNow)throws Exception {
        require(deadline>0&&continuousNow>=0&&until>=0&&wallNow>=0&&wallNow<=8640000000000000L);
        long remaining=Math.min(deadline-continuousNow,until-wallNow);require(remaining>0&&remaining<=60000);return remaining;
    }
    static void verifyEncoded(byte[] bytes,int count,String checksum)throws Exception {require(bytes!=null&&count>0&&bytes.length==count&&hash(bytes).equals(checksum));}
    static boolean publicAddress(InetAddress address) {
        if(address==null||address.isAnyLocalAddress()||address.isLoopbackAddress()||address.isLinkLocalAddress()||address.isSiteLocalAddress()||address.isMulticastAddress())return false;
        byte[] b=address.getAddress();if(b.length==4){int a=b[0]&255,c=b[1]&255,d=b[2]&255;
            return a!=0&&a!=10&&a!=127&&a<224&&!(a==100&&c>=64&&c<=127)&&!(a==169&&c==254)&&!(a==172&&c>=16&&c<=31)&&!(a==192&&(c==168||c==0||c==2))&&!(a==198&&(c==18||c==19||c==51&&d==100))&&!(a==203&&c==0&&d==113);
        }return b.length==16&&(b[0]&0xe0)==0x20&&!((b[0]&255)==0x20&&(b[1]&255)==1&&(b[2]&255)==0x0d&&(b[3]&255)==0xb8);
    }
    static String tlsKeyChecksum(java.security.PublicKey raw)throws Exception {
        require(raw instanceof ECPublicKey);ECPublicKey key=(ECPublicKey)raw;
        AlgorithmParameters algorithm=AlgorithmParameters.getInstance("EC");algorithm.init(new ECGenParameterSpec("secp256r1"));ECParameterSpec p=algorithm.getParameterSpec(ECParameterSpec.class),actual=key.getParams();
        require(actual!=null&&actual.getCurve().equals(p.getCurve())&&actual.getGenerator().equals(p.getGenerator())&&actual.getOrder().equals(p.getOrder())&&actual.getCofactor()==p.getCofactor());
        byte[] point=new byte[65];point[0]=4;byte[] x=key.getW().getAffineX().toByteArray(),y=key.getW().getAffineY().toByteArray();
        try{int nx=x.length==33&&x[0]==0?32:x.length,ny=y.length==33&&y[0]==0?32:y.length;require(nx<=32&&ny<=32&&key.getW().getAffineX().signum()>=0&&key.getW().getAffineY().signum()>=0);System.arraycopy(x,x.length-nx,point,33-nx,nx);System.arraycopy(y,y.length-ny,point,65-ny,ny);return hash(point);}finally{Arrays.fill(point,(byte)0);Arrays.fill(x,(byte)0);Arrays.fill(y,(byte)0);}
    }
    /** Bounded raw HTTP transport has no cookie jar, response cache, redirect
     * handler, ambient credentials, proxy or caller-supplied header surface. */
    static void responseHeaders(String status,Map<String,String> headers,String mime,int bytes)throws Exception {
        canonicalPath("0".repeat(64),mime);require(status!=null&&status.matches("HTTP/1\\.[01] 200(?: [\\x20-\\x7e]*)?")&&headers!=null&&bytes>0&&bytes<=("audio/wav".equals(mime)?MAX_AUDIO:MAX_RASTER));
        require(mime.equals(headers.get("content-type"))&&Integer.toString(bytes).equals(headers.get("content-length"))&&!headers.containsKey("transfer-encoding")&&!headers.containsKey("location")&&(!headers.containsKey("content-encoding")||"identity".equals(headers.get("content-encoding"))));
    }
    private static String line(InputStream input,int bound)throws Exception {
        byte[] scratch=new byte[bound];int used=0;try{for(;;){int b=input.read();require(b>=0);if(b==13){require(input.read()==10);return new String(scratch,0,used,StandardCharsets.US_ASCII);}require(b>=32&&b<=126&&used<bound);scratch[used++]=(byte)b;}}finally{Arrays.fill(scratch,(byte)0);}
    }
    static byte[] boundedBody(InputStream input,int bytes,String checksum)throws Exception {
        require(input!=null&&bytes>0&&bytes<=MAX_RASTER);byte[] owned=new byte[bytes];boolean kept=false;
        try{int used=0;while(used<bytes){int n=input.read(owned,used,Math.min(8192,bytes-used));require(n>0);used+=n;}require(input.read()==-1);verifyEncoded(owned,bytes,checksum);kept=true;return owned;}finally{if(!kept)Arrays.fill(owned,(byte)0);}
    }
    private final PlanetChildVault.LocalV2ResourceClaim claim;
    private volatile boolean revoked,finished,closed;
    private volatile Thread worker,cancelWorker;
    private volatile Exception failure,cleanupFailure;
    private Socket socket;private InputStream input;private byte[] owned;
    private PlanetChildResources(PlanetChildVault.LocalV2ResourceClaim claim)throws Exception {require(claim!=null);this.claim=claim;claim.checkIssuerWorker();}
    static PlanetChildResources original(PlanetChildVault.LocalV2ResourceClaim claim)throws Exception{return new PlanetChildResources(claim);}
    private synchronized void own(Socket actual)throws Exception {require(!revoked&&!closed&&socket==null&&actual!=null);socket=actual;}
    private synchronized void replace(Socket before,Socket actual)throws Exception {require(!revoked&&!closed&&socket==before);socket=actual;}
    private synchronized void own(InputStream actual)throws Exception {require(!revoked&&!closed&&input==null&&actual!=null);input=actual;}
    private void checkRead()throws Exception {require(!revoked&&!closed&&Thread.currentThread()==worker);claim.checkRead(this);}
    private void cleanupTransport() {
        InputStream stream;Socket transport;synchronized(this){stream=input;input=null;transport=socket;socket=null;}
        Throwable failure=null;try{if(transport!=null)transport.close();}catch(Throwable error){failure=error;}
        try{if(stream!=null)stream.close();}catch(Throwable error){if(failure==null)failure=error;else failure.addSuppressed(error);}
        if(failure!=null)cleanupFailure=failure instanceof Exception?(Exception)failure:new PlanetChildVault.Unavailable();
    }
    void revoke() {
        Thread actual;
        synchronized(this){revoked=true;actual=worker;if(cancelWorker==null&&!closed){cancelWorker=new Thread(this::cleanupTransport,"planet-child-resource-cancel-close");cancelWorker.start();}}
        if(actual!=null)actual.interrupt();
    }
    // The read worker takes ownership before the final current check, so a
    // revocation immediately after EOF still wipes the completed body.
    private byte[] acquire()throws Exception {
        checkRead();if(!claim.remote()){InputStream bundled=claim.openBundle(this);boolean accepted=false;try{own(bundled);accepted=true;return boundedBody(bundled,claim.bytes(),claim.checksum());}finally{if(!accepted)bundled.close();}}
        String origin=canonicalOrigin(claim.origin()),path=canonicalPath(claim.checksum(),claim.mime());require(path.equals(claim.path())&&origin.length()+path.length()<=1024);
        String host=new URI(origin).getHost();InetAddress[] addresses=InetAddress.getAllByName(host);require(addresses.length>0&&addresses.length<=16);for(InetAddress address:addresses)require(publicAddress(address));checkRead();
        Socket raw=new Socket();boolean accepted=false;try{own(raw);accepted=true;raw.connect(new InetSocketAddress(addresses[0],443),1000);raw.setSoTimeout(1000);checkRead();
            SSLContext tls=SSLContext.getInstance("TLS");tls.init(null,null,null);SSLSocket secure=(SSLSocket)tls.getSocketFactory().createSocket(raw,host,443,true);boolean retained=false;
            try{replace(raw,secure);retained=true;secure.setSoTimeout(1000);SSLParameters params=secure.getSSLParameters();params.setEndpointIdentificationAlgorithm("HTTPS");params.setServerNames(java.util.Collections.singletonList(new javax.net.ssl.SNIHostName(host)));secure.setSSLParameters(params);secure.startHandshake();checkRead();
                java.security.cert.Certificate[] peer=secure.getSession().getPeerCertificates();require(peer.length>0&&claim.tlsKeyChecksums().contains(tlsKeyChecksum(peer[0].getPublicKey())));checkRead();
                OutputStream output=secure.getOutputStream();byte[] request=("GET "+path+" HTTP/1.1\r\nHost: "+host+"\r\nAccept: "+claim.mime()+"\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII);try{output.write(request);output.flush();}finally{Arrays.fill(request,(byte)0);}checkRead();
                InputStream response=secure.getInputStream();own(response);String status=line(response,1024);Map<String,String> headers=new HashMap<>();int total=status.length()+2;
                for(int count=0;;count++){require(count<64);String header=line(response,8192);total+=header.length()+2;require(total<=16384);if(header.isEmpty())break;int colon=header.indexOf(':');require(colon>0);String name=header.substring(0,colon);require(name.matches("[A-Za-z0-9!#$%&'*+.^_`|~-]+"));String key=name.toLowerCase(Locale.ROOT),value=header.substring(colon+1).trim();require(headers.put(key,value)==null);checkRead();}
                responseHeaders(status,headers,claim.mime(),claim.bytes());checkRead();return boundedBody(response,claim.bytes(),claim.checksum());
            }finally{if(!retained)secure.close();}
        }finally{if(!accepted)raw.close();}
    }
    byte[] readOwned()throws Exception {
        claim.checkIssuerWorker();synchronized(this){require(worker==null&&!revoked&&!closed);worker=new Thread(()->{byte[] bytes=null;try{bytes=acquire();checkRead();synchronized(this){require(!revoked);owned=bytes;bytes=null;}}catch(Throwable error){failure=error instanceof Exception?(Exception)error:new PlanetChildVault.Unavailable();}finally{if(bytes!=null)Arrays.fill(bytes,(byte)0);cleanupTransport();finished=true;}},"planet-child-resource-read");worker.start();}
        boolean transferred=false;try{while(!finished){claim.checkIssuerWorker();worker.join(10);}claim.checkIssuerWorker();joinThreads();claim.checkIssuerWorker();byte[] result;synchronized(this){require(!revoked&&failure==null&&cleanupFailure==null&&owned!=null&&socket==null&&input==null&&(worker==null||!worker.isAlive())&&(cancelWorker==null||!cancelWorker.isAlive()));result=owned;owned=null;closed=true;}transferred=true;return result;}
        finally{if(!transferred){revoke();closeJoined();}}
    }
    private void joinThreads()throws Exception {
        require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());boolean interrupted=false;
        try{Thread actual=worker;if(actual!=null){require(actual!=Thread.currentThread());for(;;)try{actual.join();break;}catch(InterruptedException ignored){interrupted=true;}}Thread cancel=cancelWorker;if(cancel!=null){require(cancel!=Thread.currentThread());for(;;)try{cancel.join();break;}catch(InterruptedException ignored){interrupted=true;}}}finally{if(interrupted)Thread.currentThread().interrupt();}
    }
    void closeJoined()throws Exception {revoke();joinThreads();cleanupTransport();synchronized(this){if(owned!=null){Arrays.fill(owned,(byte)0);owned=null;}closed=true;}require(cleanupFailure==null);}
    synchronized boolean knownClosed(){return closed&&owned==null&&input==null&&socket==null&&(worker==null||!worker.isAlive())&&(cancelWorker==null||!cancelWorker.isAlive())&&cleanupFailure==null;}
    boolean ownsReadThread(){return Thread.currentThread()==worker;}
}