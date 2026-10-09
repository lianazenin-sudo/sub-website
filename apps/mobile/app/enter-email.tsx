import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { isValidEmail, ROUTES } from "@trace/shared";

export default function EnterEmailScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const valid = isValidEmail(email);

  return (
    <View className="flex-1 bg-canvas px-8 pt-16 pb-10">
      <Text className="text-center text-3xl font-bold text-white">
        Enter Email
      </Text>
      <Text className="mt-3 text-center text-sm text-muted">
        Placeholder — submits to the website API later.
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor="#888888"
        className="mt-10 h-14 rounded-2xl border border-[#646464] px-4 text-white"
      />

      <View className="mt-auto gap-3">
        <Pressable
          disabled={!valid}
          onPress={() => router.push(ROUTES.createUsername)}
          className={`h-14 items-center justify-center rounded-full bg-accent ${
            valid ? "" : "opacity-40"
          }`}
        >
          <Text className="text-sm font-semibold text-black">Next</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(ROUTES.createAccount)}
          className="h-14 items-center justify-center rounded-full bg-panel"
        >
          <Text className="text-sm font-semibold text-white">Back</Text>
        </Pressable>
      </View>
    </View>
  );
}
