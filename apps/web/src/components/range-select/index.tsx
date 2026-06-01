import { Button } from "@/components/ui/button";

export const RANGES = [
  { days: 7, label: "7G" },
  { days: 30, label: "30G" },
  { days: 90, label: "90G" },
] as const;

interface RangeSelectProps {
  value: number;
  onChange: (days: number) => void;
}

// Grafik/metrik tarih aralığı seçici — 7 / 30 / 90 gün.
export const RangeSelect = ({ value, onChange }: RangeSelectProps) => (
  <div className="inline-flex gap-0.5 rounded-md border p-0.5">
    {RANGES.map((r) => (
      <Button
        key={r.days}
        variant={value === r.days ? "secondary" : "ghost"}
        size="xs"
        onClick={() => onChange(r.days)}
      >
        {r.label}
      </Button>
    ))}
  </div>
);
