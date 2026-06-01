// helm — CMS için controlled Plate wrapper.
// `cms_entries.data.<richtext-field>` jsonb'sini doğrudan tutar.

import { useEffect } from "react";
import type { Value as PlateValue } from "platejs";
import { Plate, usePlateEditor } from "platejs/react";

import { BasicNodesKit } from "@/components/editor/plugins/basic-nodes-kit";
import { Editor, EditorContainer } from "@/components/ui/editor";

const EMPTY_VALUE: PlateValue = [{ type: "p", children: [{ text: "" }] }];

export interface CmsPlateEditorProps {
  value: PlateValue | null | undefined;
  onChange: (value: PlateValue) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export function CmsPlateEditor({
  value,
  onChange,
  placeholder = "Yazmaya başla…",
  readOnly,
}: CmsPlateEditorProps) {
  const editor = usePlateEditor({
    plugins: BasicNodesKit,
    value: value && value.length > 0 ? value : EMPTY_VALUE,
  });

  // Dış value değiştiğinde editor'ı senkronla (locale switch / revision revert)
  useEffect(() => {
    const next = value && value.length > 0 ? value : EMPTY_VALUE;
    editor.tf.setValue(next);
    // editor reference is stable for the lifetime of the component
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Plate
      editor={editor}
      onChange={({ value: next }) => onChange(next)}
      readOnly={readOnly}
    >
      <EditorContainer>
        <Editor variant="default" placeholder={placeholder} />
      </EditorContainer>
    </Plate>
  );
}
