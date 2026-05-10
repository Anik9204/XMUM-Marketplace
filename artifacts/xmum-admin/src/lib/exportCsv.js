export function exportToCsv(filename, headers, rows) {
    const escape = (val) => {
        const str = val === undefined || val === null ? "" : String(val);
        const needsQuote = str.includes(",") || str.includes('"') || str.includes("\n");
        return needsQuote ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [
        headers.map(escape).join(","),
        ...rows.map((row) => row.map(escape).join(",")),
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
