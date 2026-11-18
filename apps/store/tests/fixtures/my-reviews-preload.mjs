// Process-only transport shim. Never import this from application code.
if(process.env.MY_REVIEWS_FIXTURE==="1"){
  if(process.env.STORE_REVIEWS_BACKEND_URL!=="https://backend.test"||process.env.STORE_REVIEWS_BACKEND_TOKEN!=="t".repeat(43)||
    process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET!=="synthetic-client-secret")throw new Error("Refusing non-synthetic buyer test credentials");
  const origin=`http://127.0.0.1:${Number(process.env.MY_REVIEWS_FIXTURE_PORT??54359)}`;
  const original=globalThis.fetch;
  globalThis.fetch=(input,init)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    const route=url.origin==="https://backend.test"?`${url.pathname}${url.search}`:
      url.href==="https://review-test.myshopify.com/.well-known/customer-account-api"?"/__discovery":
      url.href==="https://shopify.com/123456/account/customer/api/2026-10/graphql"?"/__customer":null;
    if(!route)return original(input,init);
    return original(input instanceof Request?new Request(new URL(route,origin),input):new URL(route,origin),init);
  };
}
