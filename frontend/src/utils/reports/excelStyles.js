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

// --- Font Colors ---
export const blackFont = {
  color: { rgb: "000000" },
};

export const redFont = {
  color: { rgb: "FF0000" },
};

// --- Color Fills ---
export const blackFill = {
  patternType: "solid",
  fgColor: { rgb: "000000" },
};

export const blueFill = {
  patternType: "solid",
  fgColor: { rgb: "BDD7EE" },
};

export const redFill = {
  patternType: "solid",
  fgColor: { rgb: "FF0000" },
};

export const yellowFill = {
  patternType: "solid",
  fgColor: { rgb: "FFE39C" },
};

export const greenFill = {
  patternType: "solid",
  fgColor: { rgb: "92D050" },
};

export const violetFill = {
  patternType: "solid",
  fgColor: { rgb: "B200ED" },
};

export const brownFill = {
  patternType: "solid",
  fgColor: { rgb: "C65911" },
};

export const lightGrayFill = {
  patternType: "solid",
  fgColor: { rgb: "AEAAAA" },
};

export const grayFill = {
  patternType: "solid",
  fgColor: { rgb: "808080" },
};

export const darkGrayFill = {
  patternType: "solid",
  fgColor: { rgb: "595959" },
};

export const labelFill = {
  patternType: "solid",
  fgColor: { rgb: "F4B084" },
};

export const dayFill = {
  patternType: "solid",
  fgColor: { rgb: "D6DCE4" },
};

export const lateFill = {
  patternType: "solid",
  fgColor: { rgb: "F8CBAD" },
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

export const vleaveFill = {
  patternType: "solid",
  fgColor: { rgb: "00B050" },
};

export const sleaveFill = {
  patternType: "solid",
  fgColor: { rgb: "9BC2E6" },
};

export const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
