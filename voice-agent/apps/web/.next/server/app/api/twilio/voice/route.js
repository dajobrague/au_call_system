"use strict";(()=>{var e={};e.id=54,e.ids=[54],e.modules={517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3276:(e,t,o)=>{o.r(t),o.d(t,{headerHooks:()=>u,originalPathname:()=>y,requestAsyncStorage:()=>l,routeModule:()=>s,serverHooks:()=>c,staticGenerationAsyncStorage:()=>p,staticGenerationBailout:()=>d});var i={};o.r(i),o.d(i,{POST:()=>POST});var a=o(5789),n=o(4902),r=o(914);async function POST(e){try{let t=await e.formData(),o=t.get("CallSid"),i=t.get("From"),a=t.get("To"),n=t.get("SpeechResult"),s=t.get("Digits"),l=t.get("GatherAttempt");if(console.log("Twilio webhook received:",{callSid:o,from:i,to:a,speechResult:n,digits:s,gatherAttempt:l}),n||s){let e=`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you. We received your response.</Say>
  <Hangup/>
</Response>`;return new r.Z(e,{headers:{"Content-Type":"text/xml"}})}let p=parseInt(l||"0");if(p>=1){let e=`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We didn't receive your input. Thank you for calling. Goodbye.</Say>
  <Hangup/>
</Response>`;return new r.Z(e,{headers:{"Content-Type":"text/xml"}})}let c=`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather 
    input="speech dtmf" 
    language="en-US" 
    timeout="10" 
    speechTimeout="3" 
    finishOnKey="#"
    action="/api/twilio/voice"
    method="POST">
    <Say voice="alice">${p>0?"Please say your client number or enter it using the keypad, followed by the pound key.":"Welcome. After the tone, please say your client number or enter it using the keypad, then press pound."}</Say>
  </Gather>
  <Say voice="alice">We didn't receive your input. Please try again.</Say>
  <Redirect>/api/twilio/voice</Redirect>
</Response>`;return new r.Z(c,{headers:{"Content-Type":"text/xml"}})}catch(t){console.error("Error in voice webhook:",t);let e=`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, there was an error. Please try calling again later.</Say>
  <Hangup/>
</Response>`;return new r.Z(e,{status:500,headers:{"Content-Type":"text/xml"}})}}let s=new a.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/twilio/voice/route",pathname:"/api/twilio/voice",filename:"route",bundlePath:"app/api/twilio/voice/route"},resolvedPagePath:"/Users/davidbracho/auestralian_project/voice-agent/apps/web/app/api/twilio/voice/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:l,staticGenerationAsyncStorage:p,serverHooks:c,headerHooks:u,staticGenerationBailout:d}=s,y="/api/twilio/voice/route"}};var t=require("../../../../webpack-runtime.js");t.C(e);var __webpack_exec__=e=>t(t.s=e),o=t.X(0,[764],()=>__webpack_exec__(3276));module.exports=o})();