import XLSX from "xlsx-js-style";

// --- Borders ---
export const thinBorder = {
  style: "thin",
  color: { rgb: "000000" },
};

export const thickBorder = {
  style: "medium",
  color: { rgb: "000000" },
};

export const allBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

export const thickAllBorders = {
  top: thickBorder,
  bottom: thickBorder,
  left: thickBorder,
  right: thickBorder,
};

export const topBottomBorder = {
  top: thinBorder,
  bottom: thinBorder,
};

// --- Alignments ---
export const leftAlign = {
  horizontal: "left",
  vertical: "center",
};

export const centerAlign = {
  horizontal: "center",
  vertical: "center",
};

// --- Color Fills ---
export const blueFill = {
  patternType: "solid",
  fgColor: { rgb: "BDD7EE" },
};

export const yellowFill = {
  patternType: "solid",
  fgColor: { rgb: "FFE39C" },
};

export const greenFill = {
  patternType: "solid",
  fgColor: { rgb: "92D050" },
};

export const redFill = {
  patternType: "solid",
  fgColor: { rgb: "FF0000" },
};

export const grayFill = {
  patternType: "solid",
  fgColor: { rgb: "808080" },
};

export const darkGrayFill = {
  patternType: "solid",
  fgColor: { rgb: "595959" },
};

export const setCell = (ws, r, c, value, type, style) => {
  const addr = XLSX.utils.encode_cell({ r, c });
  ws[addr] = { v: value, t: type, s: style };
};

export const getDayFill = (d) => {
  const day = d.getDay();
  if (day === 0) return redFill;
  if (day === 6) return grayFill;
  return null;
};

export const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
