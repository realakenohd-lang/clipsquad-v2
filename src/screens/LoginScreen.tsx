import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../../firebaseConfig";

type LoginScreenProps = {
  navigation: any;
};

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const goToMainTabs = () => {
    // navigate to the "MainTabs" screen defined in AppNavigator
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs" }],
    });
  };

  const login = async () => {
    if (!email || !password) {
      Alert.alert("Missing info", "Please enter email and password.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      goToMainTabs();
    } catch (err: any) {
      console.log("Login error:", err);
      Alert.alert("Login failed", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const register = async () => {
    if (!email || !password) {
      Alert.alert("Missing info", "Please enter email and password.");
      return;
    }

    try {
      setLoading(true);
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      goToMainTabs();
    } catch (err: any) {
      console.log("Register error:", err);
      Alert.alert("Register failed", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>ClipSquad</Text>
      <Text style={styles.subheader}>Sign in or create an account</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#6b7280"
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#6b7280"
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={login}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Loading..." : "Login"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonSecondary, loading && { opacity: 0.7 }]}
        onPress={register}
        disabled={loading}
      >
        <Text style={styles.buttonSecondaryText}>
          {loading ? "Loading..." : "Register"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  header: {
    color: "#22c55e",
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  subheader: {
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1f2937",
    color: "white",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#22c55e",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: {
    color: "#020617",
    fontWeight: "600",
  },
  buttonSecondary: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#22c55e",
    alignItems: "center",
  },
  buttonSecondaryText: {
    color: "#22c55e",
    fontWeight: "600",
  },
});
