export type RGBA = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type StrokeStyle = {
  color: RGBA;
  width: number;
  dashArray?: number[];
};

export type FillStyle = {
  color: RGBA;
  enabled: boolean;
};

export type TextStyle = {
  color: RGBA;
  fontSize: number;
  fontFamily: string;
  bold?: boolean;
  italic?: boolean;
};

export const defaultStroke = (): StrokeStyle => ({
  color: { r: 30, g: 30, b: 30, a: 1 },
  width: 2,
  dashArray: [],
});

export const defaultFill = (): FillStyle => ({
  color: { r: 255, g: 255, b: 255, a: 1 },
  enabled: false,
});

export const defaultTextStyle = (): TextStyle => ({
  color: { r: 20, g: 20, b: 20, a: 1 },
  fontSize: 22,
  fontFamily: "Arial",
  bold: false,
  italic: false,
});

export const rgbaToCss = (rgba: RGBA): string =>
  `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;

export const hexToRgba = (hex: string, alpha = 1): RGBA => {
  const cleaned = hex.replace("#", "");
  const normalized =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;

  const num = Number.parseInt(normalized, 16);

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
    a: alpha,
  };
};

export const rgbaToHex = (rgba: RGBA): string => {
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}`;
}; 