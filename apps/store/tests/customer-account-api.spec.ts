import { expect, test } from "@playwright/test";
import { createCustomerAccountApi, discoverCustomerAccountApi, customerAccountApiVersion, CustomerAccountApiError } from "../lib/customer-account/api";
import { customerAccountConfig as config } from "./fixtures/customer-account";

const url = `https://shopify.com/${config.shopId}/account/customer/api/${customerAccountApiVersion}/graphql`;
const endpoint = { url, shopId: config.shopId };

test("API discovery is public and pins the supported version on the verified shop route", async () => {
  const result = await discoverCustomerAccountApi(config, async (input, init) => {
    expect(String(input)).toBe(`https://${config.shopDomain}/.well-known/customer-account-api`);
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
    expect(init?.redirect).toBe("error"); expect(init?.cache).toBe("no-store");
    return Response.json({ graphql_api: url.replace("2026-10", "2027-01") });
  });
  expect(result).toEqual(endpoint);
});

test("wrong shops, arbitrary hosts, credentials, insecure endpoints, and malformed discovery stay unavailable", async () => {
  for (const graphql_api of [url.replace(config.shopId, "999"), url.replace("shopify.com", "attacker.test"), url.replace("https:", "http:"),
    url.replace("https://", "https://user:pass@"), `${url}?token=secret`, `${url}#fragment`, "https://localhost/customer/api/2026-10/graphql", undefined]) {
    expect(await discoverCustomerAccountApi(config, async () => Response.json({ graphql_api }))).toBeNull();
  }
  expect(await discoverCustomerAccountApi(config, async () => new Response("private-error", { status: 503 }))).toBeNull();
  let calls = 0;
  expect(await discoverCustomerAccountApi({ ...config, shopDomain: "attacker.test" }, async () => { calls++; throw new Error("not expected"); })).toBeNull();
  expect(calls).toBe(0);
});

test("customer queries send only the buyer token with the exact pinned endpoint and no cache or redirects", async () => {
  const query = createCustomerAccountApi({ config, endpoint, accessToken: "private-buyer-token", fetcher: async (input, init) => {
    expect(String(input)).toBe(url);
    const headers = new Headers(init?.headers);
    // Customer Account GraphQL uses the token without the Bearer prefix.
    expect(headers.get("authorization")).toBe("private-buyer-token");
    expect(headers.get("origin")).toBe("https://store.test");
    expect(JSON.stringify(init)).not.toContain(config.clientSecret);
    expect(init?.cache).toBe("no-store"); expect(init?.redirect).toBe("error");
    expect(JSON.parse(String(init?.body))).toEqual({ query: "query { customer { id } }", variables: {} });
    return Response.json({ data: { customer: { id: "gid://shopify/Customer/1" } } }, { headers: { "x-shopify-api-version": "2026-10" } });
  } });
  expect(await query("query { customer { id } }", {})).toEqual({ customer: { id: "gid://shopify/Customer/1" } });
});

test("partial GraphQL errors, wrong versions, malformed results, and provider failures never become an empty purchase", async () => {
  const replies = [
    () => Response.json({ data: { order: null }, errors: [{ message: "private-buyer-token" }] }),
    () => Response.json({ data: { order: null } }, { headers: { "x-shopify-api-version": "2027-01" } }),
    () => Response.json({ data: null }), () => Response.json({ data: [] }), () => Response.json({ errors: [] }),
    () => new Response("private-buyer-token", { status: 401 }), () => new Response("not-json"),
  ];
  for (const reply of replies) {
    const query = createCustomerAccountApi({ config, endpoint, accessToken: "private-buyer-token", fetcher: async () => reply() });
    await expect(query("query { customer { id } }", {})).rejects.toThrow("Purchase information is temporarily unavailable.");
  }
});

test("a transport cannot be created for another shop or an unpinned endpoint", () => {
  for (const overridden of [{ ...endpoint, shopId: "999" }, { ...endpoint, url: url.replace("2026-10", "2027-01") }, { ...endpoint, url: url.replace(config.shopId, "999") }]) {
    expect(() => createCustomerAccountApi({ config, endpoint: overridden, accessToken: "private-buyer-token" })).toThrow(CustomerAccountApiError);
  }
});
