// Original scenario declarations retained from the genuine44ace M04 BEFORE.
// Current observer adaptations are explicit: native admission replaces generic
// enqueue, and trusted ActionResult replaces retry redirect/query-only proof.
const scenarios=[
 {name:'invalid nonnumeric address',kind:'invalid',id:'bad',invalidBeforeRead:true},
 {name:'invalid zero address',kind:'invalid',id:'0',invalidBeforeRead:true},
 {name:'missing event address',kind:'invalid',id:'999'},
 {name:'bigint overflow address',kind:'invalid',id:'9223372036854775808'},
 {name:'no staff session',kind:'invalid',id:'42',noSession:true,invalidBeforeRead:true},
 {name:'read permission refusal',kind:'invalid',id:'42',readDenied:true},
 {name:'direct deployed retry',kind:'terminal',initialStatus:'deployed'},
 {name:'known dispatched operation is still active',kind:'active',initialStatus:'dispatched'},
 {name:'failed source completes after the addressed read',kind:'race',initialStatus:'failed'},
 {name:'accepted external launch has an unconfirmed mark then retry',kind:'mark-unknown',initialStatus:'failed'},
 {name:'known failed retry positive control',kind:'failed-control',initialStatus:'failed'},
 {name:'two deliberate fresh full releases remain separate',kind:'full-control',initialStatus:'deployed'},
 {name:'two different same-entity failed events remain separate',kind:'distinct-control',initialStatus:'failed'},
];
module.exports={scenarios,originalOracleSha256:'a688b198a79a56202c871ab9aa87956ac0aca6b698a97b9564fafe703b1751d9',
 protocolAdaptations:[
  'Retry uses durable native admission; generic enqueue count becomes zero and one immutable native child proves the positive control.',
  'Retry returns trusted ActionResult; known accepted start is state=started even if mark is unconfirmed. Full release retains native Next redirect.',
  'Original read-before-enqueue race becomes actual SSR read followed by controlled completion before native admission. Native atomic race proof is separate.',
  'Original permission/read refusal becomes native admission refusal after a real earlier Page read; no action-side fresh source read is invented.',
  'The second unknown-mark command first replays the same real rendered intent, then addresses the actual unresolved child as the original direct-child trigger.',
 ]};
