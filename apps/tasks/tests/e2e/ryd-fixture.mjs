import { createCipheriv, randomBytes } from "node:crypto";

const FORM = "f".repeat(30);
const SHEET = "synthetic-response-sheet";
const SNAPSHOT = "00000000-0000-4000-8000-000000000801";
const RESPONSE = "synthetic-response-801";
const EMAIL = "ryan.fixture@example.test";
const NOW = "2026-10-21T16:00:00.000Z";
const headers = ["Timestamp", "Your email", "Legal name", "Verified?"];

/** Stateful transport double, enabled only by the separate RY-D test config.
 * It exercises the real Next page/routes; Postgres invariants have pgTAP tests.
 */
export function createRydFixture(json, readBody, profile) {
  let state;
  let revision = 0;
  let snapshotSequence = 0;
  function reset(options = {}) {
    snapshotSequence = 0;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", Buffer.alloc(32, 8), iv);
    const token = Buffer.concat([
      cipher.update("synthetic-refresh", "utf8"),
      cipher.final(),
    ]);
    profile.app_role = options.role === "owner" ? "owner" : "member";
    state = {
      enabled: options.enabled !== false,
      denied: options.role === "denied",
      ambiguousForm: options.ambiguousForm === true,
      legacyBatch: options.legacyBatch === true,
      settings: {
        id: true,
        form_id: FORM,
        fulfillment_email: "fulfillment@example.test",
        upload_reminder_enabled: false,
      },
      integration: {
        id: "ryd_google",
        encrypted_refresh_token: [
          "v1",
          iv.toString("base64url"),
          cipher.getAuthTag().toString("base64url"),
          token.toString("base64url"),
        ].join("."),
        account_email: "form@example.test",
        connected_by: profile.id,
        connected_at: NOW,
        updated_at: new Date(Date.parse(NOW) + ++revision).toISOString(),
      },
      orders: [],
      links: [],
      imports: [],
      batches: [],
      snapshot: null,
      snapshotHistory: [],
      calls: [],
      tableRequests: [],
      sheetWrites: [],
      ticked: false,
    };
  }
  reset();
  const error = (response, code, message, status = 409) =>
    json(response, status, { code, message });
  const changedOrder = (order) => ({
    ...order,
    updated_at: new Date(Date.parse(order.updated_at) + 1000).toISOString(),
  });
  const publicOrder = (order) => ({
    order_id: order.order_id,
    status: order.status,
    note: order.note,
    decided_at: order.decided_at,
    decided_by: order.decided_by,
    updated_at: order.updated_at,
    linked_keys: state.links
      .filter((link) => link.order_id === order.order_id)
      .map((link) => link.submission_key),
  });
  const eligible = (order) =>
    order.status === "verified" &&
    !order.cleared_batch_id &&
    !order.production_sent_at &&
    !order.done_at;
  const snapshotReady = () =>
    state.snapshot?.state === "prepared" &&
    state.snapshot.order_rows.length === state.snapshot.verified_ids.length &&
    state.snapshot.verified_ids.every((id) =>
      state.orders.some((o) => o.order_id === id && eligible(o)),
    );
  function createSnapshot(orders) {
    if (state.snapshot) state.snapshotHistory.push(state.snapshot);
    state.snapshot = {
      id:
        snapshotSequence++ === 0
          ? SNAPSHOT
          : `00000000-0000-4000-8000-${String(801 + snapshotSequence).padStart(12, "0")}`,
      state: "prepared",
      recipient: state.settings.fulfillment_email,
      headers: state.imports.at(-1).headers,
      order_rows: orders.map((o) => ({ ...o })),
      verified_ids: orders
        .filter((o) => o.status === "verified")
        .map((o) => o.order_id),
      response_keys: state.links
        .filter((link) =>
          orders.some((order) => order.order_id === link.order_id),
        )
        .map((link) => link.submission_key),
      form_id: FORM,
      prepared_at: NOW,
    };
  }
  return async function handle(request, response, url, { single }) {
    const path = url.pathname;
    if (path === "/__ryd/reset") {
      reset(await readBody(request));
      json(response, 200, { ok: true });
      return true;
    }
    if (path === "/__ryd/state") {
      json(response, 200, {
        orders: state.orders,
        calls: state.calls,
        tableRequests: state.tableRequests,
        sheetWrites: state.sheetWrites,
        snapshot: state.snapshot,
        batches: state.batches,
      });
      return true;
    }
    if (path === "/__ryd/google") {
      const call = await readBody(request);
      const target = new URL(call.url);
      if (target.hostname === "oauth2.googleapis.com")
        json(response, 200, {
          access_token: "synthetic-google-token",
          expires_in: 3600,
        });
      else if (
        target.hostname === "forms.googleapis.com" &&
        target.pathname === `/v1/forms/${FORM}`
      )
        json(response, 200, {
          formId: FORM,
          info: { title: "Synthetic RY-D form" },
          linkedSheetId: SHEET,
          items: [
            {
              title: "Your email",
              questionItem: { question: { questionId: "email" } },
            },
            {
              title: "Legal name",
              questionItem: { question: { questionId: "name" } },
            },
            {
              title: "Social profile",
              questionItem: { question: { questionId: "social" } },
            },
            ...(state.ambiguousForm ? [{
              title: "Full name",
              questionItem: { question: { questionId: "otherName" } },
            }, {
              title: "Alternative email",
              questionItem: { question: { questionId: "otherEmail" } },
            }] : []),
          ],
        });
      else if (
        target.hostname === "forms.googleapis.com" &&
        target.pathname === `/v1/forms/${FORM}/responses`
      )
        json(response, 200, {
          responses: [
            {
              responseId: RESPONSE,
              lastSubmittedTime: NOW,
              answers: {
                email: { textAnswers: { answers: [{ value: EMAIL }] } },
                name: { textAnswers: { answers: [{ value: "Ryan Fixture" }] } },
                ...(state.ambiguousForm ? {
                  otherName: { textAnswers: { answers: [{ value: "Ryan Other" }] } },
                  otherEmail: { textAnswers: { answers: [{ value: "other@example.test" }] } },
                } : {}),
                social: {
                  textAnswers: {
                    answers: [{ value: "https://instagram.com/ryanfixture" }],
                  },
                },
              },
            },
          ],
        });
      else if (
        target.hostname === "sheets.googleapis.com" &&
        target.pathname === `/v4/spreadsheets/${SHEET}`
      )
        json(response, 200, {
          properties: { timeZone: "America/New_York" },
          sheets: [
            { properties: { sheetId: 0, title: "Summary", sheetType: "GRID" } },
            {
              properties: {
                sheetId: 77,
                title: "Responses",
                sheetType: "GRID",
              },
            },
          ],
        });
      else if (target.pathname.endsWith("/values:batchGetByDataFilter")) {
        const body = JSON.parse(call.body);
        json(response, 200, {
          valueRanges: body.dataFilters.map((filter) => ({
            dataFilters: [filter],
            valueRange: {
              values:
                filter.gridRange.sheetId === 0
                  ? [["Summary"]]
                  : filter.gridRange.endRowIndex === 1
                    ? [[...headers, "Social profile"]]
                    : [
                        [...headers, "Social profile"],
                        [
                          Date.UTC(2026, 9, 21, 12) / 86_400_000 + 25_569,
                          EMAIL,
                          "Ryan Fixture",
                          state.ticked ? "✅" : "",
                          "https://instagram.com/ryanfixture",
                        ],
                      ],
            },
          })),
        });
      } else if (target.pathname.endsWith("/values:batchUpdateByDataFilter")) {
        const body = JSON.parse(call.body);
        state.sheetWrites.push(body);
        state.ticked = true;
        json(response, 200, { totalUpdatedCells: body.data.length });
      } else
        error(
          response,
          "FIXTURE_UNHANDLED",
          "Unexpected Google fixture request",
          500,
        );
      return true;
    }
    if (path === "/rest/v1/instance_settings") {
      const row = { ryd_enabled: state.enabled };
      json(response, 200, single ? row : [row]);
      return true;
    }
    if (path === "/rest/v1/rpc/is_app_owner") {
      json(response, 200, profile.app_role === "owner");
      return true;
    }
    if (path === "/rest/v1/rpc/can_view_workspace_area") {
      json(response, 200, !state.denied);
      return true;
    }
    if (path === "/rest/v1/rpc/accessible_workspace_areas") {
      const body = await readBody(request);
      json(
        response,
        200,
        (body.requested_areas ?? []).filter(
          (area) => area !== "ryd" || !state.denied,
        ),
      );
      return true;
    }
    if (path.startsWith("/rest/v1/rpc/ryd_")) {
      const name = path.split("/").at(-1);
      const body = await readBody(request);
      if (name === "ryd_fulfillment_is_ready") {
        json(response, 200, snapshotReady());
        return true;
      }
      state.calls.push({ name, body });
      if (
        state.denied ||
        !state.enabled ||
        body.requested_actor !== profile.id
      ) {
        error(response, "42501", "RY-D access is required.", 403);
        return true;
      }
      if (name === "ryd_import_orders") {
        const payload = body.requested_payload;
        const imported = {
          id: "00000000-0000-4000-8000-000000000802",
          headers: payload.headers,
          uploaded_at: NOW,
        };
        state.imports.push(imported);
        for (const order of payload.orders)
          state.orders.push({
            order_id: order.orderId,
            sales_order: order.salesOrder,
            ordered_at: order.orderedAt,
            first_name: order.firstName,
            last_name: order.lastName,
            email: order.email,
            raw: order.raw,
            status: order.verified ? "verified" : "pending",
            note: null,
            decided_at: null,
            decided_by: null,
            cleared_batch_id: null,
            last_emailed_at: null,
            created_at: NOW,
            updated_at: NOW,
            production_sent_at: null,
            done_at: null,
          });
        json(response, 200, {
          ok: true,
          rowCount: payload.orders.length,
          newCount: payload.orders.length,
          existingCount: 0,
          duplicateCount: payload.duplicateCount,
          preverifiedCount: 0,
        });
      } else if (
        name === "ryd_link_submissions" ||
        name === "ryd_change_submission"
      ) {
        const keys = body.requested_keys ?? [body.requested_key];
        for (const key of keys)
          state.links.push({
            order_id: body.requested_order,
            submission_key: key,
          });
        json(response, 200, { ok: true, changed: true });
      } else if (name === "ryd_review_order") {
        const index = state.orders.findIndex(
          (order) => order.order_id === body.requested_order,
        );
        const order = state.orders[index];
        if (!order) {
          error(response, "RY404", "Order missing", 404);
          return true;
        }
        state.orders[index] = changedOrder({
          ...order,
          status: body.requested_patch.status ?? order.status,
          note: body.requested_patch.note ?? order.note,
          decided_at: NOW,
          decided_by: profile.id,
        });
        json(response, 200, {
          ok: true,
          order: publicOrder(state.orders[index]),
        });
      } else if (name === "ryd_prepare_selected_fulfillment") {
        if (state.legacyBatch) {
          createSnapshot(
            state.orders.filter((order) => !order.cleared_batch_id),
          );
          state.legacyBatch = false;
        }
        const ids = body.requested_orders;
        if (ids === null) {
          if (state.snapshot?.state !== "prepared") {
            error(response, "RY409", "There is no prepared batch to resume.");
            return true;
          }
        } else {
          const selected = [...new Set(ids)];
          if (
            !selected.length ||
            selected.some(
              (id) =>
                !state.orders.some((o) => o.order_id === id && eligible(o)),
            )
          ) {
            error(
              response,
              "RY409",
              "Some selected orders are no longer ready to send.",
            );
            return true;
          }
          const existing = state.snapshot?.state === "prepared";
          const matches =
            existing &&
            snapshotReady() &&
            selected.length === state.snapshot.verified_ids.length &&
            selected.every((id) => state.snapshot.verified_ids.includes(id));
          if (existing && !matches) {
            if (body.requested_replace === null) {
              json(response, 200, {
                ...state.snapshot,
                selection_conflict: true,
                requires_rebuild: !snapshotReady(),
              });
              return true;
            }
            if (body.requested_replace !== state.snapshot.id) {
              error(response, "RY409", "The prepared batch changed.");
              return true;
            }
            state.snapshot.state = "cancelled";
          }
          if (!matches)
            createSnapshot(
              state.orders.filter((o) => selected.includes(o.order_id)),
            );
        }
        json(response, 200, {
          ...state.snapshot,
          selection_conflict: false,
          requires_rebuild: !snapshotReady(),
        });
      } else if (name === "ryd_finish_fulfillment") {
        const snapshot = state.snapshot;
        const changed = snapshot.state === "prepared";
        if (changed) {
          snapshot.state =
            body.requested_action === "confirm" ? "sent" : "cancelled";
          if (snapshot.state === "sent") {
            state.batches.push({
              sent_at: NOW,
              recipient: snapshot.recipient,
              order_count: snapshot.order_rows.length,
              verified_count: snapshot.verified_ids.length,
            });
            for (const order of state.orders)
              if (snapshot.verified_ids.includes(order.order_id))
                order.cleared_batch_id = snapshot.id;
          }
        }
        json(response, 200, { changed, snapshot });
      } else if (name === "ryd_move_production") {
        const orders = [];
        for (const move of body.requested_moves) {
          const order = state.orders.find((o) => o.order_id === move.orderId);
          order.production_sent_at = move.to === "not-started" ? null : NOW;
          order.done_at = move.to === "done" ? NOW : null;
          orders.push({
            orderId: order.order_id,
            productionSentAt: order.production_sent_at,
            doneAt: order.done_at,
            updatedAt: order.updated_at,
          });
        }
        json(response, 200, { movedCount: orders.length, orders });
      } else error(response, "FIXTURE_UNHANDLED", `Unhandled RPC ${name}`, 500);
      return true;
    }
    if (path.startsWith("/rest/v1/ryd_")) {
      const table = path.slice("/rest/v1/".length);
      state.tableRequests.push({ table, method: request.method });
      if (table === "ryd_settings" && request.method === "POST") {
        Object.assign(state.settings, await readBody(request));
        json(response, 200, single ? state.settings : [state.settings]);
        return true;
      }
      const collections = {
        ryd_settings: [state.settings],
        ryd_google_integrations: [state.integration],
        ryd_orders: state.orders,
        ryd_order_submissions: state.links,
        ryd_imports: state.imports,
        ryd_fulfillment_batches: state.batches,
        ryd_fulfillment_snapshots: [
          ...state.snapshotHistory,
          ...(state.snapshot ? [state.snapshot] : []),
        ],
        ryd_dismissed_submissions: [],
        ryd_submitter_contacts: [],
      };
      if (!(table in collections)) {
        error(response, "FIXTURE_UNHANDLED", `Unhandled table ${table}`, 500);
        return true;
      }
      let rows = collections[table];
      for (const [key, value] of url.searchParams)
        if (value.startsWith("eq."))
          rows = rows.filter((row) => String(row[key]) === value.slice(3));
      if (url.searchParams.get("cleared_batch_id") === "not.is.null")
        rows = rows.filter((row) => row.cleared_batch_id);
      if (request.method === "HEAD") {
        response.writeHead(200, { "content-range": `0-0/${rows.length}` });
        response.end();
        return true;
      }
      if (url.searchParams.get("limit") === "1") rows = rows.slice(-1);
      json(response, 200, single ? (rows[0] ?? null) : rows);
      return true;
    }
    return false;
  };
}
