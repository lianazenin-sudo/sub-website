import { Pressable, Text, View } from "react-native";

type PlaceholderScreenProps = {
  title: string;
  description: string;
  primaryLabel?: string;
  onPrimaryPress?: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
};

/** Shared RN-only placeholder shell for onboarding screens. */
export function PlaceholderScreen({
  title,
  description,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress,
}: PlaceholderScreenProps) {
  return (
    <View className="flex-1 bg-canvas px-8 pt-16 pb-10">
      <Text className="text-center text-3xl font-bold text-white">{title}</Text>
      <Text className="mt-3 text-center text-sm leading-5 text-muted">
        {description}
      </Text>

      <View className="mt-auto gap-3">
        {primaryLabel && onPrimaryPress ? (
          <Pressable
            onPress={onPrimaryPress}
            className="h-14 items-center justify-center rounded-full bg-accent"
          >
            <Text className="text-sm font-semibold text-black">{primaryLabel}</Text>
          </Pressable>
        ) : null}

        {secondaryLabel && onSecondaryPress ? (
          <Pressable
            onPress={onSecondaryPress}
            className="h-14 items-center justify-center rounded-full bg-panel"
          >
            <Text className="text-sm font-semibold text-white">
              {secondaryLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
