import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import {
  isUsernameFormatValid,
  ROUTES,
  sanitizeUsernameInput,
} from "@trace/shared";

export default function CreateUsernameScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const valid = isUsernameFormatValid(username);

  return (
    <View className="flex-1 bg-canvas px-8 pt-16 pb-10">
      <Text className="text-center text-3xl font-bold text-white">
        Create Username
      </Text>
      <Text className="mt-3 text-center text-sm text-muted">
        Placeholder — availability checks will call the website API later.
      </Text>

      <TextInput
        value={username}
        onChangeText={(value) => setUsername(sanitizeUsernameInput(value))}
        autoCapitalize="none"
        placeholder="username"
        placeholderTextColor="#888888"
        className="mt-10 h-14 rounded-2xl border border-[#646464] px-4 text-white"
      />

      <View className="mt-auto gap-3">
        <Pressable
          disabled={!valid}
          onPress={() => router.push(ROUTES.scanning)}
          className={`h-14 items-center justify-center rounded-full bg-accent ${
            valid ? "" : "opacity-40"
          }`}
        >
          <Text className="text-sm font-semibold text-black">Next</Text>
        </Pressable>
      </View>
    </View>
  );
}
