import {
  and,
  asc,
  eq,
  isNull,
  lte,
  or,
} from "drizzle-orm";

import { db } from "@/lib/db/client";

import {
  partnerEventOutbox,
} from "@/lib/db/schema";

import {
  sendPartnerEvent,
} from "@/lib/partners/academia";

const MAX_ATTEMPTS = 10;

export async function dispatchPartnerOutbox(
  limit = 10
) {
  const now =
    new Date();

  const events =
    await db
      .select()
      .from(partnerEventOutbox)
      .where(
        and(
          or(
            eq(
              partnerEventOutbox.status,
              "pending"
            ),
            eq(
              partnerEventOutbox.status,
              "retry_scheduled"
            )
          ),
          or(
            isNull(
              partnerEventOutbox.nextAttemptAt
            ),
            lte(
              partnerEventOutbox.nextAttemptAt,
              now
            )
          )
        )
      )
      .orderBy(
        asc(
          partnerEventOutbox.createdAt
        )
      )
      .limit(limit);

  let delivered = 0;
  let failed = 0;

  for (const event of events) {
    const attemptCount =
      event.attemptCount + 1;

    await db
      .update(partnerEventOutbox)
      .set({
        status:
          "processing",

        attemptCount,

        lastAttemptAt:
          new Date(),
      })
      .where(
        eq(
          partnerEventOutbox.id,
          event.id
        )
      );

    try {
      await sendPartnerEvent(
        event.payload as Parameters<
          typeof sendPartnerEvent
        >[0]
      );

      await db
        .update(partnerEventOutbox)
        .set({
          status:
            "delivered",

          deliveredAt:
            new Date(),

          nextAttemptAt:
            null,

          lastErrorCode:
            null,
        })
        .where(
          eq(
            partnerEventOutbox.id,
            event.id
          )
        );

      delivered += 1;
    } catch (error) {
      failed += 1;

      const errorCode =
        error instanceof Error
          ? error.name
          : "partner_event_error";

      const exhausted =
        attemptCount >= MAX_ATTEMPTS;

      const retryDelayMinutes =
        Math.min(
          60,
          Math.max(
            1,
            2 ** Math.min(
              attemptCount - 1,
              6
            )
          )
        );

      const nextAttemptAt =
        new Date(
          Date.now() +
            retryDelayMinutes *
              60_000
        );

      await db
        .update(partnerEventOutbox)
        .set({
          status:
            exhausted
              ? "dead_letter"
              : "retry_scheduled",

          nextAttemptAt:
            exhausted
              ? null
              : nextAttemptAt,

          lastErrorCode:
            errorCode,
        })
        .where(
          eq(
            partnerEventOutbox.id,
            event.id
          )
        );
    }
  }

  return {
    processed:
      events.length,

    delivered,
    failed,
  };
}
