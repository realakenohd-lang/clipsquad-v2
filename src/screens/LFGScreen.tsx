// src/screens/LFGScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";
import BottomSheet from "../components/BottomSheet";

type LFGPost = {
  id: string;
  game: string;
  title: string;
  platform: string;
  description: string;
  createdAt?: any;
  userId?: string;
  username?: string;
};

const formatTimeAgo = (createdAt: any) => {
  try {
    if (!createdAt) return "";
    const date =
      typeof createdAt.toDate === "function"
        ? createdAt.toDate()
        : new Date(createdAt);
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  } catch {
    return "";
  }
};

export default function LFGScreen() {
  const [game, setGame] = useState("");
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [description, setDescription] = useState("");
  const [posting, setPosting] = useState(false);
  const [posts, setPosts] = useState<LFGPost[]>([]);

  const [selectedPost, setSelectedPost] = useState<LFGPost | null>(null);
  const [joining, setJoining] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    const q = query(collection(db, "lfgPosts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data: LFGPost[] = snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          id: d.id,
          game: x.game ?? "",
          title: x.title ?? "",
          platform: x.platform ?? "",
          description: x.description ?? "",
          createdAt: x.createdAt,
          userId: x.userId,
          username: x.username ?? x.userEmail ?? "unknown",
        };
      });
      setPosts(data);
    });

    return unsub;
  }, []);

  const handleCreate = async () => {
    if (!game || !title || !platform) {
      Alert.alert("Missing info", "Game, title and platform are required.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Not logged in", "You must be logged in to post.");
      return;
    }

    try {
      setPosting(true);
      await addDoc(collection(db, "lfgPosts"), {
        game: game.trim(),
        title: title.trim(),
        platform: platform.trim(),
        description: description.trim(),
        userId: currentUser.uid,
        userEmail: currentUser.email,
        username: currentUser.email,
        createdAt: serverTimestamp(),
      });

      setGame("");
      setTitle("");
      setPlatform("");
      setDescription("");
    } catch (err: any) {
      console.log("LFG post error", err);
      Alert.alert("Error", err.message || "Could not create LFG post.");
    } finally {
      setPosting(false);
    }
  };

  const handleJoin = async () => {
    if (!selectedPost) return;
    if (!user) {
      Alert.alert("Not logged in", "You must be logged in to request to join.");
      return;
    }

    try {
      setJoining(true);
      // For now just simulate a join request
      Alert.alert(
        "Request sent",
        `You've requested to join ${selectedPost.title}. (Here you could send a DM or store a join request in Firestore.)`
      );
      setSelectedPost(null);
    } catch (err) {
      console.log("Join error", err);
    } finally {
      setJoining(false);
    }
  };

  const renderItem = ({ item }: { item: LFGPost }) => {
    const time = formatTimeAgo(item.createdAt);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setSelectedPost(item)}
      >
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.game}>{item.game}</Text>
            {time ? <Text style={styles.time}>{time}</Text> : null}
          </View>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>
            {item.platform || "Any platform"} · @{item.username || "unknown"}
          </Text>
          {item.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.joinBtn}
            onPress={() => setSelectedPost(item)}
          >
            <Text style={styles.joinText}>View / Join</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#050816" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.header}>Looking for Group</Text>

        {/* Create LFG form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Create LFG post</Text>

          <TextInput
            style={styles.input}
            placeholder="Game (e.g. Fortnite, Apex)"
            placeholderTextColor="#6b7280"
            value={game}
            onChangeText={setGame}
          />
          <TextInput
            style={styles.input}
            placeholder="Title (e.g. Ranked grind, chill games)"
            placeholderTextColor="#6b7280"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Platform (PC, PS5, Xbox...)"
            placeholderTextColor="#6b7280"
            value={platform}
            onChangeText={setPlatform}
          />
          <TextInput
            style={[styles.input, styles.descInput]}
            placeholder="Optional description: mic? rank? region? schedule?"
            placeholderTextColor="#6b7280"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <TouchableOpacity
            style={[styles.postBtn, posting && { opacity: 0.7 }]}
            onPress={handleCreate}
            disabled={posting}
          >
            <Text style={styles.postBtnText}>
              {posting ? "Posting..." : "Post LFG"}
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No LFG posts yet. Be the first to create one!
            </Text>
          }
        />

        {/* Bottom sheet for LFG details / join */}
        <BottomSheet
          visible={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          height={360}
        >
          {selectedPost ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{selectedPost.title}</Text>
              <Text style={styles.sheetGame}>{selectedPost.game}</Text>
              <Text style={styles.sheetMeta}>
                {selectedPost.platform || "Any platform"} · @
                {selectedPost.username || "unknown"}
              </Text>

              {selectedPost.description ? (
                <Text style={styles.sheetDescription}>
                  {selectedPost.description}
                </Text>
              ) : (
                <Text style={styles.sheetDescriptionMuted}>
                  No additional description.
                </Text>
              )}

              <TouchableOpacity
                style={[
                  styles.sheetJoinBtn,
                  joining && { opacity: 0.7 },
                ]}
                onPress={handleJoin}
                disabled={joining}
              >
                <Text style={styles.sheetJoinText}>
                  {joining ? "Sending..." : "Request to join"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </BottomSheet>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050816",
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  header: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
  },
  form: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  formTitle: {
    color: "white",
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#020617",
    borderRadius: 8,
    padding: 10,
    color: "white",
    marginBottom: 8,
    fontSize: 14,
  },
  descInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  postBtn: {
    backgroundColor: "#22c55e",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  postBtnText: {
    color: "#020617",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  game: {
    color: "#9ca3af",
    fontSize: 12,
  },
  time: {
    color: "#6b7280",
    fontSize: 11,
  },
  title: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 13,
    marginBottom: 4,
  },
  description: {
    color: "#d1d5db",
    fontSize: 13,
    marginBottom: 8,
  },
  joinBtn: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  joinText: {
    color: "#22c55e",
    fontWeight: "600",
    fontSize: 13,
  },
  empty: {
    color: "#6b7280",
    textAlign: "center",
    marginTop: 20,
  },
  sheetTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  sheetGame: {
    color: "#9ca3af",
    fontSize: 14,
  },
  sheetMeta: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 2,
    marginBottom: 10,
  },
  sheetDescription: {
    color: "#e5e7eb",
    marginBottom: 16,
  },
  sheetDescriptionMuted: {
    color: "#6b7280",
    marginBottom: 16,
    fontStyle: "italic",
  },
  sheetJoinBtn: {
    marginTop: 8,
    backgroundColor: "#22c55e",
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  sheetJoinText: {
    color: "#020617",
    fontWeight: "600",
  },
});
