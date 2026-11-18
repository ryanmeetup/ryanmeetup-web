import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createCustomerAuthBackend } from "../../lib/customer-account/backend";
import { customerAccountIssuer } from "../../lib/customer-account/config";
import { createCustomerAccountStorage } from "../../lib/customer-account/storage";
import { customerAccountConfig } from "./customer-account";
import { fakeSupabaseKey } from "./customer-auth-backend";

/** The synthetic Supabase and Shopify server behind the buyer browser suites. */
export const fixture=`http://127.0.0.1:${process.env.MY_REVIEWS_FIXTURE_PORT??54359}`;
export const state=async(request:APIRequestContext)=>(await request.get(`${fixture}/__state`)).json();
export async function reset(request:APIRequestContext,options:object={}){expect((await request.post(`${fixture}/__reset`,{data:options})).ok()).toBeTruthy();}
export async function configure(request:APIRequestContext,options:object){expect((await request.post(`${fixture}/__configure`,{data:options})).ok()).toBeTruthy();}

/** Mint only synthetic, encrypted sessions using the real private storage contract. */
export async function signIn(page:Page,baseURL:string,subject="buyer-a"){
  const scope={shopId:customerAccountConfig.shopId,clientId:customerAccountConfig.clientId,issuer:customerAccountIssuer(customerAccountConfig.shopId),redirectUri:customerAccountConfig.redirectUri};
  const backend=createCustomerAuthBackend({database:createClient(fixture,fakeSupabaseKey,{auth:{persistSession:false}}),scope});
  const storage=createCustomerAccountStorage({config:customerAccountConfig,keyring:{activeKeyId:"test",keys:new Map([["test",Buffer.alloc(32,7)]])},backend});
  const created=await storage.createSession({subject,tokens:{accessToken:"synthetic-access",refreshToken:"synthetic-refresh",idToken:"synthetic-id"},accessExpiresAt:Date.now()+3600000,expiresAt:Date.now()+86400000});
  // Chromium treats localhost as trustworthy; mint the host cookie with a
  // secure origin so its __Host- invariants are checked before local navigation.
  const cookieOrigin = new URL(baseURL); cookieOrigin.protocol = "https:";
  await page.context().addCookies([{name:"__Host-store-customer-session",value:created.id,url:cookieOrigin.origin,secure:true,httpOnly:true,sameSite:"Lax"}]);
}
