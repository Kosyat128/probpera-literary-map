package ru.probpera.literaryplanet;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.Arrays;
import java.util.Map;

/** LOCAL2 bounded native codec/recipient. A genuine private Vault permit is
 * the only input authority. Encoded bytes, decoded pixels and PCM never cross
 * Capacitor or create a WebView/file/network URL. */
final class PlanetChildMedia {
    private PlanetChildMedia() {}
    static final int MAX_DIMENSION=2048,MAX_PIXELS=4*1024*1024,MAX_IMAGE_BYTES=32*1024*1024,MAX_AUDIO_BYTES=24*1024*1024;
    static final class Header {
        final int width,height,channels,rate,bits,offset,length;
        private Header(int w,int h,int c,int r,int b,int o,int n){width=w;height=h;channels=c;rate=r;bits=b;offset=o;length=n;}
        boolean audio(){return channels!=0;}
    }
    private static void require(boolean value)throws Exception {if(!value)throw new PlanetChildVault.Unavailable();}
    private static boolean ascii(byte[] b,int p,String s){if(p<0||p+s.length()>b.length)return false;for(int i=0;i<s.length();i++)if((b[p+i]&255)!=s.charAt(i))return false;return true;}
    private static int u16(byte[] b,int p,boolean le)throws Exception {require(p>=0&&p+2<=b.length);return le?(b[p]&255)|((b[p+1]&255)<<8):((b[p]&255)<<8)|(b[p+1]&255);}
    private static long u32(byte[] b,int p,boolean le)throws Exception {require(p>=0&&p+4<=b.length);long n=0;for(int i=0;i<4;i++)n=(n<<8)|(b[p+(le?3-i:i)]&255);return n;}
    private static int u24(byte[] b,int p)throws Exception {require(p>=0&&p+3<=b.length);return (b[p]&255)|((b[p+1]&255)<<8)|((b[p+2]&255)<<16);}
    private static Header image(long w,long h)throws Exception {require(w>0&&h>0&&w<=MAX_DIMENSION&&h<=MAX_DIMENSION&&w*h<=MAX_PIXELS);return new Header((int)w,(int)h,0,0,0,0,0);}
    /** Container/resource validation alone grants no content or playback. */
    static long sourceFrame(int full,int start,long rendered)throws Exception {require(full>0&&start>=0&&start<full&&rendered>=0&&rendered<=full-start);return Math.min(full-1L,start+rendered);}
    static Header preflight(byte[] b,String mime)throws Exception {
        require(b!=null&&b.length>0&&b.length<=("audio/wav".equals(mime)?MAX_AUDIO_BYTES:MAX_IMAGE_BYTES));
        if("image/png".equals(mime)){
            require(b.length>=33&&Arrays.equals(Arrays.copyOf(b,8),new byte[]{(byte)137,80,78,71,13,10,26,10}));
            int at=8,chunks=0;Header h=null;boolean data=false,end=false;
            while(at<b.length){require(++chunks<=4096&&at+12<=b.length);long size=u32(b,at,false),next=(long)at+12+size;require(next<=b.length);int p=at+8;java.util.zip.CRC32 crc=new java.util.zip.CRC32();crc.update(b,at+4,(int)size+4);require(crc.getValue()==u32(b,at+8+(int)size,false));
                require(!ascii(b,at+4,"acTL")&&!ascii(b,at+4,"fcTL")&&!ascii(b,at+4,"fdAT"));
                if(ascii(b,at+4,"IHDR")){require(at==8&&size==13&&h==null);h=image(u32(b,p,false),u32(b,p+4,false));int depth=b[p+8]&255,color=b[p+9]&255;
                    require((color==0&&(depth==1||depth==2||depth==4||depth==8||depth==16))||(color==2||color==4||color==6)&&(depth==8||depth==16)||color==3&&(depth==1||depth==2||depth==4||depth==8));
                    require(b[p+10]==0&&b[p+11]==0&&(b[p+12]&255)<=1);
                }else require(h!=null);
                if(ascii(b,at+4,"IDAT")){require(!end);data=true;}
                if(ascii(b,at+4,"IEND")){require(size==0&&next==b.length&&data);end=true;}at=(int)next;
            }require(end&&h!=null);return h;
        }
        if("image/jpeg".equals(mime)){
            require(b.length>=4&&(b[0]&255)==255&&(b[1]&255)==216);int at=2,count=0,components=0;boolean scan=false,scanned=false;Header h=null;
            while(at<b.length){int marker=-1;
                if(scan){while(at<b.length){if((b[at++]&255)!=255)continue;while(at<b.length&&(b[at]&255)==255)at++;require(at<b.length);int n=b[at++]&255;if(n==0||n>=208&&n<=215)continue;marker=n;scan=false;break;}}
                else{require((b[at++]&255)==255);while(at<b.length&&(b[at]&255)==255)at++;require(at<b.length);marker=b[at++]&255;}
                require(++count<=4096&&marker>=0);if(marker==217){require(h!=null&&scanned&&at==b.length);return h;}
                require(marker==192||marker==194||marker==196||marker==218||marker==219||marker==221||marker==254||marker>=224&&marker<=239);
                int size=u16(b,at,false),next=at+size;require(size>=2&&next<=b.length-2);
                if(marker==192||marker==194){require(h==null&&size>=8&&(b[at+2]&255)==8);components=b[at+7]&255;require((components==1||components==3||components==4)&&size==8+3*components);h=image(u16(b,at+5,false),u16(b,at+3,false));}
                if(marker==218){require(h!=null&&size>=6);int c=b[at+2]&255;require(c>=1&&c<=components&&size==6+2*c);scan=true;scanned=true;}at=next;
            }throw new PlanetChildVault.Unavailable();
        }
        if("image/webp".equals(mime)){
            require(b.length>=20&&ascii(b,0,"RIFF")&&ascii(b,8,"WEBP")&&u32(b,4,true)+8==b.length);
            int at=12,count=0;Header canvas=null,coded=null;
            while(at<b.length){require(++count<=4096&&at+8<=b.length);long size=u32(b,at+4,true);int p=at+8;long next=(long)p+size+(size&1);require(next<=b.length&&((size&1)==0||b[p+(int)size]==0));
                require(!ascii(b,at,"ANIM")&&!ascii(b,at,"ANMF"));
                if(ascii(b,at,"VP8X")){require(at==12&&canvas==null&&size==10&&(b[p]&0xc3)==0&&b[p+1]==0&&b[p+2]==0&&b[p+3]==0);canvas=image(u24(b,p+4)+1,u24(b,p+7)+1);}
                else if(ascii(b,at,"VP8 ")){require(coded==null&&size>=10&&(b[p]&1)==0&&(b[p+3]&255)==157&&b[p+4]==1&&b[p+5]==42);coded=image(u16(b,p+6,true)&0x3fff,u16(b,p+8,true)&0x3fff);}
                else if(ascii(b,at,"VP8L")){require(coded==null&&size>=5&&(b[p]&255)==47&&(b[p+4]&0xe0)==0);long packed=u32(b,p+1,true);coded=image((packed&0x3fff)+1,((packed>>>14)&0x3fff)+1);}
                at=(int)next;
            }require(coded!=null&&(canvas==null||canvas.width==coded.width&&canvas.height==coded.height));return coded;
        }
        if("audio/wav".equals(mime)){
            require(b.length>=44&&ascii(b,0,"RIFF")&&ascii(b,8,"WAVE")&&u32(b,4,true)+8==b.length);
            int at=12,count=0,channels=0,rate=0,bits=0,block=0,offset=-1,length=0;
            while(at<b.length){require(++count<=4096&&at+8<=b.length);long size=u32(b,at+4,true);int p=at+8;long next=(long)p+size+(size&1);require(next<=b.length&&((size&1)==0||b[p+(int)size]==0));
                if(ascii(b,at,"fmt ")){require(channels==0&&at==12&&size==16&&u16(b,p,true)==1);channels=u16(b,p+2,true);rate=(int)u32(b,p+4,true);bits=u16(b,p+14,true);block=channels*bits/8;
                    require(channels>=1&&channels<=2&&rate>=8000&&rate<=48000&&(bits==8||bits==16)&&u16(b,p+12,true)==block&&u32(b,p+8,true)==(long)block*rate);
                }else if(ascii(b,at,"data")){require(channels!=0&&offset==-1&&size>0&&size<=MAX_AUDIO_BYTES);offset=p;length=(int)size;}at=(int)next;
            }require(channels!=0&&offset>=0&&length%block==0&&(long)length/block<=60L*rate&&(long)length/block*channels*4<=MAX_AUDIO_BYTES);
            return new Header(0,0,channels,rate,bits,offset,length);
        }
        throw new PlanetChildVault.Unavailable();
    }
    /** One exclusive actual owned surface. Registration and attachment happen
     * in one main transaction, before any pixels or Play control is visible. */
    static final class Owner {
        final PlanetChildVault.LocalV2MediaPermit permit;
        final String token;
        private byte[] encoded,pcm;
        private Bitmap bitmap;
        private Header header;
        private volatile boolean concealed,closed;
        private volatile AudioTrack track;
        private volatile Thread playback;
        private volatile Exception playbackFailure;
        private volatile long observedSourceFrame=-1,observedSequence;private int sourceStartFrame;
        private FrameLayout view;
        private Button play,stop,mute;private android.widget.SeekBar volumeControl;private volatile float volume=0.7f;private AudioManager audioManager;private AudioManager.OnAudioFocusChangeListener focusListener;private android.media.AudioDeviceCallback devices;private android.content.BroadcastReceiver noisy;private boolean noisyRegistered,focusGranted;private final android.os.Handler main=new android.os.Handler(Looper.getMainLooper());private Runnable watch;
        private Owner(PlanetChildVault.LocalV2MediaPermit permit,byte[] owned)throws Exception {
            require(permit!=null);this.permit=permit;permit.checkWorker();token=permit.presentationToken();
            encoded=owned;boolean ready=false;
            try{permit.verifyEncoded(encoded);header=preflight(encoded,permit.mime());permit.validateCueHeader(header);
                if(header.audio())pcm=Arrays.copyOfRange(encoded,header.offset,header.offset+header.length);
                else{BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(encoded,0,encoded.length,bounds);
                    require(header.width==bounds.outWidth&&header.height==bounds.outHeight&&permit.mime().equals(bounds.outMimeType));
                    BitmapFactory.Options options=new BitmapFactory.Options();options.inPreferredConfig=Bitmap.Config.ARGB_8888;options.inScaled=false;
                    bitmap=BitmapFactory.decodeByteArray(encoded,0,encoded.length,options);require(bitmap!=null&&!bitmap.isRecycled()&&bitmap.getWidth()==header.width&&bitmap.getHeight()==header.height&&bitmap.getAllocationByteCount()<=MAX_PIXELS*4);
                }permit.checkWorker();ready=true;
            }finally{if(encoded!=null){Arrays.fill(encoded,(byte)0);encoded=null;}if(!ready)closeJoined();}
        }
        static Owner decode(PlanetChildVault.LocalV2MediaPermit permit,byte[] owned)throws Exception{return new Owner(permit,owned);}
        void publish(Map<String,Object> geometry)throws Exception {
            permit.checkWorker();
            permit.onMain(()->{permit.checkMain();require(!closed&&!concealed&&view==null);FrameLayout parent=permit.surface();double scale=permit.nativeScale(geometry);
                int x=(int)Math.round(((Number)geometry.get("x")).doubleValue()*scale),y=(int)Math.round(((Number)geometry.get("y")).doubleValue()*scale);
                int width=(int)Math.round(((Number)geometry.get("width")).doubleValue()*scale),height=(int)Math.round(((Number)geometry.get("height")).doubleValue()*scale);
                require(width>0&&height>0&&x>=0&&y>=0&&x+width<=parent.getWidth()&&y+height<=parent.getHeight());
                view=new FrameLayout(parent.getContext());view.setContentDescription(permit.altText());view.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
                if(bitmap!=null){ImageView image=new ImageView(parent.getContext());image.setImageBitmap(bitmap);image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setContentDescription(permit.altText());view.addView(image,new FrameLayout.LayoutParams(-1,-1));}
                else{LinearLayout audio=new LinearLayout(parent.getContext());audio.setOrientation(LinearLayout.VERTICAL);android.widget.ScrollView reading=new android.widget.ScrollView(parent.getContext());reading.setFillViewport(true);TextView transcript=new TextView(parent.getContext());transcript.setText(permit.transcript());transcript.setContentDescription(permit.localized(R.string.native_child_audio_transcript)+": "+permit.transcript());transcript.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
                    LinearLayout controls=new LinearLayout(parent.getContext());controls.setOrientation(LinearLayout.HORIZONTAL);int target=(int)Math.ceil(48*parent.getResources().getDisplayMetrics().density);
                    play=new Button(parent.getContext());play.setText(permit.localized(R.string.native_child_audio_play));play.setContentDescription(permit.localized(R.string.native_child_audio_play));play.setMinHeight(target);play.setMinWidth(target);play.setEnabled(permit.audioAllowed());play.setOnClickListener(v->{try{permit.checkMain();permit.nativePlay(this);play.setEnabled(false);}catch(Exception denied){concealMain();permit.unknown();}});controls.addView(play,new LinearLayout.LayoutParams(0,-2,1));stop=new Button(parent.getContext());stop.setText(permit.localized(R.string.native_child_audio_stop));stop.setContentDescription(permit.localized(R.string.native_child_audio_stop));stop.setMinHeight(target);stop.setMinWidth(target);stop.setOnClickListener(v->{try{permit.nativeStop(this);}catch(Exception denied){concealMain();permit.unknown();}});controls.addView(stop,new LinearLayout.LayoutParams(0,-2,1));
                    mute=new Button(parent.getContext());mute.setText(permit.localized(R.string.native_child_audio_mute));mute.setContentDescription(permit.localized(R.string.native_child_audio_mute));mute.setMinHeight(target);mute.setMinWidth(target);mute.setEnabled(permit.audioAllowed());mute.setOnClickListener(v->{try{volumeMain(volume>0f?0f:0.7f);if(volumeControl!=null)volumeControl.setProgress(Math.round(volume*100));mute.setText(permit.localized(volume==0f?R.string.native_child_audio_unmute:R.string.native_child_audio_mute));mute.setContentDescription(mute.getText());}catch(Exception denied){concealMain();permit.unknown();}});controls.addView(mute,new LinearLayout.LayoutParams(0,-2,1));audio.addView(controls);
                    volumeControl=new android.widget.SeekBar(parent.getContext());volumeControl.setMax(100);volumeControl.setProgress(Math.round(volume*100));volumeControl.setMinimumHeight(target);volumeControl.setContentDescription(permit.localized(R.string.native_child_audio_volume));volumeControl.setEnabled(permit.audioAllowed());volumeControl.setOnSeekBarChangeListener(new android.widget.SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(android.widget.SeekBar bar,int progress,boolean user){if(!user)return;try{volumeMain(progress/100f);if(mute!=null){mute.setText(permit.localized(volume==0f?R.string.native_child_audio_unmute:R.string.native_child_audio_mute));mute.setContentDescription(mute.getText());}}catch(Exception denied){concealMain();permit.unknown();}}public void onStartTrackingTouch(android.widget.SeekBar bar){}public void onStopTrackingTouch(android.widget.SeekBar bar){}});audio.addView(volumeControl,new LinearLayout.LayoutParams(-1,-2));audio.addView(transcript,new LinearLayout.LayoutParams(-1,-2));reading.addView(audio,new android.widget.ScrollView.LayoutParams(-1,-2));view.addView(reading,new FrameLayout.LayoutParams(-1,-1));}
                FrameLayout.LayoutParams layout=new FrameLayout.LayoutParams(width,height);layout.leftMargin=x;layout.topMargin=y;
                permit.registerMain(this,view,layout);permit.checkMain();watch=new Runnable(){public void run(){if(closed||concealed)return;try{permit.checkMain();require(playbackFailure==null);require(main.postDelayed(this,10));}catch(Exception expired){concealMain();permit.outputExpired(Owner.this);}}};require(main.post(watch));return null;
            });permit.checkWorker();
        }
        /** Source-frame observations come only from this owned AudioTrack, never JS or elapsed seconds. */
        private void observePlayback(AudioTrack actual)throws Exception {permit.checkOutput();require(track==actual&&header!=null&&header.audio()&&!closed&&!concealed);if(actual.getPlayState()==AudioTrack.PLAYSTATE_STOPPED)return;long played=Integer.toUnsignedLong(actual.getPlaybackHeadPosition()),full=header.length/(header.channels*header.bits/8);require(played<=full-sourceStartFrame);long frame=sourceFrame((int)full,sourceStartFrame,played);require(frame>=observedSourceFrame);observedSourceFrame=frame;permit.observedFrames(this,observedSequence,frame);}
        boolean ownsPlaybackThread(){return playback==Thread.currentThread();}
        long observedFrame(){return observedSourceFrame;}long observationSequence(){return observedSequence;}
        boolean observationCurrent(long sequence,long frame){return !closed&&!concealed&&sequence>0&&sequence==observedSequence&&header!=null&&frame>=sourceStartFrame&&frame<header.length/(header.channels*header.bits/8)&&frame<=observedSourceFrame;}
        void pauseForCheckpointMain()throws Exception {permit.checkMain();AudioTrack actual=track;if(actual!=null){observePlayback(actual);require(actual.setVolume(0f)==AudioTrack.SUCCESS);actual.pause();}if(play!=null)play.setEnabled(false);if(stop!=null)stop.setEnabled(false);}
        /** Revocation is immediate; later joins establish retirement. */
        void concealMain() {
            concealed=true;AudioTrack actual=track;if(actual!=null)try{actual.setVolume(0f);actual.pause();}catch(Throwable error){playbackFailure=new PlanetChildVault.Unavailable();}
            if(view!=null){view.setVisibility(View.GONE);view.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);}
            if(play!=null)play.setEnabled(false);if(stop!=null)stop.setEnabled(false);if(mute!=null)mute.setEnabled(false);if(volumeControl!=null)volumeControl.setEnabled(false);
        }
        private String outputTopology(AudioManager manager){java.util.ArrayList<String> rows=new java.util.ArrayList<>();for(android.media.AudioDeviceInfo device:manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS))rows.add(device.getId()+":"+device.getType());java.util.Collections.sort(rows);return rows.toString();}
        private void interrupted(){Runnable revoke=()->{if(closed||concealed)return;concealMain();permit.outputExpired(Owner.this);};if(Looper.myLooper()==Looper.getMainLooper())revoke.run();else main.post(revoke);}
        private void acquireAudioFocus(PlanetChildVault.LocalV2MediaPermit playPermit)throws Exception {
            playPermit.onMain(()->{playPermit.checkMain();require(!closed&&!concealed&&audioManager==null);audioManager=(AudioManager)permit.surface().getContext().getSystemService(android.content.Context.AUDIO_SERVICE);require(audioManager!=null);focusListener=change->{if(change!=AudioManager.AUDIOFOCUS_GAIN)interrupted();};require(audioManager.requestAudioFocus(focusListener,AudioManager.STREAM_MUSIC,AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED);focusGranted=true;
                final String topology=outputTopology(audioManager);devices=new android.media.AudioDeviceCallback(){@Override public void onAudioDevicesAdded(android.media.AudioDeviceInfo[] added){if(audioManager!=null&&!topology.equals(outputTopology(audioManager)))interrupted();}@Override public void onAudioDevicesRemoved(android.media.AudioDeviceInfo[] removed){if(audioManager!=null&&!topology.equals(outputTopology(audioManager)))interrupted();}};audioManager.registerAudioDeviceCallback(devices,main);
                noisy=new android.content.BroadcastReceiver(){@Override public void onReceive(android.content.Context context,android.content.Intent intent){if(AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction()))interrupted();}};android.content.Context context=permit.surface().getContext();android.content.IntentFilter filter=new android.content.IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);if(android.os.Build.VERSION.SDK_INT>=33)context.registerReceiver(noisy,filter,android.content.Context.RECEIVER_NOT_EXPORTED);else context.registerReceiver(noisy,filter);noisyRegistered=true;return null;});playPermit.checkWorker();
        }
        private void volumeMain(float value)throws Exception {permit.checkMain();require(!closed&&!concealed&&Float.isFinite(value)&&value>=0f&&value<=1f);volume=value;AudioTrack actual=track;if(actual!=null)require(actual.setVolume(value)==AudioTrack.SUCCESS);}
        private void releaseAudioFocusMain(){if(audioManager!=null){if(devices!=null){audioManager.unregisterAudioDeviceCallback(devices);devices=null;}if(focusGranted&&focusListener!=null)audioManager.abandonAudioFocus(focusListener);}if(noisyRegistered){permit.surface().getContext().unregisterReceiver(noisy);noisyRegistered=false;}noisy=null;focusListener=null;focusGranted=false;audioManager=null;}
        void beginNativePlayback(PlanetChildVault.LocalV2MediaPermit playPermit)throws Exception {
            require(permit.sameOutput(playPermit));playPermit.checkWorker();require(header!=null&&header.audio()&&permit.audioAllowed()&&!closed&&!concealed&&playback==null&&pcm!=null);
            sourceStartFrame=permit.preparedStartFrame();int totalFrames=header.length/(header.channels*header.bits/8);require(sourceStartFrame>=0&&sourceStartFrame<totalFrames&&observedSequence<9007199254740991L);observedSequence++;observedSourceFrame=-1;
            acquireAudioFocus(playPermit);int channel=header.channels==1?AudioFormat.CHANNEL_OUT_MONO:AudioFormat.CHANNEL_OUT_STEREO;
            int encoding=header.bits==8?AudioFormat.ENCODING_PCM_8BIT:AudioFormat.ENCODING_PCM_16BIT;
            int minimum=AudioTrack.getMinBufferSize(header.rate,channel,encoding);require(minimum>0&&minimum<=MAX_AUDIO_BYTES);
            AudioTrack actual=new AudioTrack(AudioManager.STREAM_MUSIC,header.rate,channel,encoding,Math.max(minimum,4096),AudioTrack.MODE_STREAM);
            boolean retained=false;try{require(actual.getState()==AudioTrack.STATE_INITIALIZED&&actual.setVolume(volume)==AudioTrack.SUCCESS);playPermit.checkWorker();track=actual;
                playback=new Thread(()->{try{permit.checkOutput();actual.play();int at=sourceStartFrame*(header.channels*header.bits/8);while(at<pcm.length){permit.checkOutput();require(!concealed&&!closed);int count=actual.write(pcm,at,Math.min(4096,pcm.length-at),AudioTrack.WRITE_NON_BLOCKING);require(count>=0&&count%(header.channels*header.bits/8)==0);observePlayback(actual);if(count==0){Thread.sleep(1);continue;}at+=count;}long frames=pcm.length/(header.channels*header.bits/8)-sourceStartFrame;while(Integer.toUnsignedLong(actual.getPlaybackHeadPosition())<frames){permit.checkOutput();require(!concealed&&!closed);observePlayback(actual);Thread.sleep(2);}observePlayback(actual);permit.nativePlaybackFinished(this,observedSequence,observedSourceFrame);actual.stop();}
                    catch(Exception failure){if(!concealed&&!closed)playbackFailure=failure;}finally{try{actual.setVolume(0f);actual.pause();}catch(Throwable ignored){}try{permit.onMain(()->{releaseAudioFocusMain();return null;});}catch(Exception cleanup){playbackFailure=cleanup;}}},"planet-child-owned-pcm");
                playback.start();retained=true;
            }finally{if(!retained)actual.release();}
        }
        /** Called outside Vault/DataStore locks, after the real producer body
         * or by original package retirement before its PROCESS lane release. */
        synchronized void closeJoined()throws Exception {
            if(closed){require(playbackFailure==null);return;}
            permit.onMain(()->{concealMain();releaseAudioFocusMain();if(mute!=null){mute.setOnClickListener(null);mute=null;}if(volumeControl!=null){volumeControl.setOnSeekBarChangeListener(null);volumeControl=null;}if(watch!=null){main.removeCallbacks(watch);watch=null;}if(stop!=null){stop.setOnClickListener(null);stop=null;}if(view!=null){for(int i=0;i<view.getChildCount();i++){View child=view.getChildAt(i);if(child instanceof ImageView)((ImageView)child).setImageDrawable(null);}
                    ViewGroup parent=(ViewGroup)view.getParent();if(parent!=null)parent.removeView(view);view.removeAllViews();view=null;}if(play!=null){play.setOnClickListener(null);play=null;}return null;});
            Thread actual=playback;if(actual!=null){require(actual!=Thread.currentThread()&&Looper.myLooper()!=Looper.getMainLooper());actual.join();playback=null;}
            AudioTrack audio=track;if(audio!=null){audio.setVolume(0f);audio.stop();audio.flush();audio.release();track=null;}
            if(bitmap!=null){bitmap.recycle();bitmap=null;}if(pcm!=null){Arrays.fill(pcm,(byte)0);pcm=null;}
            if(encoded!=null){Arrays.fill(encoded,(byte)0);encoded=null;}closed=true;require(playbackFailure==null);
        }
        boolean knownClosed(){return closed&&view==null&&bitmap==null&&pcm==null&&track==null&&playback==null&&audioManager==null&&focusListener==null&&devices==null&&noisy==null&&!noisyRegistered&&!focusGranted&&playbackFailure==null;}
    }
}
