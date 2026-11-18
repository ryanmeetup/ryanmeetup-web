// A synthetic private backend. It never connects to Supabase or Shopify.
import { createServer } from "node:http";
const port=Number(process.env.MY_REVIEWS_FIXTURE_PORT??54359);
const id=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const stamp=(n)=>new Date(Date.UTC(2026,10,18,12,0,n)).toISOString().replace(".000Z",".123456Z");
let records,sessions,calls,options,tick;
function row(n,status="pending",subject="buyer-a") {
  const content={rating:4,title:null,body:`Review ${n}.`,nameStyle:"first-initial",displayName:"Ryan F."};
  return {subject,published:status==="published"?{...content,body:"Approved original text."}:null,
    value:{id:id(n),lineId:String(n),item:{productId:"100",productTitle:`Fixture shirt ${n}`,variantTitle:"Black / M"},status,
      hasPendingEdit:status==="published",publishedAt:status==="published"?stamp(1000-n).slice(0,23)+"Z":null,
      createdAt:stamp(1000-n),updatedAt:stamp(1000-n),current:content}};
}
function reset(config={}) {
  options=config;sessions=new Map();calls=[];tick=0;
  records=config.many?Array.from({length:125},(_,i)=>row(i+1)):[row(1),row(2,"published"),row(3,"rejected"),row(4,"hidden"),row(5,"withdrawn"),row(201,"published","buyer-b")];
  if(config.many)records.push(row(201,"published","buyer-b"));
  if(config.empty)records=[];
  if(config.longText){records[1].value.item.productTitle="Ryan".repeat(50);records[1].value.current.body="Review".repeat(150);}
}
reset();
const json=(res,status,data)=>{res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(data));};
async function body(req){let text="";for await(const chunk of req)text+=chunk;return text?JSON.parse(text):{};}
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,"http://fixture.test");
    if(url.pathname==="/health")return json(res,200,{ok:true});
    if(url.pathname==="/__reset"){reset(await body(req));return json(res,200,{ok:true});}
    if(url.pathname==="/__configure"){options={...options,...await body(req)};return json(res,200,{ok:true});}
    if(url.pathname==="/__state")return json(res,200,{calls,records});
    if(url.pathname==="/__revoke"){sessions.clear();return json(res,200,{ok:true});}
    if(url.pathname==="/__discovery")return json(res,200,{graphql_api:"https://shopify.com/123456/account/customer/api/2026-10/graphql"});
    if(url.pathname==="/__customer")return json(res,200,{data:{customer:{id:"gid://shopify/Customer/123",firstName:"Ryan",lastName:"Fixture"}}});
    if(req.headers.authorization!==`Bearer ${"t".repeat(43)}`)return json(res,401,{error:"Synthetic service credential required"});
    const command=await body(req);
    if(url.pathname==="/api/store/customer-auth"){
      if(command.operation==="session.create"){sessions.set(command.record.sessionHash,{...command.record,revision:0});return json(res,200,{data:true});}
      if(command.operation==="session.get")return json(res,200,{data:sessions.get(command.sessionHash)??null});
      if(command.operation==="session.revoke"){const existed=sessions.delete(command.sessionHash);return json(res,200,{data:existed});}
      return json(res,400,{error:"Unexpected synthetic auth command"});
    }
    if(url.pathname!=="/api/store/reviews")return json(res,404,{error:"No fixture route"});
    if(options.failRead && ["review.mine","reviews.mine"].includes(command.operation))return json(res,503,{error:"Synthetic read failure"});
    const owned=records.filter((r)=>r.subject===command.subject);
    if(command.operation==="reviews.mine"){
      let rows=owned.map((r)=>r.value).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
      if(command.cursor){const [time,key]=Buffer.from(command.cursor,"base64url").toString().split("|");rows=rows.filter((r)=>r.createdAt<time||(r.createdAt===time&&r.id<key));}
      const page=rows.slice(0,20);const last=page.at(-1);
      return json(res,200,{data:{reviews:page,nextCursor:rows.length>20?Buffer.from(`${last.createdAt}|${last.id}`).toString("base64url"):null}});
    }
    if(command.operation==="review.mine")return json(res,200,{data:owned.find((r)=>r.value.id===command.reviewId)?.value??null});
    if(command.operation==="reviews.reviewedLines")return json(res,200,{data:owned.filter((r)=>r.value.status!=="withdrawn"&&command.lineIds.includes(r.value.lineId)).map((r)=>r.value.lineId)});
    if(command.operation==="reviews.page")return json(res,200,{data:{scope:{productIds:command.productIds},summary:{count:0,average:0,distribution:{1:0,2:0,3:0,4:0,5:0}},reviews:[],nextCursor:null}});
    calls.push(command);
    const record=owned.find((r)=>r.value.id===command.reviewId);
    if(!record)return json(res,200,{data:"not_found"});
    if(options.conflictOnce){options.conflictOnce=false;record.value.updatedAt=stamp(2000+ ++tick);record.value.current.body="A newer buyer edit.";return json(res,200,{data:"conflict"});}
    if(record.value.updatedAt!==command.expectedUpdatedAt)return json(res,200,{data:"conflict"});
    if(command.operation==="review.edit"){
      if(["hidden","withdrawn"].includes(record.value.status))return json(res,200,{data:"closed"});
      record.value.current={...command.submission,displayName:command.displayName};
      record.value.hasPendingEdit=Boolean(record.published);record.value.status=record.published?"published":"pending";
    }else if(command.operation==="review.withdraw"){
      record.value.status="withdrawn";record.value.hasPendingEdit=false;record.published=null;
    }else return json(res,400,{error:"Unexpected synthetic review command"});
    record.value.updatedAt=stamp(2000+ ++tick);
    if(options.failReadAfterSave)options.failRead=true;
    return json(res,200,{data:command.operation==="review.edit"?"pending":"withdrawn"});
  }catch{return json(res,500,{error:"Synthetic fixture failed"});}
}).listen(port,"127.0.0.1");
