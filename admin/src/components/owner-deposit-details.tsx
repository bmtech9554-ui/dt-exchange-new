"use client";
import { useEffect, useState } from "react";
import { Button, Card } from "./ui";
import { ownerApi, RecordDetails, ConfirmForm } from "./owner-operations";
export function OwnerDepositDetails({ id }: { id: string }) {
  const [allowed, setAllowed] = useState(false),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [image, setImage] = useState("");
  useEffect(() => {
    let active = true;
    setData(null);
    setImage("");
    fetch("/api/operations/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (active) setAllowed(d.allowedModules?.includes("users") === true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image);
    },
    [image],
  );
  async function load() {
    try {
      setData(await ownerApi("owner/deposits/" + id));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!allowed) return null;
  return (
    <Card>
      <Button onClick={() => void load()}>Full user / deposit details</Button>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <RecordDetails data={data} />
          <p>
            Historical INR/rate information is shown only when a snapshot was
            recorded.
          </p>
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(data.deposit.tx_hash).then(
                () => setError("TxID copied."),
                () =>
                  setError("Copy unavailable. Select the TxID text to copy."),
              );
            }}
          >
            Copy TxID
          </Button>
          {data.proof && (
            <Button
              onClick={async () => {
                try {
                  const f = await ownerApi("manual/files/" + data.proof.id);
                  if (!["image/jpeg", "image/png"].includes(f.mime))
                    throw Error(
                      "Use the authorized download for this file type.",
                    );
                  const bytes = Uint8Array.from(atob(f.base64), (c) =>
                    c.charCodeAt(0),
                  );
                  setImage(
                    URL.createObjectURL(new Blob([bytes], { type: f.mime })),
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Preview protected proof
            </Button>
          )}
          {image && (
            <figure>
              <a href={image} target="_blank" rel="noopener noreferrer">
                <img
                  src={image}
                  alt="Submitted deposit proof"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 500,
                    objectFit: "contain",
                  }}
                />
              </a>
              <figcaption>
                Authenticated proof preview. Select to enlarge.
              </figcaption>
              <a href={image} download={`deposit-proof-${id}`}>Download protected proof</a><Button onClick={() => setImage("")}>Close preview</Button>
            </figure>
          )}
          {data.deposit.status === "UNDER_REVIEW" && (
            <ConfirmForm
              title="Amend pending evidence"
              initial={{
                version: data.deposit.admin_version,
                submittedAmount: data.deposit.submitted_amount,
                confirmedAmount: data.deposit.verified_amount ?? "",
                txHash: data.deposit.tx_hash,
                note: "",
              }}
              fields={[
                { key: "submittedAmount", label: "Submitted USDT amount" },
                {
                  key: "confirmedAmount",
                  label: "Confirmed USDT amount (optional)",
                  optional: true,
                },
                { key: "txHash", label: "Transaction hash" },
                { key: "note", label: "Review note" },
              ]}
              onSave={async (b) => {
                await ownerApi("owner/deposits/" + id + "/amend", {
                  ...b,
                  confirmedAmount: b.confirmedAmount || null,
                });
                await load();
              }}
            />
          )}
        </>
      )}
    </Card>
  );
}
