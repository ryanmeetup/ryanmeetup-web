// Synthetic Supabase REST for store browser tests. It answers only the store's
// fixed review and sign-in calls, in the database's row shape, and never
// connects to Supabase or Shopify.
import { createServer } from "node:http";
const port=Number(process.env.FAKE_SUPABASE_PORT??54359);
const key="synthetic-supabase-secret";
const id=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const stamp=(n)=>new Date(Date.UTC(2026,10,18,12,0,n)).toISOString().replace(".000Z",".123456Z");
let records,sessions,calls,options,tick;
function row(n,status="pending",subject="buyer-a") {
  const content={rating:4,title:"Ryan approved",body:`Review ${n}.`,nameStyle:"first-initial",displayName:"Ryan F."};
  return {subject,published:status==="published"?{...content,body:"Approved original text."}:null,
    value:{id:id(n),lineId:String(n),item:{productId:"100",productTitle:`Fixture shirt ${n}`,variantTitle:"Black / M"},status,
      hasPendingEdit:status==="published",rejectionReason:status==="rejected"?"Please keep it about the shirt.":null,publishedAt:status==="published"?stamp(1000-n).slice(0,23)+"Z":null,
      createdAt:stamp(1000-n),updatedAt:stamp(1000-n),current:content}};
}
/** `records` replaces the default rows; `keepSessions` leaves sign-ins alone, for the local preview's scenario switcher. */
function reset(config={}) {
  const {records:given,keepSessions,...rest}=config;
  options=rest;if(!keepSessions||!sessions)sessions=new Map();calls=[];tick=0;
  records=config.many?Array.from({length:125},(_,i)=>row(i+1)):[row(1),row(2,"published"),row(3,"rejected"),row(4,"hidden"),row(5,"withdrawn"),row(201,"published","buyer-b")];
  if(config.many)records.push(row(201,"published","buyer-b"));
  if(config.empty)records=[];
  if(given)records=structuredClone(given);
  if(config.longText){records[1].value.item.productTitle="Ryan".repeat(50);records[1].value.current.body="Review".repeat(150);}
}
reset();
const json=(res,status,data)=>{res.writeHead(status,{"content-type":"application/json"});res.end(data===undefined?"":JSON.stringify(data));};
async function body(req){let text="";for await(const chunk of req)text+=chunk;return text?JSON.parse(text):{};}
const submission=(a)=>({rating:a.p_rating,title:a.p_title,body:a.p_body,nameStyle:a.p_name_style});

/** Buyer review RPCs, mirroring the database functions' outcomes. */
function review(name,a){
  // Browser transport fixtures only; atomic ownership/rollback is proven by the SQL suite.
  if(name==="store_submit_review_with_photos")name="store_submit_review";
  if(name==="store_edit_buyer_review_with_photos")name="store_edit_buyer_review";
  const owned=records.filter((r)=>r.subject===a.p_subject);
  if(name==="store_buyer_review_photo_selection"){
    const record=owned.find((r)=>r.value.id===a.p_review_id);
    return record?{reviewId:record.value.id,productId:record.value.item.productId,
      updatedAt:options.photoVersion??record.value.updatedAt,photos:options.photos?.[record.value.id]??[]}:null;
  }
  if(name==="store_review_summary")return {count:0,average:0,distribution:{1:0,2:0,3:0,4:0,5:0}};
  if(name==="store_public_reviews")return [];
  if(name==="store_buyer_reviewed_products")return [...new Set(owned.filter((r)=>r.value.lineId===null&&r.value.status!=="withdrawn"&&a.p_product_ids.includes(r.value.item.productId)).map((r)=>r.value.item.productId))];
  if(name==="store_buyer_reviewed_lines"&&options.failReviewedLines)return null;
  if(name==="store_buyer_reviewed_lines")return owned.filter((r)=>r.value.status!=="withdrawn"&&a.p_line_ids.includes(r.value.lineId)).map((r)=>r.value.lineId);
  if(name==="store_buyer_reviews"){
    let rows=owned.map((r)=>r.value).sort((x,y)=>y.createdAt.localeCompare(x.createdAt)||y.id.localeCompare(x.id));
    if(a.p_review_id)rows=rows.filter((r)=>r.id===a.p_review_id);
    if(a.p_after_created_at)rows=rows.filter((r)=>r.createdAt<a.p_after_created_at||(r.createdAt===a.p_after_created_at&&r.id<a.p_after_id));
    return rows.slice(0,a.p_limit);
  }
  if(name==="store_submit_review"){
    const purchase={orderId:a.p_order_id,lineId:a.p_line_id,productId:a.p_product_id,variantId:a.p_variant_id,productTitle:a.p_product_title,variantTitle:a.p_variant_title};
    calls.push({operation:"review.submit",subject:a.p_subject,purchase,submission:submission(a),displayName:a.p_display_name,...(a.p_photo_ids?{photoIds:a.p_photo_ids}:{})});
    const same=(r)=>a.p_line_id===null?r.value.lineId===null&&r.value.item.productId===a.p_product_id:r.value.lineId===a.p_line_id;
    if(owned.some(same))return [{review_id:null,outcome:"exists"}];
    const created=row(500+ ++tick,"pending",a.p_subject);
    Object.assign(created.value,{lineId:a.p_line_id,item:{productId:a.p_product_id,productTitle:a.p_product_title,variantTitle:a.p_variant_title},
      current:{...submission(a),displayName:a.p_display_name}});
    records.push(created);
    return [{review_id:created.value.id,outcome:"created"}];
  }
  const operation=name==="store_edit_buyer_review"?"review.edit":name==="store_withdraw_buyer_review"?"review.withdraw":null;
  if(!operation)return undefined;
  calls.push({operation,subject:a.p_subject,reviewId:a.p_review_id,expectedUpdatedAt:a.p_expected_updated_at,
    ...(operation==="review.edit"?{submission:submission(a),displayName:a.p_display_name,...(a.p_photo_ids?{photoIds:a.p_photo_ids}:{})}:{})});
  const record=owned.find((r)=>r.value.id===a.p_review_id);
  if(!record)return "not_found";
  if(options.conflictOnce){options.conflictOnce=false;record.value.updatedAt=stamp(2000+ ++tick);record.value.current.body="A newer buyer edit.";return "conflict";}
  if(record.value.updatedAt!==a.p_expected_updated_at)return "conflict";
  if(operation==="review.edit"){
    if(["hidden","withdrawn"].includes(record.value.status))return "closed";
    record.value.current={...submission(a),displayName:a.p_display_name};
    record.value.hasPendingEdit=Boolean(record.published);record.value.rejectionReason=null;record.value.status=record.published?"published":"pending";
  }else{
    record.value.status="withdrawn";record.value.hasPendingEdit=false;record.value.rejectionReason=null;record.published=null;
  }
  record.value.updatedAt=stamp(2000+ ++tick);
  if(options.failReadAfterSave)options.failRead=true;
  return operation==="review.edit"?"pending":"withdrawn";
}

/** Shopify Customer API answers: the buyer, plus configurable purchases (`options.purchase`, or several as `options.purchases`). */
function customerApi(query,variables={}){
  const buyer={id:"gid://shopify/Customer/123",firstName:"Ryan",lastName:"Fixture"};
  const purchases=options.purchases??(options.purchase?[options.purchase]:[]);
  const none={hasNextPage:false,endCursor:null};
  if(query.includes("ReviewOrderCandidates"))return {customer:{...buyer,orders:{nodes:purchases.map(({order})=>({id:order.id,updatedAt:order.updatedAt,
    lineItems:{nodes:order.lineItems.nodes.map(({id,productId})=>({id,productId})),pageInfo:none}})),pageInfo:none}}};
  if(query.includes("ReviewPurchase")){
    const purchase=purchases.find(({order})=>order.id===variables.orderId)??(purchases.length===1?purchases[0]:null);
    return {customer:{id:buyer.id},order:purchase?{...purchase.order,customer:{id:buyer.id}}:null};
  }
  return {customer:buyer};
}

createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,"http://fixture.test");
    if(url.pathname==="/health")return json(res,200,{ok:true});
    if(url.pathname==="/__reset"){reset(await body(req));return json(res,200,{ok:true});}
    if(url.pathname==="/__configure"){options={...options,...await body(req)};return json(res,200,{ok:true});}
    if(url.pathname==="/__state")return json(res,200,{calls,records});
    if(url.pathname==="/__revoke"){sessions.clear();return json(res,200,{ok:true});}
    if(url.pathname==="/__discovery")return json(res,200,{graphql_api:"https://shopify.com/123456/account/customer/api/2026-10/graphql"});
    if(url.pathname==="/__customer"){const {query,variables}=await body(req);return json(res,200,{data:customerApi(query??"",variables??{})});}
    if(req.headers.apikey!==key)return json(res,401,{message:"Synthetic Supabase key required"});
    const args=await body(req);
    if(url.pathname==="/rest/v1/store_customer_sessions"){sessions.set(args.session_hash,{...args,revision:0});return json(res,201);}
    const name=url.pathname.replace(/^\/rest\/v1\/rpc\//,"");
    if(name==="store_latest_reviews")return json(res,200,[]);
    if(name==="store_get_customer_session"){const s=sessions.get(args.p_session_hash);return json(res,200,s?[s]:[]);}
    if(name==="store_revoke_customer_session")return json(res,200,sessions.delete(args.p_session_hash));
    if(options.failRead&&name==="store_buyer_reviews")return json(res,503,{message:"Synthetic read failure"});
    const result=review(name,args);
    return result===undefined?json(res,404,{code:"PGRST202",message:"No fixture function"}):json(res,200,result);
  }catch{return json(res,500,{message:"Synthetic fixture failed"});}
}).listen(port,"127.0.0.1");
