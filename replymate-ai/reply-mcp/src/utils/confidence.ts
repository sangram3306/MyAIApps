export function clampConfidence(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export function averageConfidence(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return clampConfidence(values.reduce((sum, value) => sum + value, 0) / values.length);
}

