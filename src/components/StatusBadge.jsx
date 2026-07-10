import styles from "./StatusBadge.module.css";

// Maps the four allowed crm_status values to a tone. Unknown values fall back
// to a neutral chip so the table never breaks on unexpected data.
const TONE = {
  GOOD_LEAD_FOLLOW_UP: "good",
  SALE_DONE: "done",
  DID_NOT_CONNECT: "warn",
  BAD_LEAD: "bad",
};

const LABEL = {
  GOOD_LEAD_FOLLOW_UP: "Good Lead",
  SALE_DONE: "Sale Done",
  DID_NOT_CONNECT: "Not Connected",
  BAD_LEAD: "Bad Lead",
};

export default function StatusBadge({ value }) {
  if (!value) return <span className={styles.empty}>—</span>;
  const tone = TONE[value] || "neutral";
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {LABEL[value] || value}
    </span>
  );
}
