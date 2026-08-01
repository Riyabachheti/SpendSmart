const monthFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
});

const shortMonthFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "numeric",
});

export function formatMoney(amount: string | number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatPeriod(month: number, year: number) {
  return monthFormatter.format(new Date(year, month - 1, 1));
}

export function formatShortPeriod(month: number, year: number) {
  return shortMonthFormatter.format(new Date(year, month - 1, 1));
}
