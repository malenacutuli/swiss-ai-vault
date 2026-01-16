import * as XLSX from 'xlsx';

export interface XLSXOptions {
  title: string;
  sheetName?: string;
  headers?: string[];
}

export async function generateXLSX(
  data: any[][],
  options: XLSXOptions
): Promise<Blob> {
  const wb = XLSX.utils.book_new();

  // Set workbook properties
  wb.Props = {
    Title: options.title,
    Author: 'SwissBrAIn AI',
    CreatedDate: new Date(),
  };

  // If headers provided, prepend them
  const sheetData = options.headers ? [options.headers, ...data] : data;

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths based on content
  if (sheetData.length > 0) {
    const colWidths = sheetData[0].map((_: any, colIndex: number) => {
      let maxWidth = 10;
      sheetData.forEach((row: any[]) => {
        const cellValue = row[colIndex];
        if (cellValue) {
          const len = String(cellValue).length;
          if (len > maxWidth) maxWidth = Math.min(len, 50);
        }
      });
      return { wch: maxWidth + 2 };
    });
    ws['!cols'] = colWidths;
  }

  XLSX.utils.book_append_sheet(wb, ws, options.sheetName || 'Data');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadXLSX(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function uploadXLSX(
  blob: Blob,
  userId: string,
  filename: string,
  supabase: any
): Promise<string | null> {
  try {
    const filePath = `${userId}/spreadsheets/${filename}`;

    const { error } = await supabase.storage
      .from('agent-outputs')
      .upload(filePath, blob, {
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data } = supabase.storage
      .from('agent-outputs')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (err) {
    console.error('Upload exception:', err);
    return null;
  }
}
