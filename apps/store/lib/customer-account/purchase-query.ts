/** Validated offline against the Shopify Customer Account API 2026-10 schema. */
export const reviewPurchaseQuery = `#graphql
  query ReviewPurchase(
    $orderId: ID!
    $linesAfter: String
    $fulfillmentsAfter: String
    $readLines: Boolean!
    $readFulfillments: Boolean!
  ) {
    customer { id }
    order(id: $orderId) {
      id
      name
      updatedAt
      cancelledAt
      financialStatus
      edited
      customer { id }
      lineItems(first: 50, after: $linesAfter) @include(if: $readLines) {
        nodes {
          id
          productId
          variantId
          name
          variantTitle
          quantity
          refundableQuantity
          requiresShipping
          giftCard
        }
        pageInfo { hasNextPage endCursor }
      }
      fulfillments(first: 10, after: $fulfillmentsAfter) @include(if: $readFulfillments) {
        nodes {
          id
          status
          createdAt
          fulfillmentLineItems(first: 50) {
            nodes { id quantity lineItem { id } }
            pageInfo { hasNextPage endCursor }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;
