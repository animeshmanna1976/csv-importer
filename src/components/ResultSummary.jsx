import styles from "./ResultSummary.module.css";

// Summary stat cards shown above the parsed-result table:
// total processed, successfully imported, and skipped.
export default function ResultSummary({ imported, skipped, total }) {
  return (
    <div className={styles.grid}>
      <div className={styles.stat}>
        <span className={styles.value}>{total}</span>
        <span className={styles.label}>Total records</span>
      </div>
      <div className={`${styles.stat} ${styles.good}`}>
        <span className={styles.value}>{imported}</span>
        <span className={styles.label}>Imported</span>
      </div>
      <div className={`${styles.stat} ${styles.bad}`}>
        <span className={styles.value}>{skipped}</span>
        <span className={styles.label}>Skipped</span>
      </div>
    </div>
  );
}
