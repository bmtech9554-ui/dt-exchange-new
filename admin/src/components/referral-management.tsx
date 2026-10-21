"use client";
import { useEffect, useState } from "react";
import { Card, Button } from "./ui";
import { ConfirmForm, ownerApi, RecordDetails } from "./owner-operations";

export function ReferralManagement({
  settings = false,
}: {
  settings?: boolean;
}) {
  const [page, setPage] = useState(1),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    ownerApi(
      settings ? "owner/referral-settings" : `owner/referrals?page=${page}`,
    )
      .then((r) => {
        if (live) setData(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [page, settings, revision]);
  return (
    <>
      <h1>{settings ? "Referral Settings" : "Referral Management"}</h1>
      <p>
        Registration and OTP rewards are held separately until an authorized
        manual release. Historical reward snapshots never change.
      </p>
      {error && <p role="alert">{error}</p>}
      {!data ? (
        error ? (
          <Button variant="secondary" onClick={() => setRevision((r) => r + 1)}>
            Retry
          </Button>
        ) : (
          <p role="status">Loading…</p>
        )
      ) : settings ? (
        <Card>
          <ConfirmForm
            title="Update referral policy"
            initial={{ ...data.value, version: data.version }}
            fields={[
              {
                key: "enabled",
                label: "Enable registration referral rewards",
                type: "checkbox",
              },
              { key: "rewardUsdt", label: "Reward (USDT)", type: "text" },
            ]}
            onSave={async (b) => {
              await ownerApi("owner/referral-settings", {
                version: b.version,
                reason: b.reason,
                confirm: true,
                value: {
                  enabled: b.enabled,
                  rewardUsdt: b.rewardUsdt,
                  event: "REGISTRATION_OTP",
                  creditMode: "MANUAL_RELEASE",
                },
              });
              setRevision((r) => r + 1);
            }}
          />
          <p>Last updated: {new Date(data.updated_at).toLocaleString()}</p>
        </Card>
      ) : (
        <>
          {data.length === 0 && <Card>No referrals recorded.</Card>}
          {data.map((r: any) => (
            <Card key={r.id}>
              <h2>
                User {r.referrer_public_id} → User {r.referred_public_id}
              </h2>
              <RecordDetails
                data={Object.fromEntries(
                  Object.entries(r).filter(
                    ([key]) => !["canReview", "canRelease"].includes(key),
                  ),
                )}
              />
              {r.canRelease &&
                r.reward_id &&
                !r.released_at &&
                r.lifecycle === "QUALIFIED" &&
                !r.review_required && (
                  <details>
                    <summary>Request manual reward release</summary>
                    <ConfirmForm
                      title="Release reward to wallet"
                      initial={{}}
                      fields={[]}
                      onSave={async (b) => {
                        await ownerApi(
                          `owner/referral-rewards/${r.reward_id}/release`,
                          { confirm: true, reason: b.reason },
                        );
                        setRevision((n) => n + 1);
                      }}
                    />
                    <p>
                      Requires the referral-release permission and enabled
                      financial execution. No automatic release occurs.
                    </p>
                  </details>
                )}
              {r.canReview &&
                !r.released_at &&
                !["REJECTED", "REWARDED"].includes(r.lifecycle) && (
                  <details>
                    <summary>Reject referral reward</summary>
                    <ConfirmForm
                      title="Reject referral reward"
                      initial={{}}
                      fields={[]}
                      onSave={async (b) => {
                        await ownerApi(`engagement/referrals/${r.id}/action`, {
                          action: "reject",
                          reason: b.reason,
                        });
                        setRevision((n) => n + 1);
                      }}
                    />
                    <p>
                      Records an audited rejection. Released rewards remain
                      immutable.
                    </p>
                  </details>
                )}
            </Card>
          ))}
          <div className="owner-actions">
            <Button
              variant="secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>Page {page}</span>
            <Button
              variant="secondary"
              disabled={data.length < 50}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </>
  );
}
