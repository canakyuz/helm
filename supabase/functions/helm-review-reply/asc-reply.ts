// supabase/functions/helm-review-reply/asc-reply.ts
// Apple App Store Connect Customer Review Responses.
//   POST   /v1/customerReviewResponses             - yeni yanıt
//   PATCH  /v1/customerReviewResponses/{id}        - mevcut yanıtı güncelle
//   GET    /v1/customerReviews/{id}/response       - mevcut response_id'yi öğren

import { makeAscJwt, type ASCKeyConfig } from "../_shared/asc-jwt.ts";

export interface AscReplyInput {
  ascKey: ASCKeyConfig;
  reviewId: string;
  body: string;
}

export interface AscReplySuccess {
  ok: true;
  respondedAt: string;
}
export interface AscReplyError {
  ok: false;
  status: number;
  message: string;
}

export async function sendAscReply(
  input: AscReplyInput,
): Promise<AscReplySuccess | AscReplyError> {
  let jwt: string;
  try {
    jwt = await makeAscJwt(input.ascKey);
  } catch (e) {
    return {
      ok: false,
      status: 500,
      message: `JWT: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const resCheck = await fetch(
    `https://api.appstoreconnect.apple.com/v1/customerReviews/${input.reviewId}/response`,
    { headers: { Authorization: `Bearer ${jwt}` } },
  );
  let existingId: string | null = null;
  if (resCheck.ok) {
    const data = await resCheck.json();
    existingId = data?.data?.id ?? null;
  } else if (resCheck.status !== 404) {
    return {
      ok: false,
      status: resCheck.status,
      message: `ASC GET response ${resCheck.status}`,
    };
  }

  const url = existingId
    ? `https://api.appstoreconnect.apple.com/v1/customerReviewResponses/${existingId}`
    : `https://api.appstoreconnect.apple.com/v1/customerReviewResponses`;
  const method = existingId ? "PATCH" : "POST";
  const body = existingId
    ? {
        data: {
          type: "customerReviewResponses",
          id: existingId,
          attributes: { responseBody: input.body },
        },
      }
    : {
        data: {
          type: "customerReviewResponses",
          attributes: { responseBody: input.body },
          relationships: {
            review: {
              data: { type: "customerReviews", id: input.reviewId },
            },
          },
        },
      };

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: `ASC ${method} ${res.status}: ${await res.text()}`,
    };
  }
  const data = await res.json();
  const respondedAt =
    data?.data?.attributes?.lastModifiedDate ?? new Date().toISOString();
  return { ok: true, respondedAt };
}
