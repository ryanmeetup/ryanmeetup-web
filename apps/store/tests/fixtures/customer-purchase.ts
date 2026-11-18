export const purchaseOrderId = "gid://shopify/Order/100";
export const purchaseLineId = "gid://shopify/LineItem/101";
export const purchaseProductId = "gid://shopify/Product/102";
export const purchaseBuyerId = "gid://shopify/Customer/103";
export const purchasePageInfo = { hasNextPage: false, endCursor: null };

/** Synthetic Customer API response. No live purchase/permission proof is implied. */
export function customerPurchasePage() {
  return {
    customer: { id: purchaseBuyerId },
    order: {
      id: purchaseOrderId, name: "#100", updatedAt: "2026-11-17T12:00:00.000Z", cancelledAt: null as string | null,
      financialStatus: "PAID" as string | null, edited: false, customer: { id: purchaseBuyerId },
      lineItems: { nodes: [{ id: purchaseLineId, productId: purchaseProductId as string | null, variantId: "gid://shopify/ProductVariant/104" as string | null,
        name: "Ryan tee", variantTitle: "Blue / M" as string | null, quantity: 1, refundableQuantity: 1, requiresShipping: true, giftCard: false }],
        pageInfo: { ...purchasePageInfo } as { hasNextPage: boolean; endCursor: string | null } },
      fulfillments: { nodes: [{ id: "gid://shopify/Fulfillment/105", status: "SUCCESS" as string | null, createdAt: "2026-11-16T12:00:00.000Z",
        fulfillmentLineItems: { nodes: [{ id: "gid://shopify/FulfillmentLineItem/106", quantity: 1 as number | null, lineItem: { id: purchaseLineId } }],
          pageInfo: { ...purchasePageInfo } as { hasNextPage: boolean; endCursor: string | null } } }],
        pageInfo: { ...purchasePageInfo } as { hasNextPage: boolean; endCursor: string | null } },
    },
  };
}
