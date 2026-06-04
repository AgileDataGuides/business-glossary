/**
 * Shared XLSX export helper for the Context Plane monorepo.
 *
 * SA apps (BEM, Checklist, Glossary, Concept Model, Dictionary, ...) all need
 * to ship a "Download as Excel" button. They each produce a list of sheet
 * specs (`{ title, rows: string[][] }` where the first row is headers); this
 * helper packages that into a `.xlsx` Blob.
 *
 * Why ExcelJS not `xlsx`? The `xlsx` (SheetJS community) package is
 * unmaintained on npm and ships unfixed CVEs (prototype pollution, ReDoS).
 * Dependabot keeps flagging the dep. The CVEs only bite the *read* path —
 * we don't read XLSX anywhere in the monorepo, only write. ExcelJS is the
 * maintained drop-in for the write surface area we use.
 *
 * Reading XLSX is intentionally unsupported in this monorepo — there is no
 * safe parser of comparable scope. A root CI guardrail
 * (`scripts/check-no-xlsx.sh`) blocks any future re-introduction of
 * `xlsx` reads.
 *
 * Usage:
 *   import { buildXlsxBlob, downloadXlsx, type SheetSpec }
 *     from '$lib/cp-shared-xlsx';
 *
 *   const sheets: SheetSpec[] = [
 *     { title: 'Architecture', rows: [['Layer', 'Pattern'], ['Capture', 'CDC']] }
 *   ];
 *   const blob = await buildXlsxBlob(sheets);
 *   downloadXlsx(blob, 'export.xlsx');
 */
import ExcelJS from 'exceljs';

export interface SheetSpec {
	/** Worksheet title — Excel caps at 31 chars; helper truncates if longer. */
	title: string;
	/** First row should be headers, remaining rows the data. */
	rows: string[][];
}

/**
 * Build an `.xlsx` Blob from a list of sheet specs.
 * Sheet ordering is preserved — the first sheet in the array becomes the
 * first sheet in the workbook.
 */
export async function buildXlsxBlob(sheets: SheetSpec[]): Promise<Blob> {
	const wb = new ExcelJS.Workbook();
	for (const spec of sheets) {
		const ws = wb.addWorksheet(spec.title.slice(0, 31));
		ws.addRows(spec.rows);
	}
	const buffer = await wb.xlsx.writeBuffer();
	return new Blob([buffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	});
}

/** Convenience: trigger a browser download for a generated Blob. */
export function downloadXlsx(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
