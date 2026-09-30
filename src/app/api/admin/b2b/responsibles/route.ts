/**
 * ADMIN B2B — lista de vendedores/RCAs + convites de cadastro pendentes.
 * Exige a sessão do admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  b2bClientRelationships,
  b2bOffers,
  b2bResponsibleInvites,
  b2bResponsibles,
  orders,
} from "@/lib/db/schema";
import { isAdminRequest } from "@/lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type AdminResponsibleRow = {
  kind: "responsible" | "invite";
  id: string;
  name: string;
  email: string;
  type: string;
  status: "invite_pending" | "invite_expired" | "awaiting_approval" | "active" | "inactive" | string;
  phone: string | null;
  invitedAt: string | null;
  inviteExpiresAt: string | null;
  lastLoginAt: string | null;
  clients: number;
  offers: number;
  paidOrders: number;
};

function responsibleStatus(status: string) {
  if (status === "active") return "active";
  if (status === "inactive") return "inactive";
  if (status === "pending") return "awaiting_approval";
  return status;
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const responsibles = await db
      .select({
        id: b2bResponsibles.id,
        name: b2bResponsibles.name,
        email: b2bResponsibles.email,
        type: b2bResponsibles.type,
        status: b2bResponsibles.status,
        phone: b2bResponsibles.phone,
        createdAt: b2bResponsibles.createdAt,
        lastLoginAt: b2bResponsibles.lastLoginAt,
        invitedAt: b2bResponsibleInvites.sentAt,
      })
      .from(b2bResponsibles)
      .leftJoin(b2bResponsibleInvites, eq(b2bResponsibleInvites.id, b2bResponsibles.inviteId))
      .orderBy(desc(b2bResponsibles.createdAt));

    const clientCounts = await db
      .select({
        responsibleId: b2bClientRelationships.responsibleId,
        total: sql<number>`count(*)::int`,
      })
      .from(b2bClientRelationships)
      .where(
        and(eq(b2bClientRelationships.active, true), isNull(b2bClientRelationships.unlinkedAt))
      )
      .groupBy(b2bClientRelationships.responsibleId);

    const offerCounts = await db
      .select({
        responsibleId: b2bOffers.responsibleId,
        total: sql<number>`count(*)::int`,
      })
      .from(b2bOffers)
      .groupBy(b2bOffers.responsibleId);

    const paidCounts = await db
      .select({
        responsibleId: orders.b2bResponsibleId,
        total: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(and(isNotNull(orders.b2bResponsibleId), eq(orders.status, "paid")))
      .groupBy(orders.b2bResponsibleId);

    const countMap = (rows: Array<{ responsibleId: string | null; total: number }>) =>
      new Map(rows.map((row) => [row.responsibleId, Number(row.total)]));

    const clientsBy = countMap(clientCounts);
    const offersBy = countMap(offerCounts);
    const paidBy = countMap(paidCounts);

    const knownEmails = new Set(responsibles.map((row) => row.email.toLowerCase()));

    const pendingInvites = await db
      .select()
      .from(b2bResponsibleInvites)
      .where(
        and(
          eq(b2bResponsibleInvites.status, "pending"),
          eq(b2bResponsibleInvites.purpose, "onboarding")
        )
      )
      .orderBy(desc(b2bResponsibleInvites.sentAt));

    const now = Date.now();

    const rows: AdminResponsibleRow[] = [
      ...pendingInvites
        .filter((invite) => !knownEmails.has(invite.email.toLowerCase()))
        .map<AdminResponsibleRow>((invite) => ({
          kind: "invite",
          id: invite.id,
          name: invite.name,
          email: invite.email,
          type: invite.responsibleType,
          status: invite.expiresAt.getTime() < now ? "invite_expired" : "invite_pending",
          phone: null,
          invitedAt: invite.sentAt.toISOString(),
          inviteExpiresAt: invite.expiresAt.toISOString(),
          lastLoginAt: null,
          clients: 0,
          offers: 0,
          paidOrders: 0,
        })),
      ...responsibles.map<AdminResponsibleRow>((row) => ({
        kind: "responsible",
        id: row.id,
        name: row.name,
        email: row.email,
        type: row.type,
        status: responsibleStatus(row.status),
        phone: row.phone,
        invitedAt: (row.invitedAt ?? row.createdAt)?.toISOString() ?? null,
        inviteExpiresAt: null,
        lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
        clients: clientsBy.get(row.id) ?? 0,
        offers: offersBy.get(row.id) ?? 0,
        paidOrders: paidBy.get(row.id) ?? 0,
      })),
    ];

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("[admin/b2b/responsibles GET]", error);
    return NextResponse.json({ error: "Erro ao carregar vendedores." }, { status: 500 });
  }
}
