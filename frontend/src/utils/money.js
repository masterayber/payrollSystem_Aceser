// Peso amounts for display: "₱25,000.00". An empty value (null, undefined, "")
// gives "", so a caller can show its own blank or dash.
export const formatPeso = (value) =>
  value === null || value === undefined || value === ""
    ? ""
    : Number(value).toLocaleString("en-PH", {
        style: "currency",
        currency: "PHP",
      });
