function pdfEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function latin1(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, (ch) => {
    const map: Record<string, string> = {
      '—': '-',
      '–': '-',
      '’': "'",
      '‘': "'",
      '“': '"',
      '”': '"',
    }
    return map[ch] ?? '?'
  })
}

export function buildSimplePdf(title: string, lines: string[]): Blob {
  const pageWidth = 612
  const pageHeight = 792
  const margin = 48
  const leading = 14
  const usable = pageHeight - margin * 2
  const rowsPerPage = Math.floor(usable / leading) - 2

  const pages: string[][] = []
  for (let i = 0; i < lines.length; i += rowsPerPage) {
    pages.push(lines.slice(i, i + rowsPerPage))
  }
  if (pages.length === 0) pages.push([])

  const objects: string[] = []
  const add = (body: string) => {
    objects.push(body)
    return objects.length
  }

  add('<< /Type /Catalog /Pages 2 0 R >>')
  const pageIds: number[] = []
  const contentIds: number[] = []

  add('PLACEHOLDER_PAGES')
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  pages.forEach((pageLines, index) => {
    let y = pageHeight - margin
    const ops: string[] = []
    ops.push('BT')
    ops.push('/F1 14 Tf')
    ops.push(`1 0 0 1 ${margin} ${y} Tm`)
    const header = index === 0 ? title : `${title} (cont.)`
    ops.push(`(${pdfEscape(latin1(header))}) Tj`)
    y -= leading * 1.6
    ops.push('/F1 11 Tf')
    for (const line of pageLines) {
      ops.push(`1 0 0 1 ${margin} ${y} Tm`)
      ops.push(`(${pdfEscape(latin1(line).slice(0, 110))}) Tj`)
      y -= leading
    }
    ops.push('ET')
    const stream = ops.join('\n')
    const contentId = add(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    )
    contentIds.push(contentId)
    const pageId = add('PLACEHOLDER_PAGE')
    pageIds.push(pageId)
  })

  objects[1] =
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(' ')}] >>`

  pageIds.forEach((pageId, i) => {
    const contentId = contentIds[i]
    objects[pageId - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`
  })

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((obj, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xrefAt = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
