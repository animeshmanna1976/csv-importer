"use client";

import { useRef, useState } from "react";
import styles from "./FileDropzone.module.css";
import { MAX_FILE_SIZE } from "@/lib/constants";

/**
 * Drag & drop + click-to-browse CSV uploader.
 * Validates extension and size, then hands a valid File up via onFile.
 */
export default function FileDropzone({ onFile, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const validateAndSend = (file) => {
    setError("");
    if (!file) return;

    const isCsv =
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel" ||
      file.name.toLowerCase().endsWith(".csv");

    if (!isCsv) {
      setError("Please upload a .csv file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File is too large. Maximum size is 5 MB.");
      return;
    }
    onFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    validateAndSend(e.dataTransfer.files?.[0]);
  };

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        className={`${styles.zone} ${dragging ? styles.dragging : ""} ${
          disabled ? styles.disabled : ""
        }`}
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className={styles.icon} aria-hidden>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 16V4M12 4L7 9M12 4l5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className={styles.title}>Drop your CSV file here</p>
        <p className={styles.subtitle}>or click to browse files</p>
        <span className={styles.badge}>Supported file: .csv (max 5MB)</span>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className={styles.input}
          onChange={(e) => validateAndSend(e.target.files?.[0])}
          disabled={disabled}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
