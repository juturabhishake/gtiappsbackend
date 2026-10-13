"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

type PartCode = {
  productId: number;
  partNo: string;
};

type TabKey = "all" | "parts" | "machines";

const tabs: { id: TabKey; label: string }[] = [
  { id: "all", label: "All Part Nos QRs" },
  { id: "parts", label: "Parts" },
  { id: "machines", label: "Machines" },
];

function PartQrCard({ part }: { part: PartCode }) {
  const [qrCode, setQrCode] = useState<string>();
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(
      JSON.stringify({ partNo: part.partNo, productId: part.productId }),
      {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 192,
        color: { dark: "#102a43", light: "#ffffff" },
      },
    )
      .then((dataUrl) => {
        if (active) setQrCode(dataUrl);
      })
      .catch((error: unknown) => {
        console.error("Failed to generate part QR code:", error);
        if (active) setQrError(true);
      });

    return () => {
      active = false;
    };
  }, [part.partNo, part.productId]);

  return (
    <article className="part-card">
      <div className="part-card__top">
        <span className="part-card__eyebrow">PRODUCT PART</span>
        <span className="part-card__id">ID · {part.productId}</span>
      </div>
      <div className="part-card__qr">
        {qrCode ? (
          <Image
            src={qrCode}
            alt={`QR code for part ${part.partNo}, product ${part.productId}`}
            width={192}
            height={192}
            unoptimized
          />
        ) : qrError ? (
          <p className="part-card__qr-message">QR code could not be generated.</p>
        ) : (
          <div className="qr-placeholder" aria-label="Generating QR code">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
      <div className="part-card__details">
        <p className="part-card__label">PART NUMBER</p>
        <h2 title={part.partNo}>{part.partNo}</h2>
        <div className="part-card__product">
          <span>Product ID</span>
          <strong>{part.productId}</strong>
        </div>
      </div>
      <p className="part-card__scan-hint">Scan to view part number + product ID</p>
    </article>
  );
}

export default function Home() {
  const [selectedTab, setSelectedTab] = useState<TabKey>("all");
  const [parts, setParts] = useState<PartCode[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadParts() {
      try {
        const response = await fetch("/api/product-matrix/part-numbers", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const result: { data: PartCode[] } = await response.json();
        setParts(result.data);
        setError("");
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error("Failed to load part numbers:", loadError);
        setError("We couldn’t load part numbers. Check your connection and try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadParts();
    return () => controller.abort();
  }, [retryCount]);

  const filteredParts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return parts;
    return parts.filter(
      ({ partNo, productId }) =>
        partNo.toLocaleLowerCase().includes(query) ||
        String(productId).includes(query),
    );
  }, [parts, search]);

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <div className="brand-mark" aria-hidden="true">
          <span>G</span>
        </div>
        <div className="dashboard__brand">
          <span className="dashboard__brand-name">GTI</span>
          <span className="dashboard__brand-caption">PRODUCT MATRIX</span>
        </div>
        <span className="dashboard__status">
          <span /> LIVE CATALOG
        </span>
      </header>

      <section className="dashboard__content">
        <div className="hero">
          <p className="hero__eyebrow">SCAN · IDENTIFY · TRACK</p>
          <h1>
            Part numbers,
            <br />
            <span>ready to scan.</span>
          </h1>
          <p className="hero__description">
            Every QR connects a part number to its Product ID. Scan it to get
            both instantly.
          </p>
        </div>

        <div className="catalog">
          <div className="catalog__toolbar">
            <div className="catalog__tabs" role="tablist" aria-label="QR code categories">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedTab === tab.id}
                  className={`catalog__tab${selectedTab === tab.id ? " is-active" : ""}`}
                  onClick={() => setSelectedTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {selectedTab === "all" && (
              <label className="catalog__search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search part or product ID"
                  aria-label="Search part number or product ID"
                />
              </label>
            )}
          </div>

          {selectedTab === "all" ? (
            <>
              <div className="catalog__summary">
                <div>
                  <h2>All Part Nos QRs</h2>
                  <p>Unique part number and product ID combinations</p>
                </div>
                <span className="catalog__count">
                  {loading ? "…" : filteredParts.length}{" "}
                  {filteredParts.length === 1 ? "CODE" : "CODES"}
                </span>
              </div>

              {loading ? (
                <div className="catalog__message" role="status">
                  <div className="loading-ring" />
                  Loading part numbers…
                </div>
              ) : error ? (
                <div className="catalog__message catalog__message--error" role="alert">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      setError("");
                      setRetryCount((count) => count + 1);
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : filteredParts.length ? (
                <div className="part-grid">
                  {filteredParts.map((part) => (
                    <div
                      className="part-grid__item"
                      key={`${part.productId}-${part.partNo}`}
                    >
                      <PartQrCard part={part} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="catalog__message">
                  {search
                    ? "No part numbers match your search."
                    : "No part numbers found in the product matrix."}
                </div>
              )}
            </>
          ) : (
            <div className="legacy-panel">
              <h2>{selectedTab === "parts" ? "Part QR Codes" : "Machine QR Codes"}</h2>
              <div className="legacy-panel__grid">
                {(selectedTab === "parts" ? [1, 3, 5, 7] : [2, 4, 6]).map((num) => (
                  <article className="legacy-card" key={num}>
                    <Image
                      src={`/${selectedTab}/qrcode${num}.png`}
                      alt={`${selectedTab === "parts" ? "Part" : "Machine"} QR code ${num}`}
                      width={150}
                      height={150}
                    />
                    <p>
                      {selectedTab === "parts" ? "Part" : "Machine"} #{num}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="dashboard__footer">
        <span>GTI · PRODUCT MATRIX</span>
        <span>Part details encoded in every scan</span>
      </footer>
    </main>
  );
}
