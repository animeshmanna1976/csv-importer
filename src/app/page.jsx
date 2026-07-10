"use client";

import { useState } from "react";
import styles from "./page.module.css";

import Stepper from "@/components/Stepper";
import FileDropzone from "@/components/FileDropzone";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import ThemeToggle from "@/components/ThemeToggle";
import ResultSummary from "@/components/ResultSummary";

import { parseCsvFile } from "@/lib/parseCsv";
import { importCsv } from "@/lib/importApi";
import { CRM_FIELDS } from "@/lib/constants";

const PREVIEW_LIMIT = 100; // rows rendered in the preview table

export default function Home() {
  const [step, setStep] = useState(1); // 1 upload · 2 preview · 3 (import) · 4 result
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null); // { headers, rows, meta }
  const [result, setResult] = useState(null); // { imported, skipped, records, skippedRecords }

  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  // ── Step 1 → 2: parse the uploaded file locally (no AI yet) ─────────
  const handleFile = async (f) => {
    setError("");
    setFile(f);
    setParsing(true);
    try {
      const data = await parseCsvFile(f);
      setParsed(data);
      setStep(2);
    } catch (err) {
      setError(err.message || "Could not parse this CSV file.");
      setFile(null);
    } finally {
      setParsing(false);
    }
  };

  // ── Step 3: confirm → call backend for AI extraction ───────────────
  const handleConfirm = async () => {
    if (!parsed) return;
    setError("");
    setImporting(true);
    setStep(3);
    try {
      const res = await importCsv({
        headers: parsed.headers,
        rows: parsed.rows,
        fileName: file?.name || "upload.csv",
      });
      setResult(res);
      setStep(4);
    } catch (err) {
      setError(err.message || "Import failed. Please try again.");
      setStep(2); // back to preview so the user can retry
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setFile(null);
    setParsed(null);
    setResult(null);
    setError("");
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>GE</span>
          <div>
            <h1 className={styles.title}>GrowEasy CSV Importer</h1>
            <p className={styles.tagline}>
              Import leads from any CSV into GrowEasy CRM format.
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div className={styles.stepperWrap}>
        <Stepper current={step} />
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>⚠</span>
          <span>{error}</span>
          <button className={styles.errorClose} onClick={() => setError("")}>
            ✕
          </button>
        </div>
      )}

      {/* ── Step 1: Upload ─────────────────────────────────────────── */}
      {step === 1 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Upload CSV</h2>
          <p className={styles.cardSub}>
            Facebook, Google Ads, Excel, CRM exports — any valid CSV works.
          </p>
          <FileDropzone onFile={handleFile} disabled={parsing} />
          {parsing && (
            <p className={styles.parsingNote}>
              <span className={styles.spinner} /> Parsing file…
            </p>
          )}
        </section>
      )}

      {/* ── Step 2: Preview ────────────────────────────────────────── */}
      {step === 2 && parsed && (
        <section className={styles.card}>
          <div className={styles.previewHead}>
            <div>
              <h2 className={styles.cardTitle}>Preview</h2>
              <p className={styles.cardSub}>
                <strong>{file?.name}</strong> · {parsed.meta.rowCount} rows ·{" "}
                {parsed.meta.columnCount} columns
              </p>
            </div>
            <span className={styles.pill}>No AI processing yet</span>
          </div>

          <DataTable
            columns={parsed.headers}
            rows={parsed.rows}
            maxRows={PREVIEW_LIMIT}
          />

          {parsed.rows.length > PREVIEW_LIMIT && (
            <p className={styles.previewNote}>
              Showing first {PREVIEW_LIMIT} of {parsed.rows.length} rows. All
              rows will be imported.
            </p>
          )}

          <div className={styles.actions}>
            <button className={styles.btnGhost} onClick={reset}>
              Cancel
            </button>
            <button
              className={styles.btnPrimary}
              onClick={handleConfirm}
              disabled={importing}
            >
              Confirm &amp; Import
            </button>
          </div>
        </section>
      )}

      {/* ── Step 3: Importing (loading state) ──────────────────────── */}
      {step === 3 && (
        <section className={`${styles.card} ${styles.loadingCard}`}>
          <span className={styles.bigSpinner} />
          <h2 className={styles.cardTitle}>Extracting leads with AI…</h2>
          <p className={styles.cardSub}>
            Mapping your columns into GrowEasy CRM format. This may take a
            moment.
          </p>
        </section>
      )}

      {/* ── Step 4: Result ─────────────────────────────────────────── */}
      {step === 4 && result && (
        <section className={styles.card}>
          <div className={styles.previewHead}>
            <div>
              <h2 className={styles.cardTitle}>Import Complete</h2>
              <p className={styles.cardSub}>
                AI-extracted CRM records from <strong>{file?.name}</strong>.
              </p>
            </div>
            <button className={styles.btnGhost} onClick={reset}>
              Import another file
            </button>
          </div>

          <ResultSummary
            imported={result.imported}
            skipped={result.skipped}
            total={result.imported + result.skipped}
          />

          {result.records.length > 0 ? (
            <DataTable
              columns={CRM_FIELDS.map((f) => f.key)}
              rows={result.records}
              renderHeader={(key) =>
                CRM_FIELDS.find((f) => f.key === key)?.label || key
              }
              renderCell={(value, col) =>
                col === "crm_status" ? (
                  <StatusBadge value={value} />
                ) : (
                  <span>{value || "—"}</span>
                )
              }
            />
          ) : (
            <p className={styles.previewNote}>
              No records could be imported from this file.
            </p>
          )}

          {result.skipped > 0 && (
            <details className={styles.skipped}>
              <summary>
                {result.skipped} record{result.skipped > 1 ? "s" : ""} skipped
                (no email or mobile)
              </summary>
              <DataTable
                columns={parsed?.headers || []}
                rows={(result.skippedRecords || []).map((s) => s.original || s)}
                maxRows={50}
              />
            </details>
          )}
        </section>
      )}

      <footer className={styles.footer}>
        Built for the GrowEasy assignment · Frontend (Next.js)
      </footer>
    </main>
  );
}
