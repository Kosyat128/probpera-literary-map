package ru.probpera.literaryplanet;

import static org.junit.Assert.*;
import android.content.Context;
import android.os.Bundle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.*;
import org.junit.runner.RunWith;

/** AUTHORED_NOT_RUN. Structural debug cases do not manufacture native admission. */
@RunWith(AndroidJUnit4.class)
public final class PlanetChildDiscoveryPassportRuntimeTest {
    private final Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
    private final Bundle args=InstrumentationRegistry.getArguments();
    @Before public void ownRun(){assertEquals("local-v2-child-discovery-passport",args.getString("literaryChildDiscoveryPassportPhase"));assertTrue(args.getString("literaryRunId","").matches("[a-f0-9]{32}"));}
    private interface Work {void run() throws Exception;}
    private static void denied(Work work)throws Exception {boolean refused=false;try{work.run();}catch(Exception unavailable){refused=true;}assertTrue("Unavailable required",refused);}
    private static String id(){return UUID.randomUUID().toString().replace("-","");}
    private static Map<String,Object> map(Object... fields){Map<String,Object> value=new LinkedHashMap<>();for(int i=0;i<fields.length;i+=2)value.put((String)fields[i],fields[i+1]);return value;}
    private static Map<String,Object> base(String token){return map("version",2L,"requestId",id(),"contextToken",token);}
    @SuppressWarnings("unchecked") private static Map<String,Object> row(Object raw){assertTrue(raw instanceof Map);return (Map<String,Object>)raw;}
    private static Object field(Object raw,String name)throws Exception {Field field=raw.getClass().getDeclaredField(name);field.setAccessible(true);return field.get(raw);}
    private static PlanetChildPassport.Credit writer(long version)throws Exception {return new PlanetChildPassport.Credit("journey-one","node-one","writer","writer-one",version,version);}
    private static PlanetChildPassport.Ledger golden()throws Exception {return new PlanetChildPassport.Ledger(Arrays.asList("country-one"),Arrays.asList(writer(2),new PlanetChildPassport.Credit("journey-one","node-two","work","work-one",2,2)),Arrays.asList(new PlanetChildPassport.CompletedJourney("journey-one",2,2,Arrays.asList("node-one","node-two"))));}

    @Test public void closedDiscoveryWireRejectsProfileAndApprovalOverrides()throws Exception {
        for(String shelf:Arrays.asList("writers","books","collections")){Map<String,Object> request=base("2".repeat(32));request.put("shelf",shelf);assertEquals(shelf,PlanetChildDataTransport.decodeV2("listDiscovery",request).shelf);for(String field:Arrays.asList("profileId","locale","exactAge","generation","approved","url")){Map<String,Object> extra=new LinkedHashMap<>(request);extra.put(field,"caller-proof");denied(()->PlanetChildDataTransport.decodeV2("listDiscovery",extra));}}
        Map<String,Object> invalid=base("2".repeat(32));invalid.put("shelf","adult");denied(()->PlanetChildDataTransport.decodeV2("listDiscovery",invalid));
    }
    @Test public void explicitCountryWireRejectsReadAndCapabilityAliases()throws Exception {
        Map<String,Object> request=base("2".repeat(32));request.put("reference",map("kind","country","id","country-one","contentChecksum","a".repeat(64)));assertEquals("country",PlanetChildDataTransport.decodeV2("recordCountryOpen",request).reference.get("kind"));
        for(String kind:Arrays.asList("writer","work","activity","recent","deep-link")){Map<String,Object> invalid=new LinkedHashMap<>(request);invalid.put("reference",map("kind",kind,"id","country-one","contentChecksum","a".repeat(64)));denied(()->PlanetChildDataTransport.decodeV2("recordCountryOpen",invalid));}
        request.put("approved",true);denied(()->PlanetChildDataTransport.decodeV2("recordCountryOpen",request));assertEquals("readPassport",PlanetChildDataTransport.decodeV2("readPassport",base("2".repeat(32))).method);
    }
    @Test public void semanticGoldenSurvivesCodecWithoutCapabilities()throws Exception {
        PlanetChildPassport.Ledger expected=golden();byte[] bytes=expected.encode();try{assertEquals(expected,PlanetChildPassport.decode(bytes));assertEquals(Arrays.asList("country-one"),expected.countries);assertEquals("writer-one",expected.credits.get(0).entityId);assertEquals("work-one",expected.credits.get(1).entityId);assertEquals(Arrays.asList("node-one","node-two"),expected.completedJourneys.get(0).nodeIds);byte[] trailing=Arrays.copyOf(bytes,bytes.length+1);denied(()->PlanetChildPassport.decode(trailing));}finally{Arrays.fill(bytes,(byte)0);}
    }
    @Test public void newVersionCompletionPreservesHistoricalTypedReceipt()throws Exception {
        PlanetChildPassport.Ledger old=golden(),migrated=old.learned(writer(3));assertEquals(3,migrated.credits.size());assertEquals(2,migrated.credits.get(0).journeyVersion);assertEquals(3,migrated.credits.get(2).journeyVersion);assertEquals(migrated,migrated.learned(writer(3)));
        denied(()->migrated.learned(new PlanetChildPassport.Credit("journey-one","node-one","work","retargeted-work",3,3)));assertEquals(3,migrated.credits.size());
    }
    @Test public void boundedCountriesDedupBeforeCapacityRefusal()throws Exception {
        // The documented count bounds must also fit their maximum-length IDs together.
        List<String> countries=new ArrayList<>(),nodes=new ArrayList<>();List<PlanetChildPassport.Credit> credits=new ArrayList<>();List<PlanetChildPassport.CompletedJourney> journeys=new ArrayList<>();
        for(int i=0;i<64;i++)nodes.add(String.format(java.util.Locale.ROOT,"n%095d",i));
        for(int i=0;i<2048;i++){String journey=String.format(java.util.Locale.ROOT,"j%095d",i/64);countries.add(String.format(java.util.Locale.ROOT,"c%095d",i));credits.add(new PlanetChildPassport.Credit(journey,nodes.get(i%64),"writer",String.format(java.util.Locale.ROOT,"w%095d",i),1,1));}
        for(int i=0;i<32;i++)journeys.add(new PlanetChildPassport.CompletedJourney(String.format(java.util.Locale.ROOT,"j%095d",i),1,1,nodes));
        PlanetChildPassport.Ledger combined=new PlanetChildPassport.Ledger(countries,credits,journeys);byte[] maximum=combined.encode();try{assertTrue(maximum.length>524288);assertEquals(combined,PlanetChildPassport.decode(maximum));}finally{Arrays.fill(maximum,(byte)0);}
        List<String> ids=new ArrayList<>();for(int i=0;i<2048;i++)ids.add("country-"+i);PlanetChildPassport.Ledger full=new PlanetChildPassport.Ledger(ids,Collections.emptyList());assertEquals(full,full.opened("country-0"));denied(()->full.opened("country-overflow"));denied(()->new PlanetChildPassport.Ledger(Arrays.asList("country-one","country-one"),Collections.emptyList()));
    }
    @Test public void explicitFinalReceiptSurvivesRestartWithoutCursorAwards()throws Exception {
        PlanetChildPassport.Ledger ledger=golden();PlanetChildJourney.Progress saved=new PlanetChildJourney.Progress("journey-one",2,2,null,Arrays.asList("node-one","node-two","z-retired-node"),null,null,null,"journey");
        PlanetChildJourney.Progress restarted=PlanetChildJourney.advance(saved,Arrays.asList("node-one","node-two"),null,"restart",null);assertEquals(saved.completedNodeIds,restarted.completedNodeIds);assertEquals(1,ledger.completedJourneys.size());PlanetChildJourney.Progress migrated=PlanetChildJourney.reanchor(saved,"journey-one",3,Arrays.asList("node-one","node-two","new-node"));assertEquals(saved.completedNodeIds,migrated.completedNodeIds);assertEquals(2,ledger.completedJourneys.get(0).journeyVersion);
        PlanetChildPassport.Ledger finished=ledger.finished(new PlanetChildPassport.CompletedJourney("journey-one",3,3,Arrays.asList("node-one","node-two","new-node")));assertEquals(2,finished.completedJourneys.size());assertEquals(2,finished.completedJourneys.get(0).journeyVersion);assertEquals(3,finished.completedJourneys.get(1).journeyVersion);assertEquals(ledger.credits,finished.credits);assertEquals(finished,finished.finished(finished.completedJourneys.get(1)));denied(()->finished.finished(new PlanetChildPassport.CompletedJourney("journey-one",3,3,Arrays.asList("node-one"))));
        List<PlanetChildPassport.CompletedJourney> receipts=new ArrayList<>();for(int i=1;i<=32;i++)receipts.add(new PlanetChildPassport.CompletedJourney("journey-one",i,i,Arrays.asList("node-one")));PlanetChildPassport.Ledger full=new PlanetChildPassport.Ledger(Collections.emptyList(),Collections.emptyList(),receipts);assertEquals(full,full.finished(receipts.get(0)));denied(()->full.finished(new PlanetChildPassport.CompletedJourney("journey-one",33,33,Arrays.asList("node-one"))));assertEquals(32,full.completedJourneys.size());byte[] encoded=finished.encode();try{assertEquals(finished,PlanetChildPassport.decode(encoded));}finally{Arrays.fill(encoded,(byte)0);}
    }
    @Test public void readsReanchorAndPrefixLookingIdsDoNotManufactureCredits()throws Exception {
        PlanetChildPassport.Ledger empty=PlanetChildPassport.empty();PlanetChildJourney.Progress legacy=new PlanetChildJourney.Progress("journey-one",1,1,null,Arrays.asList("writer-looking-prefix","work-looking-prefix"),null,null,null,"journey");PlanetChildJourney.reanchor(legacy,"journey-one",2,Arrays.asList("writer-looking-prefix","work-looking-prefix"));assertTrue(empty.countries.isEmpty());assertTrue(empty.credits.isEmpty());assertTrue(empty.completedJourneys.isEmpty());
    }
    @Test public void independentWriterDoesNotAdmitWrongAgeWork()throws Exception {assertTrue(PlanetChildVault.fixtureDiscoveryPolicy(context,"independent-work-age"));}
    @Test public void independentlyBlockedWorkTopicDenies()throws Exception {assertTrue(PlanetChildVault.fixtureDiscoveryPolicy(context,"blocked-topic"));}
    @Test public void independentlyExpiredWorkRightsDeny()throws Exception {assertTrue(PlanetChildVault.fixtureDiscoveryPolicy(context,"rights"));}
    @Test public void independentlyWrongWorkLocaleDenies()throws Exception {assertTrue(PlanetChildVault.fixtureDiscoveryPolicy(context,"locale"));}
    @Test public void independentlyStaleWorkPolicyVersionDenies()throws Exception {assertTrue(PlanetChildVault.fixtureDiscoveryPolicy(context,"policy-version"));}
    @Test public void legacyRetiredCompletedIdsStayUnresolved()throws Exception {assertTrue(PlanetChildDataStore.fixturePassportScenario(context,"legacy"));}
    @Test public void oneSnapshotRetainsJourneyAndTypedLearningTogether()throws Exception {assertTrue(PlanetChildDataStore.fixturePassportScenario(context,"atomic"));}
    @Test public void historyRemovalKeepsProfileAppearanceFavoritesOfflineAndSibling()throws Exception {assertTrue(PlanetChildDataStore.fixturePassportScenario(context,"history"));}
    @Test public void profileRemovalKeepsOnlyExactSiblingPartition()throws Exception {assertTrue(PlanetChildDataStore.fixturePassportScenario(context,"profile"));}
    @Test public void lastProfileRetainsValidEmptySealedNamespace()throws Exception {assertTrue(PlanetChildDataStore.fixturePassportScenario(context,"last-profile"));}
    @Test public void corruptPassportExtensionDeniesWholeSnapshot()throws Exception {assertTrue(PlanetChildDataStore.fixturePassportScenario(context,"corrupt"));}
    @Test public void encryptedRestartAndUnknownMarkerNeverReplay()throws Exception {
        String run=args.getString("literaryRunId");for(String phase:Arrays.asList("write","read","pending","pending-reopen"))assertTrue(PlanetChildDataStore.fixturePassportPersistence(context,run,phase));
    }
    @Test public void noCallerTokenCanEnterPassportOrDiscovery()throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){PlanetChildVault.LocalV2AppOwner nativeOwner=owner(scenario);for(String method:Arrays.asList("listDiscovery","readPassport","recordCountryOpen")){Map<String,Object> request=base("2".repeat(32));if(method.equals("listDiscovery"))request.put("shelf","writers");if(method.equals("recordCountryOpen"))request.put("reference",map("kind","country","id","country-one","contentChecksum","a".repeat(64)));assertNotEquals("ok",invoke(nativeOwner,method,request,20).get("status"));}}
    }

    private static final class Pending {
        final CountDownLatch joined=new CountDownLatch(1);final AtomicReference<Map<String,Object>> response=new AtomicReference<>();
        Pending(PlanetChildVault.LocalV2AppOwner owner,String method,Map<String,Object> request)throws Exception {owner.execute(PlanetChildDataTransport.decodeV2(method,request),reply->{assertTrue(response.compareAndSet(null,reply));joined.countDown();});}
        Map<String,Object> joined(int seconds)throws Exception {assertTrue("Original native work must actually join",joined.await(seconds,TimeUnit.SECONDS));return response.get();}
    }
    private static Map<String,Object> invoke(PlanetChildVault.LocalV2AppOwner owner,String method,Map<String,Object> request,int seconds)throws Exception {return new Pending(owner,method,request).joined(seconds);}
    private static PlanetChildVault.LocalV2AppOwner owner(ActivityScenario<MainActivity> scenario)throws Exception {AtomicReference<PlanetChildVault.LocalV2AppOwner> result=new AtomicReference<>();scenario.onActivity(activity->{try{result.set((PlanetChildVault.LocalV2AppOwner)field(activity.getBridge().getPlugin("PlanetChild").getInstance(),"owner"));}catch(Exception failure){throw new AssertionError(failure);}});assertNotNull(result.get());return result.get();}
    private static Map<String,Object> data(Map<String,Object> reply){assertEquals("ok",reply.get("status"));return row(reply.get("value"));}
    private static Map<String,Object> genuineContext(PlanetChildVault.LocalV2AppOwner owner)throws Exception {Object old=field(owner,"context");Map<String,Object> boot=old==null?invoke(owner,"bootstrap",map("version",2L,"requestId",id()),20):invoke(owner,"readContext",base((String)field(old,"token")),20);assertEquals("child",boot.get("status"));return row(boot.get("context"));}

    @Test public void genuineNativeShelvesAreStableAndHomeReadDoesNotAwardCountry()throws Exception {
        Assume.assumeTrue("NOT_RUN: genuine installed approved packages and child context required",args.getString("literaryChildDiscoveryPassportFixtureAvailable","").equals("true"));
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){PlanetChildVault.LocalV2AppOwner nativeOwner=owner(scenario);Map<String,Object> context=genuineContext(nativeOwner);String token=(String)context.get("token");Map<String,Object> before=data(invoke(nativeOwner,"readPassport",base(token),20));
            for(String shelf:Arrays.asList("writers","books","collections")){Map<String,Object> request=base(token);request.put("shelf",shelf);Map<String,Object> first=data(invoke(nativeOwner,"listDiscovery",request,20));Map<String,Object> next=base(token);next.put("shelf",shelf);Map<String,Object> second=data(invoke(nativeOwner,"listDiscovery",next,20));assertEquals(first.get("items"),second.get("items"));assertEquals(context.get("profileId"),first.get("profileId"));assertEquals(context.get("locale"),first.get("locale"));assertEquals(context.get("generation"),first.get("generation"));assertTrue(((List<?>)first.get("items")).size()<=64);
                for(Object raw:(List<?>)first.get("items")){Map<String,Object> entity=row(raw),ref=row(entity.get("reference"));assertEquals(shelf.equals("writers")?"writer":shelf.equals("books")?"work":"recommendation",ref.get("kind"));Map<String,Object> read=base(token);read.put("reference",ref);assertEquals(entity,data(invoke(nativeOwner,"readEntity",read,20)));if(shelf.equals("collections")){List<?> refs=(List<?>)row(entity.get("payload")).get("references");assertEquals(1,refs.size());Map<String,Object> target=base(token);target.put("reference",refs.get(0));data(invoke(nativeOwner,"readEntity",target,20));}}
            }Map<String,Object> home=base(token);home.put("reference",context.get("home"));data(invoke(nativeOwner,"readEntity",home,20));Map<String,Object> after=data(invoke(nativeOwner,"readPassport",base(token),20));assertEquals(before,after);assertEquals(map("status","unavailable","items",Collections.emptyList()),after.get("badges"));assertEquals(map("status","unavailable","items",Collections.emptyList()),after.get("downloadedRoutes"));
        }
    }
    @Test public void genuineParentCancellationPreservesTargetAndSibling()throws Exception {
        Assume.assumeTrue("NOT_RUN: original native Parent Gate operator cancellation fixture required",args.getString("literaryChildDeletionCancelFixtureAvailable","").equals("true"));
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){PlanetChildVault.LocalV2AppOwner nativeOwner=owner(scenario);Map<String,Object> context=genuineContext(nativeOwner);String token=(String)context.get("token");Map<String,Object> before=data(invoke(nativeOwner,"readPassport",base(token),20));Map<String,Object> request=base(token);request.put("action","delete-child-data");request.put("target",map("profileId",context.get("profileId"),"scope","history"));
            // Real native disclosure and original PIN dialog must be cancelled
            // by the operator. This fixture never presses a Gate or supplies PIN.
            Map<String,Object> cancelled=invoke(nativeOwner,"perform",request,60);assertEquals("cancelled",cancelled.get("reason"));assertEquals("child",cancelled.get("status"));Map<String,Object> current=row(cancelled.get("context"));assertEquals(context.get("profileId"),current.get("profileId"));Map<String,Object> after=data(invoke(nativeOwner,"readPassport",base((String)current.get("token")),20));for(String field:Arrays.asList("revision","countries","writers","works","journeys","unresolvedCompletedNodeIds"))assertEquals(before.get(field),after.get(field));
        }
    }

    @Test public void genuineBridgeRetirementCancelsOriginalDeletionBeforeNativeConfirmation()throws Exception {
        Assume.assumeTrue("NOT_RUN: genuine installed native child context required; no Gate confirmation or PIN is supplied",args.getString("literaryChildDeletionRevocationFixtureAvailable","").equals("true"));
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            PlanetChildVault.LocalV2AppOwner nativeOwner=owner(scenario);Map<String,Object> context=genuineContext(nativeOwner);String token=(String)context.get("token");Map<String,Object> before=data(invoke(nativeOwner,"readPassport",base(token),20));
            Map<String,Object> request=base(token);request.put("action","delete-child-data");request.put("target",map("profileId",context.get("profileId"),"scope","history"));Pending original=new Pending(nativeOwner,"perform",request);
            long deadline=android.os.SystemClock.elapsedRealtime()+15000;while(field(nativeOwner,"gate")==null&&original.joined.getCount()!=0&&android.os.SystemClock.elapsedRealtime()<deadline)Thread.sleep(10);
            assertNotNull("Actual original native Gate must be presented before cancellation",field(nativeOwner,"gate"));
            Map<String,Object> retired=invoke(nativeOwner,"retire",base(null),20);assertEquals("retired",retired.get("status"));Map<String,Object> cancelled=original.joined(20);assertNotEquals("adult",cancelled.get("status"));
            Map<String,Object> current=genuineContext(nativeOwner);assertEquals(context.get("profileId"),current.get("profileId"));Map<String,Object> after=data(invoke(nativeOwner,"readPassport",base((String)current.get("token")),20));
            for(String name:Arrays.asList("revision","countries","writers","works","journeys","unresolvedCompletedNodeIds"))assertEquals(before.get(name),after.get(name));
        }
    }

    @Test public void canonicalHistoryTargetKeepsExactPinAndAllProfiles()throws Exception {assertTrue(PlanetChildVault.fixtureCanonicalDeletion(context,"history"));}
    @Test public void canonicalInactiveProfileRemovalKeepsSelectedSiblingAndPin()throws Exception {assertTrue(PlanetChildVault.fixtureCanonicalDeletion(context,"inactive-profile"));}
    @Test public void canonicalActiveProfileRemovalSelectsSiblingSafely()throws Exception {assertTrue(PlanetChildVault.fixtureCanonicalDeletion(context,"active-profile"));}
    @Test public void canonicalLastProfileRemovalSetsAdultAndNullSelection()throws Exception {assertTrue(PlanetChildVault.fixtureCanonicalDeletion(context,"last-profile"));}
    @Test public void canonicalUnknownRemovalTargetRefusesBeforePublication()throws Exception {assertTrue(PlanetChildVault.fixtureCanonicalDeletion(context,"invalid-target"));}
    @Test public void genuineExplicitCountryCommandCommitsOnlyItsOwnSemanticFact()throws Exception {
        Assume.assumeTrue("NOT_RUN: genuine current reviewed country and installed native context required",args.getString("literaryChildCountryOpenFixtureAvailable","").equals("true"));
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){PlanetChildVault.LocalV2AppOwner nativeOwner=owner(scenario);Map<String,Object> context=genuineContext(nativeOwner);String token=(String)context.get("token");Map<String,Object> before=data(invoke(nativeOwner,"readPassport",base(token),20));String countryId=args.getString("literaryChildCountryId","");PlanetChildJourney.identifier(countryId);
            Map<String,Object> home=base(token);home.put("reference",context.get("home"));Map<String,Object> entity=data(invoke(nativeOwner,"readEntity",home,20));Map<String,Object> country=null;for(Object raw:(List<?>)row(entity.get("payload")).get("references")){Map<String,Object> ref=row(raw);if("country".equals(ref.get("kind"))&&countryId.equals(ref.get("id")))country=ref;}assertNotNull("Fixture must name a genuinely admitted Home country",country);
            Map<String,Object> read=base(token);read.put("reference",country);data(invoke(nativeOwner,"readEntity",read,20));Map<String,Object> unchanged=data(invoke(nativeOwner,"readPassport",base(token),20));assertEquals(before,unchanged);Map<String,Object> open=base(token);open.put("reference",country);Map<String,Object> receipt=data(invoke(nativeOwner,"recordCountryOpen",open,20));assertEquals(context.get("profileId"),receipt.get("profileId"));assertEquals(context.get("locale"),receipt.get("locale"));assertEquals(context.get("generation"),receipt.get("generation"));assertEquals(country,row(receipt.get("country")).get("reference"));assertEquals(((Number)before.get("revision")).longValue()+1,((Number)receipt.get("revision")).longValue());
            Map<String,Object> after=data(invoke(nativeOwner,"readPassport",base(token),20));assertEquals(receipt.get("revision"),after.get("revision"));boolean found=false;for(Object raw:(List<?>)after.get("countries"))found|=countryId.equals(row(row(raw).get("reference")).get("id"));assertTrue(found);for(String field:Arrays.asList("writers","works","journeys","unresolvedCompletedNodeIds"))assertEquals(before.get(field),after.get(field));
        }
    }
    @Test public void genuineProfileRemovalReturnsOnlyDurableAdultConfirmation()throws Exception {
        Assume.assumeTrue("NOT_RUN: operation-specific owned disposable profile and real Parent PIN operator required",args.getString("literaryChildDeleteProfileFixtureAvailable","").equals("true"));
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){PlanetChildVault.LocalV2AppOwner nativeOwner=owner(scenario);Object priorContext=field(nativeOwner,"context");Map<String,Object> before=priorContext==null?invoke(nativeOwner,"bootstrap",map("version",2L,"requestId",id()),20):invoke(nativeOwner,"readContext",base((String)field(priorContext,"token")),20);assertTrue(Arrays.asList("child","blocked-child","adult").contains(before.get("status")));Map<String,Object> context=row(before.get("context"));String token=(String)context.get("token"),target=args.getString("literaryChildDeleteProfileId","");assertEquals("The fixture must explicitly authorize its disposable target",context.get("profileId"),target);List<?> beforeProfiles=(List<?>)invoke(nativeOwner,"readContext",base(token),20).get("profiles");Map<String,Object> request=base(token);request.put("action","delete-child-data");request.put("target",map("profileId",target,"scope","profile"));
            // Original native control and real PIN must be used by the operator.
            // The fixture contains no PIN, proof, automatic click or capability.
            Map<String,Object> removed=invoke(nativeOwner,"perform",request,60);assertEquals("adult",removed.get("status"));assertNull(removed.get("reason"));List<?> profiles=(List<?>)removed.get("profiles");assertEquals(beforeProfiles.size()-1,profiles.size());for(Object raw:profiles)assertNotEquals(target,row(raw).get("id"));for(Object raw:beforeProfiles)if(!target.equals(row(raw).get("id")))assertTrue(profiles.contains(raw));
            Map<String,Object> nativeContext=row(removed.get("context"));String adultToken=(String)nativeContext.get("token");assertNotEquals(token,adultToken);assertTrue(PlanetChildDataStore.fixtureGenuineRemovalReadback(this.context,target));assertNotEquals("ok",invoke(nativeOwner,"readPassport",base(adultToken),20).get("status"));
        }
    }

}
