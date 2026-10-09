import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { ROUTES } from "@trace/shared";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-canvas px-8">
      <Text className="text-xl font-bold text-white">Screen not found</Text>
      <Pressable
        onPress={() => router.replace(ROUTES.onboarding)}
        className="mt-4"
      >
        <Text className="text-accent">Go to onboarding</Text>
      </Pressable>
    </View>
  );
}
