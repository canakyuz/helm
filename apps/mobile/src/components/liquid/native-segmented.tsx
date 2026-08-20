import { Host, Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";

// Native iOS segmented control (SwiftUI Picker, .segmented style).
// Drop-in replacement for the custom <Seg> - same prop shape.
export function NativeSegmented<T extends string>({
  value,
  options,
  onChange,
  height = 34,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  height?: number;
}) {
  return (
    <Host matchContents={{ vertical: true }} colorScheme="dark" style={{ width: "100%", height }}>
      <Picker
        selection={value}
        onSelectionChange={(v) => onChange(v as T)}
        modifiers={[pickerStyle("segmented")]}
      >
        {options.map((o) => (
          <Text key={o} modifiers={[tag(o as string)]}>
            {o}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
