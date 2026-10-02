/** Offline permission matching only: no credentials, SDK imports or requests. */
import fs from 'node:fs/promises';
import { isLocalCliEntry } from './local-cli-entry.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './release-readiness.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const OPERATIONS=new Set(['auth-read','auth-fixtures','payment-sandbox','deletion-fixtures','migration-read','migration-apply','cleanup-exact-objects']);
export function validateRemoteAuthorization(grant, request, now=Date.now()) {
 const errors=[];
 if (!grant || grant.kind!=='separate-owner-authorization' || grant.grantedBy!=='owner' || grant.recordOnly!==true || !grant.evidenceReference?.trim()) errors.push('SEPARATE_OWNER_AUTHORIZATION_REQUIRED');
 if (!request || !['sandbox','staging'].includes(request.environment) || !UUID.test(request.runId)) errors.push('EXACT_TEST_ENVIRONMENT_AND_RUN_REQUIRED');
 const validEndpoint = value => { try { const u=new URL(value); return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'; } catch{return false;} };
 if (!validEndpoint(request?.endpoint)||grant?.endpoint!==request?.endpoint||grant?.environment!==request?.environment||grant?.projectId!==request?.projectId||!request?.projectId?.trim()) errors.push('ENVIRONMENT_MISMATCH');
 if (!Number.isFinite(Date.parse(grant?.expiresAt))||Date.parse(grant.expiresAt)<=now||!Number.isFinite(Date.parse(grant?.notBefore))||Date.parse(grant.notBefore)>now||grant?.runId!==request?.runId) errors.push('AUTHORIZATION_EXPIRED_OR_WRONG_RUN');
 if (!Array.isArray(request?.operations)||!request.operations.length||request.operations.some(op=>!OPERATIONS.has(op)||!grant?.operations?.includes(op))) errors.push('OPERATION_NOT_AUTHORIZED');
 if (!Array.isArray(request?.testAccountIds)||!Array.isArray(grant?.testAccountIds)||new Set(request.testAccountIds).size!==request.testAccountIds.length||request.testAccountIds.some(id=>!UUID.test(id)||!grant.testAccountIds.includes(id))||(request.operations?.some(op=>['auth-fixtures','deletion-fixtures'].includes(op))&&request.testAccountIds.length<2)||(request.operations?.includes('payment-sandbox')&&request.testAccountIds.length<1)) errors.push('TEST_ACCOUNT_NOT_AUTHORIZED');
 if (!request?.schemaFingerprint||! /^[a-f0-9]{64}$/u.test(request.schemaFingerprint)||grant?.schemaFingerprint!==request.schemaFingerprint) errors.push('SCHEMA_NOT_MATCHED');
 if (request?.operations?.includes('payment-sandbox')&&(grant?.provider!=='yookassa-sandbox'||grant?.testMode!==true||request?.provider!=='yookassa-sandbox'||request?.testMode!==true)) errors.push('PAYMENT_TEST_MODE_REQUIRED');
 if(request?.operations?.includes('payment-sandbox')&&(!/^[1-9][0-9]{0,19}$/u.test(request.shopId??'')||grant?.shopId!==request.shopId||!/^sandbox\.[A-Za-z0-9][A-Za-z0-9._-]{0,111}$/u.test(request.product??'')||grant?.product!==request.product||!request.catalogVersion?.trim()||grant?.catalogVersion!==request.catalogVersion||!Number.isSafeInteger(request.amountMinor)||request.amountMinor<=0||grant?.amountMinor!==request.amountMinor||request.currency!=='RUB'||grant?.currency!==request.currency))errors.push('EXACT_SANDBOX_SHOP_CATALOG_MONEY_REQUIRED');
 if (request?.operations?.includes('migration-apply')&&(!grant?.backupReference?.trim()||!grant?.migrationHashes?.length||JSON.stringify(request.migrationHashes)!==JSON.stringify(grant.migrationHashes))) errors.push('MIGRATION_BACKUP_AND_EXACT_HASHES_REQUIRED');
 return {schemaVersion:1,status:errors.length?'BLOCKED_EXTERNAL':'PASS',offlinePlan:true,networkRequests:0,mutations:0,authorizationSha256:grant?sha256(JSON.stringify(grant)):null,runId:request?.runId??null,errors:[...new Set(errors)],releaseReady:false,productionActionsAuthorized:false};
}
export function validateCleanupObjects(grant, request, ledger) {
 const result=validateRemoteAuthorization(grant,request);
 if (!request?.operations?.includes('cleanup-exact-objects')||!Array.isArray(ledger)||!ledger.length||ledger.some(item=>item.runId!==request.runId||!request?.testAccountIds?.includes(item.ownerId)||!UUID.test(item.id)||!['profile','order','deletion-request','avatar','auth-fixture'].includes(item.kind))||new Set(ledger.map(item=>`${item.kind}:${item.id}`)).size!==ledger.length) result.errors.push('CLEANUP_REQUIRES_EXACT_OWNED_OBJECT_IDS');
 result.status=result.errors.length?'BLOCKED_EXTERNAL':'PASS';return result;
}
if(isLocalCliEntry(import.meta.url)){
 const args=process.argv.slice(2);
 try{
  if(args.length!==4||args[0]!=='--plan'||args[2]!=='--authorization')throw new Error('Use --plan <request.json> --authorization <owner-grant.json>; this command is entirely offline.');
  const request=JSON.parse(await fs.readFile(args[1],'utf8'));let grant=null;try{grant=JSON.parse(await fs.readFile(args[3],'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const report=validateRemoteAuthorization(grant,request);console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='PASS'?0:2;
 }catch(error){console.error(JSON.stringify({status:'BLOCKED_EXTERNAL',offlinePlan:true,networkRequests:0,mutations:0,releaseReady:false,error:error.message}));process.exitCode=2;}
}
