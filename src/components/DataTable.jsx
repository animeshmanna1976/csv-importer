"use client";

import styles from "./DataTable.module.css";

/**
 * Responsive scrollable table with sticky header + sticky first (index) column.
 * Shared by the CSV preview and the parsed-result screens.
 *
 * @param {string[]} columns   column keys/headers
 * @param {Object[]} rows      row objects keyed by column
 * @param {(col:string)=>string} [renderHeader]  optional header label formatter
 * @param {(value:any, col:string, row:Object)=>React.ReactNode} [renderCell]
 * @param {number} [maxRows]   cap rendered rows (preview performance)
 */
export default function DataTable({
  columns,
  rows,
  renderHeader,
  renderCell,
  maxRows,
}) {
  const visibleRows = maxRows ? rows.slice(0, maxRows) : rows;

  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={`${styles.th} ${styles.indexCol}`}>#</th>
            {columns.map((col) => (
              <th key={col} className={styles.th}>
                {renderHeader ? renderHeader(col) : col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, i) => (
            <tr key={i} className={styles.tr}>
              <td className={`${styles.td} ${styles.indexCol} ${styles.indexCell}`}>
                {i + 1}
              </td>
              {columns.map((col) => {
                const value = row[col];
                return (
                  <td key={col} className={styles.td} title={toTitle(value)}>
                    {renderCell ? (
                      renderCell(value, col, row)
                    ) : (
                      <span className={value ? "" : styles.empty}>
                        {value ? String(value) : "—"}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toTitle(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}
