import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { Server as SocketServer } from "socket.io";
import { z } from "zod";
import argon2 from "argon2";
import { prisma } from "@qr-menu/database";
import { canTransition } from "./order-state.js";

const env = { port: Number(process.env.API_PORT ?? 4000), origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" };
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" }, trustProxy: true, bodyLimit: 1024 * 100 });
let socketServer: SocketServer | undefined;

await app.register(cors, { origin: (origin, callback) => { const allowed = [env.origin, "http://localhost:3000", "http://127.0.0.1:3000"]; callback(null, !origin || allowed.includes(origin)); }, credentials: true });
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cookie, { secret: process.env.COOKIE_SECRET ?? "development-only-change-me" });
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
await app.register(swagger, { openapi: { info: { title: "KÖR QR Menu API", version: "1.0.0" }, tags: [{ name: "menu" }, { name: "orders" }, { name: "auth" }] } });
await app.register(swaggerUi, { routePrefix: "/docs" });

const error = (reply: FastifyReply, statusCode: number, code: string, message: string) => reply.code(statusCode).send({ success: false, error: { code, message } });
const slugSchema = z.object({ slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/) });
const sessionName = "qr_session";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const getSession = async (request: FastifyRequest) => { const token = request.cookies[sessionName]; if (!token) return null; return prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: { memberships: { include: { role: true, restaurant: true } } } } } }); };
const requireRole = async (request: FastifyRequest, reply: FastifyReply, allowed: string[]) => { const session = await getSession(request); const membership = session?.user.memberships.find((entry) => allowed.includes(entry.role.name)); if (!session || session.expiresAt < new Date() || !membership) { error(reply, 401, "UNAUTHORIZED", "Authentication required"); return null; } return { session, membership }; };

app.get("/health", async () => ({ success: true, data: { status: "ok", service: "qr-menu-api" } }));

const loginSchema = z.object({ email: z.string().email().max(200), password: z.string().min(8).max(200) });
app.post("/api/v1/auth/login", { schema: { tags: ["auth"] } }, async (request, reply) => { const parsed = loginSchema.safeParse(request.body); if (!parsed.success) return error(reply, 422, "VALIDATION_ERROR", "Invalid credentials"); const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() }, include: { memberships: { include: { role: true, restaurant: true } } } }); if (!user || !user.isActive || !(await argon2.verify(user.passwordHash, parsed.data.password))) return error(reply, 401, "INVALID_CREDENTIALS", "Invalid credentials"); const raw = randomBytes(32).toString("base64url"); await prisma.session.create({ data: { userId: user.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14) } }); reply.setCookie(sessionName, raw, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 }); return { success: true, data: { id: user.id, displayName: user.displayName, memberships: user.memberships.map(({ role, restaurant }) => ({ role: role.name, restaurantId: restaurant.id, restaurant: restaurant.name })) } }; });
app.post("/api/v1/auth/logout", { schema: { tags: ["auth"] } }, async (request, reply) => { const token = request.cookies[sessionName]; if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }); reply.clearCookie(sessionName, { path: "/" }); return { success: true, data: null }; });
app.get("/api/v1/auth/me", { schema: { tags: ["auth"] } }, async (request, reply) => { const current = await getSession(request); if (!current || current.expiresAt < new Date()) return error(reply, 401, "UNAUTHORIZED", "Authentication required"); return { success: true, data: { id: current.user.id, displayName: current.user.displayName, memberships: current.user.memberships.map(({ role, restaurant }) => ({ role: role.name, restaurantId: restaurant.id, restaurant: restaurant.name })) } }; });

app.get("/api/v1/restaurants/:slug/menu", { schema: { tags: ["menu"] } }, async (request, reply) => {
  const parsed = slugSchema.safeParse(request.params);
  if (!parsed.success) return error(reply, 400, "VALIDATION_ERROR", "Invalid restaurant slug");
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: parsed.data.slug }, include: { settings: true, categories: { where: { isVisible: true }, orderBy: { sortOrder: "asc" }, include: { translations: true, products: { where: { isAvailable: true }, orderBy: { sortOrder: "asc" }, include: { variants: true, modifiers: { include: { modifier: true } } } } } } } });
  if (!restaurant || restaurant.status !== "ACTIVE") return error(reply, 404, "RESTAURANT_NOT_FOUND", "Restaurant not found");
  return { success: true, data: restaurant };
});

app.get("/api/v1/restaurants/:slug/tables", { schema: { tags: ["menu"] } }, async (request, reply) => {
  const parsed = slugSchema.safeParse(request.params);
  if (!parsed.success) return error(reply, 400, "VALIDATION_ERROR", "Invalid restaurant slug");
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: parsed.data.slug }, include: { tables: { where: { isActive: true }, orderBy: { number: "asc" }, select: { id: true, number: true, capacity: true, isActive: true } } } });
  if (!restaurant || restaurant.status !== "ACTIVE") return error(reply, 404, "RESTAURANT_NOT_FOUND", "Restaurant not found");
  return { success: true, data: { restaurantId: restaurant.id, restaurant: restaurant.name, tables: restaurant.tables.map((table) => ({ ...table, menuUrl: `${env.origin}/menu/${restaurant.slug}?table=${table.number}` })) } };
});

app.get("/api/v1/orders/track/:token", async (request, reply) => {
  const token = String((request.params as { token?: string }).token ?? "");
  if (!/^(?:[A-Za-z0-9_-]{20,100}|KOR-\d{4})$/.test(token)) return error(reply, 404, "ORDER_NOT_FOUND", "Order not found");
  const order = await prisma.order.findFirst({ where: { OR: [{ trackingToken: token }, { displayNumber: token }] }, include: { restaurant: { select: { name: true, address: true } }, table: { select: { number: true } }, items: { select: { nameSnapshot: true, quantity: true, unitPrice: true } } } });
  if (!order) return error(reply, 404, "ORDER_NOT_FOUND", "Order not found");
  return { success: true, data: { id: order.id, displayNumber: order.displayNumber, trackingToken: order.trackingToken, status: order.status, estimatedMinutes: order.estimatedMinutes, total: order.total, fulfillment: order.fulfillment, tableNumber: order.table?.number, restaurant: order.restaurant, items: order.items } };
});

const createOrder = z.object({ restaurantId: z.string().cuid(), tableId: z.string().cuid().optional(), tableNumber: z.string().trim().max(20).optional(), fulfillment: z.enum(["DINE_IN", "PICKUP"]), customerName: z.string().trim().max(80).optional(), customerPhone: z.string().trim().max(30).optional(), note: z.string().trim().max(500).optional(), items: z.array(z.object({ productId: z.string().cuid(), variantId: z.string().cuid().optional(), quantity: z.number().int().min(1).max(50), modifierIds: z.array(z.string().cuid()).max(20).default([]), note: z.string().max(300).optional() })).min(1).max(50) });

app.post("/api/v1/orders", { schema: { tags: ["orders"] } }, async (request, reply) => {
  const parsed = createOrder.safeParse(request.body);
  if (!parsed.success) return error(reply, 422, "VALIDATION_ERROR", "Invalid order payload");
  const input = parsed.data;
  const restaurant = await prisma.restaurant.findUnique({ where: { id: input.restaurantId }, include: { settings: true } });
  if (!restaurant || restaurant.status !== "ACTIVE" || !restaurant.settings) return error(reply, 404, "RESTAURANT_NOT_FOUND", "Restaurant not found");
  let resolvedTableId = input.tableId;
  if (input.tableNumber) { const table = await prisma.restaurantTable.findFirst({ where: { number: input.tableNumber, restaurantId: input.restaurantId, isActive: true } }); if (!table) return error(reply, 422, "INVALID_TABLE", "Table is not available"); resolvedTableId = table.id; }
  if (resolvedTableId) { const table = await prisma.restaurantTable.findFirst({ where: { id: resolvedTableId, restaurantId: input.restaurantId, isActive: true } }); if (!table) return error(reply, 422, "INVALID_TABLE", "Table is not available"); }
  // Prices are read from the database inside the transaction; never trust client totals.
  const products = await prisma.product.findMany({ where: { id: { in: input.items.map((item) => item.productId) }, restaurantId: input.restaurantId, isAvailable: true }, include: { variants: true, modifiers: { include: { modifier: true } } } });
  if (products.length !== new Set(input.items.map((item) => item.productId)).size) return error(reply, 422, "ITEM_UNAVAILABLE", "One or more items are unavailable");
  const productById = new Map(products.map((product) => [product.id, product]));
  for (const item of input.items) { const product = productById.get(item.productId)!; if (item.variantId && !product.variants.some((variant) => variant.id === item.variantId)) return error(reply, 422, "INVALID_VARIANT", "One or more variants are invalid"); if (item.modifierIds.some((id) => !product.modifiers.some((modifier) => modifier.modifierId === id))) return error(reply, 422, "INVALID_MODIFIER", "One or more modifiers are invalid"); }
  const lines = input.items.map((item) => { const product = productById.get(item.productId)!; const variant = item.variantId ? product.variants.find((v) => v.id === item.variantId) : null; const selectedModifiers = item.modifierIds.map((id) => product.modifiers.find((m) => m.modifierId === id)?.modifier); const modifierTotal = selectedModifiers.reduce((sum, modifier) => sum + (modifier?.price ?? 0), 0); const unitPrice = (variant?.price ?? product.price) + modifierTotal; return { productId: product.id, variantId: variant?.id, nameSnapshot: product.nameRu, unitPrice, quantity: item.quantity, note: item.note }; });
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const serviceFee = Math.round(subtotal * Number(restaurant.settings.serviceFeePercent) / 100);
  const total = subtotal + serviceFee;
  if (total < restaurant.settings.minimumOrderAmount) return error(reply, 422, "MINIMUM_ORDER", "Order total is below the minimum");
  const order = await prisma.$transaction(async (tx) => { const number = `KOR-${Math.floor(1000 + Math.random() * 8999)}`; const created = await tx.order.create({ data: { restaurantId: input.restaurantId, tableId: resolvedTableId, displayNumber: number, trackingToken: randomBytes(24).toString("base64url"), fulfillment: input.fulfillment, customerName: input.customerName, customerPhone: input.customerPhone, note: input.note, subtotal, serviceFee, total, items: { create: lines }, statusHistory: { create: { fromStatus: null, toStatus: "NEW" } } }, include: { items: true } }); return created; });
  socketServer?.to(`restaurant:${input.restaurantId}`).emit("order.created", { orderId: order.id, displayNumber: order.displayNumber });
  return reply.code(201).send({ success: true, data: order });
});

const statusUpdate = z.object({ status: z.enum(["NEW", "COOKING", "READY", "DELIVERING", "COMPLETED", "CANCELLED"]), estimatedMinutes: z.number().int().min(0).max(240).optional() });
app.patch("/api/v1/orders/:id/status", { schema: { tags: ["orders"] } }, async (request, reply) => { const auth = await requireRole(request, reply, ["OWNER", "MANAGER", "KITCHEN", "WAITER"]); if (!auth) return; const body = statusUpdate.safeParse(request.body); if (!body.success) return error(reply, 422, "VALIDATION_ERROR", "Invalid status"); const role = auth.membership.role.name; if (role === "KITCHEN" && !["COOKING", "READY", "CANCELLED"].includes(body.data.status)) return error(reply, 403, "FORBIDDEN", "Kitchen role cannot perform this transition"); if (role === "WAITER" && !["DELIVERING", "COMPLETED", "CANCELLED"].includes(body.data.status)) return error(reply, 403, "FORBIDDEN", "Waiter role cannot perform this transition"); const order = await prisma.order.findUnique({ where: { id: String((request.params as { id: string }).id) } }); if (!order || order.restaurantId !== auth.membership.restaurantId) return error(reply, 404, "ORDER_NOT_FOUND", "Order not found"); if (!canTransition(order.status, body.data.status)) return error(reply, 409, "INVALID_STATE_TRANSITION", "Order status cannot be changed that way"); const updated = await prisma.$transaction(async (tx) => { const next = await tx.order.update({ where: { id: order.id }, data: { status: body.data.status, estimatedMinutes: body.data.estimatedMinutes } }); await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: body.data.status } }); await tx.auditLog.create({ data: { restaurantId: order.restaurantId, actorId: auth.session.user.id, action: "ORDER_STATUS_CHANGED", entity: "Order", entityId: order.id, metadata: { from: order.status, to: body.data.status } } }); return next; }); socketServer?.to(`order:${order.id}`).emit(`order.${body.data.status.toLowerCase()}`, updated); return { success: true, data: updated }; });

socketServer = new SocketServer(app.server, { cors: { origin: env.origin, credentials: true } });
socketServer.on("connection", (socket) => { socket.on("order.subscribe", async (payload: { orderId?: string; trackingToken?: string }) => { if (!payload || typeof payload.orderId !== "string" || typeof payload.trackingToken !== "string") return; const order = await prisma.order.findFirst({ where: { id: payload.orderId, trackingToken: payload.trackingToken }, select: { id: true } }); if (order) socket.join(`order:${order.id}`); }); });

app.setErrorHandler((thrown, request, reply) => { request.log.error({ err: thrown }, "Unhandled request error"); return error(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred"); });
await app.listen({ port: env.port, host: "0.0.0.0" });
