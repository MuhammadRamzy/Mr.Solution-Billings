import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_LOCALES: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
  AUD: "en-AU",
  CAD: "en-CA",
  SGD: "en-SG",
  AED: "en-AE",
};

export function formatCurrency(amount: number, currency: string = "INR"): string {
  const locale = CURRENCY_LOCALES[currency] || "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (e) {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
    }).format(date);
  } catch (e) {
    return dateString;
  }
}

export function triggerServerDownload(filename: string, contentType: string, content: string, isBase64 = false) {
  // Create a temporary form and post to the download echo route
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/download";
  form.style.display = "none";

  const filenameInput = document.createElement("input");
  filenameInput.type = "hidden";
  filenameInput.name = "filename";
  filenameInput.value = filename;
  form.appendChild(filenameInput);

  const contentTypeInput = document.createElement("input");
  contentTypeInput.type = "hidden";
  contentTypeInput.name = "contentType";
  contentTypeInput.value = contentType;
  form.appendChild(contentTypeInput);

  const contentInput = document.createElement("input");
  contentInput.type = "hidden";
  contentInput.name = "content";
  contentInput.value = content;
  form.appendChild(contentInput);

  const isBase64Input = document.createElement("input");
  isBase64Input.type = "hidden";
  isBase64Input.name = "isBase64";
  isBase64Input.value = isBase64 ? "true" : "false";
  form.appendChild(isBase64Input);

  document.body.appendChild(form);
  form.submit();

  setTimeout(() => {
    document.body.removeChild(form);
  }, 200);
}

export function exportToCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((val) => {
          const escaped = String(val ?? "").replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",")
    ),
  ].join("\r\n");

  triggerServerDownload(filename, "text/csv;charset=utf-8;", csvContent, false);
}
