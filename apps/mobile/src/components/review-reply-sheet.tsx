import { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "~/theme/tokens";
import { useReviewReply } from "~/hooks/use-review-reply";
import type { Review } from "~/hooks/use-reviews";

interface Props {
  review: Review | null;
  visible: boolean;
  onClose: () => void;
}

const MAX = 350;

export function ReviewReplySheet({ review, visible, onClose }: Props) {
  const [body, setBody] = useState("");
  const mutation = useReviewReply();

  useEffect(() => {
    if (visible) setBody(review?.developer_response ?? "");
  }, [visible, review]);

  const handleSubmit = () => {
    if (!review) return;
    const trimmed = body.trim();
    if (trimmed.length === 0 || trimmed.length > MAX) return;
    mutation.mutate(
      { review_id: review.id, body: trimmed },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <SafeAreaView
          style={{
            backgroundColor: colors.bgElevated,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
          edges={["bottom"]}
        >
          <View style={{ padding: 20, gap: 12 }}>
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Geist-600",
                  fontSize: 16,
                  color: colors.fgPrimary,
                }}
              >
                {review?.developer_response ? "Yanıtı Düzenle" : "Yanıt Yaz"}
              </Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Text style={{ color: colors.fgMuted, fontSize: 14 }}>
                  İptal
                </Text>
              </Pressable>
            </View>

            {/* Review preview */}
            {review && (
              <View
                style={{
                  backgroundColor: colors.bgHigher,
                  padding: 10,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Geist-500",
                    color: colors.fgPrimary,
                    fontSize: 13,
                  }}
                >
                  {review.title ?? "—"}
                </Text>
                <Text
                  style={{
                    color: colors.fgMuted,
                    fontSize: 12,
                    marginTop: 4,
                  }}
                  numberOfLines={3}
                >
                  {review.body ?? "—"}
                </Text>
              </View>
            )}

            {/* Text input */}
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={MAX}
              placeholder="Yanıtınız…"
              placeholderTextColor={colors.fgSubtle}
              style={{
                minHeight: 100,
                backgroundColor: colors.bgBase,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
                color: colors.fgPrimary,
                fontFamily: "Geist-400",
                fontSize: 14,
                textAlignVertical: "top",
              }}
            />

            {/* Footer — char count + submit */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 11,
                  color: colors.fgMuted,
                }}
              >
                {body.length} / {MAX}
              </Text>
              <Pressable
                onPress={handleSubmit}
                disabled={mutation.isPending || body.trim().length === 0}
                style={{
                  backgroundColor:
                    mutation.isPending || body.trim().length === 0
                      ? colors.bgHigher
                      : colors.accent,
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 10,
                }}
              >
                <Text
                  style={{
                    color: colors.bgBase,
                    fontFamily: "Geist-600",
                    fontSize: 14,
                  }}
                >
                  {mutation.isPending ? "Gönderiliyor…" : "Gönder"}
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
