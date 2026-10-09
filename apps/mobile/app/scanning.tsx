import { Text, View } from "react-native";

export default function ScanningScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas px-8">
      <Text className="text-center text-3xl font-bold text-white">Scanning</Text>
      <Text className="mt-3 text-center text-sm text-muted">
        Placeholder — progress will poll the website scanning API.
      </Text>
    </View>
  );
}
