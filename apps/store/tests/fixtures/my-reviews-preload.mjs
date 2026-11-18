// Process-only Shopify shim for the My reviews browser suite. Never import this from application code.
if(process.env.MY_REVIEWS_FIXTURE==="1"){
  if(process.env.SUPABASE_SECRET_KEY!=="synthetic-supabase-secret"||!/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL??"")||
    process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET!=="synthetic-client-secret")throw new Error("Refusing non-synthetic buyer test credentials");
  const origin=process.env.SUPABASE_URL;
  const original=globalThis.fetch;
  globalThis.fetch=(input,init)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    const route=url.href==="https://review-test.myshopify.com/.well-known/customer-account-api"?"/__discovery":
      url.href==="https://shopify.com/123456/account/customer/api/2026-10/graphql"?"/__customer":null;
    if(!route)return original(input,init);
    return original(input instanceof Request?new Request(new URL(route,origin),input):new URL(route,origin),init);
  };
}
