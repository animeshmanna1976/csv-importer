import styles from "./Stepper.module.css";

const STEPS = ["Upload", "Preview", "Import", "Result"];

/**
 * Horizontal progress indicator for the 4-step flow.
 * @param {number} current  1-based index of the active step
 */
export default function Stepper({ current }) { 
  return (
    <ol className={styles.stepper}>
      {STEPS.map((label, i) => {
        const step = i + 1;
        const state =
          step < current ? "done" : step === current ? "active" : "todo";
        return (
          <li key={label} className={`${styles.step} ${styles[state]}`}>
            <span className={styles.dot}>
              {state === "done" ? "✓" : step}
            </span>
            <span className={styles.label}>{label}</span>
            {i < STEPS.length - 1 && <span className={styles.line} />}
          </li>
        );
      })}
    </ol>
  );
}
