export const reviewBuyerQuery = `#graphql
  query ReviewBuyer {
    customer { id firstName lastName }
  }
`;

// The Customer API has no documented product-ID filter on customer.orders.
// Read bounded line references, then verify candidate orders in full.
export const reviewOrderCandidatesQuery = `#graphql
  query ReviewOrderCandidates($after: String) {
    customer {
      id
      firstName
      lastName
      orders(first: 10, after: $after, sortKey: ID, reverse: true) {
        nodes {
          id
          updatedAt
          lineItems(first: 50) {
            nodes { id productId }
            pageInfo { hasNextPage endCursor }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;
