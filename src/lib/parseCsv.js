import Papa from "papaparse";

/**
 * Parse a CSV File into { headers, rows } using PapaParse.
 * Parsing happens entirely in the browser — no AI, no network — so the user can
 * preview exactly what they uploaded before confirming the import.
 *
 * @param {File} file
 * @returns {Promise<{ headers: string[], rows: Object[], meta: object }>}
 */
export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => (h ?? "").trim(),
      complete: (results) => {
        const headers =
          results.meta.fields?.filter((h) => h && h.length > 0) ?? [];

        if (headers.length === 0) {
          reject(new Error("No columns found. Is this a valid CSV file?"));
          return;
        }

        resolve({
          headers,
          rows: results.data,
          meta: {
            rowCount: results.data.length,
            columnCount: headers.length,
            errorCount: results.errors.length,
          },
        });
      },
      error: (err) => reject(err),
    });
  });
}
