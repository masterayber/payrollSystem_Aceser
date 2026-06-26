import XLSX from "xlsx-js-style";
import {
  allBorders,
  blueFill,
  yellowFill,
  redFill,
  grayFill,
  centerAlign,
  setCell,
} from "./excelStyles";

export const RemarksSheet = () => {
  const ws2 = {};
  for (let c = 0; c < 4; c++) setCell(ws2, 0, c, "", "s", {});

  const refHeaderStyle = {
    font: { bold: true, sz: 12, color: { rgb: "000000" } },
    fill: { patternType: "solid", fgColor: { rgb: "FFE39C" } },
    border: allBorders,
    alignment: centerAlign,
  };
  setCell(ws2, 1, 0, "REMARKS", "s", refHeaderStyle);
  setCell(ws2, 1, 1, "DAY", "s", refHeaderStyle);

  const remarksList = ["REG", "HOL"];
  const remarkStyle = [
    {
      font: { sz: 12, color: { rgb: "000000" } },
      fill: blueFill,
      border: allBorders,
      alignment: centerAlign,
    },
    {
      font: { sz: 12, color: { rgb: "000000" } },
      fill: yellowFill,
      border: allBorders,
      alignment: centerAlign,
    },
  ];
  remarksList.forEach((val, i) => {
    setCell(ws2, 2 + i, 0, val, "s", remarkStyle[i]);
  });

  const daySources = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const dayFillMap = [redFill, null, null, null, null, null, grayFill];
  daySources.forEach((day, i) => {
    const fill = dayFillMap[i];
    setCell(ws2, 2 + i, 1, day, "s", {
      font: { sz: 12, color: { rgb: "000000" } },
      ...(fill ? { fill } : {}),
      border: allBorders,
      alignment: centerAlign,
    });
  });

  ws2["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: 8, c: 2 },
  });
  ws2["!cols"] = [{ wch: 12 }, { wch: 12 }];
  ws2["!rows"] = [{ hpt: 10 }, { wch: 22 }, ...Array(7).fill({ hpt: 20 })];

  return ws2;
};
