// src/screens/ProfileScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
} from "react-native";
import { auth, db } from "../../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  where,
  query,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import BottomSheet from "../components/BottomSheet";

export default function ProfileScreen() {
  const user = auth.currentUser;

  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [clipCount, setClipCount] = useState(0);
  const [lfgCount, setLfgCount] = useState(0);
  const [likesReceived, setLikesReceived] = useState(0);

  const [editVisible, setEditVisible] = useState(false);

  const avatarSeed = useMemo(
    () => username || user?.email || "player",
    [username, user?.email]
  );

  useEffect(() => {
    const loadProfileAndStats = async () => {
      if (!user) return;

      try {
        // basic profile
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data.username) setUsername(data.username);
          if (data.platform) setPlatform(data.platform);
          if (data.bio) setBio(data.bio);
          if (Array.isArray(data.followers)) {
            setFollowersCount(data.followers.length);
          }
          if (Array.isArray(data.following)) {
            setFollowingCount(data.following.length);
          }
        }

        // clips + likes received
        const clipsQ = query(
          collection(db, "clips"),
          where("userId", "==", user.uid)
        );
        const clipsSnap = await getDocs(clipsQ);
        setClipCount(clipsSnap.size);

        let likes = 0;
        clipsSnap.forEach((d) => {
          const data = d.data() as any;
          const likedBy: string[] = Array.isArray(data.likedBy)
            ? data.likedBy
            : [];
          likes += likedBy.length;
        });
        setLikesReceived(likes);

        // LFG posts
        const lfgQ = query(
          collection(db, "lfgPosts"),
          where("userId", "==", user.uid)
        );
        const lfgSnap = await getDocs(lfgQ);
        setLfgCount(lfgSnap.size);
      } catch (err) {
        console.log("Profile load error", err);
      }
    };

    loadProfileAndStats();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    try {
      setSaving(true);
      await setDoc(
        doc(db, "users", user.uid),
        {
          username: username.trim() || user.email,
          platform: platform.trim(),
          bio: bio.trim(),
        },
        { merge: true }
      );
      Alert.alert("Saved", "Profile updated.");
      setEditVisible(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.log("Logout error", err);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "white" }}>Not logged in.</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text style={styles.header}>Profile</Text>

        {/* Top card with avatar + main info */}
        <View style={styles.topCard}>
          <Image
            source={{
              uri: `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(
                avatarSeed
              )}`,
            }}
            style={styles.avatar}
          />

          <Text style={styles.mainName}>
            {username.trim() || user.email?.split("@")[0]}
          </Text>
          <Text style={styles.handle}>@{user.email}</Text>
          {platform ? (
            <Text style={styles.platformText}>{platform}</Text>
          ) : (
            <Text style={styles.platformTextMuted}>Add your platform</Text>
          )}

          {bio ? (
            <Text style={styles.bioText}>{bio}</Text>
          ) : (
            <Text style={styles.bioPlaceholder}>
              No bio yet. Tap Edit to add one.
            </Text>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{clipCount}</Text>
              <Text style={styles.statLabel}>Clips</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{lfgCount}</Text>
              <Text style={styles.statLabel}>LFG</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{likesReceived}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => setEditVisible(true)}
          >
            <Text style={styles.editText}>Edit profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom sheet: edit profile */}
      <BottomSheet
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        height={420}
      >
        <Text style={styles.sheetTitle}>Edit profile</Text>

        <Text style={styles.label}>Gamer tag</Text>
        <TextInput
          style={styles.input}
          placeholder="Your gamer tag"
          placeholderTextColor="#6b7280"
          value={username}
          onChangeText={setUsername}
        />

        <Text style={styles.label}>Platform</Text>
        <TextInput
          style={styles.input}
          placeholder="PC, PS5, Xbox..."
          placeholderTextColor="#6b7280"
          value={platform}
          onChangeText={setPlatform}
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          placeholder="Short bio about your playstyle, main games, etc."
          placeholderTextColor="#6b7280"
          value={bio}
          onChangeText={setBio}
          multiline
        />

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={saveProfile}
          disabled={saving}
        >
          <Text style={styles.saveText}>
            {saving ? "Saving..." : "Save profile"}
          </Text>
        </TouchableOpacity>
      </BottomSheet>
    </>
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
  topCard: {
    backgroundColor: "#0b1120",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 10,
  },
  mainName: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  handle: {
    color: "#9ca3af",
    marginTop: 2,
  },
  platformText: {
    color: "#bbf7d0",
    marginTop: 4,
    fontWeight: "600",
  },
  platformTextMuted: {
    color: "#6b7280",
    marginTop: 4,
  },
  bioText: {
    color: "#e5e7eb",
    marginTop: 8,
    textAlign: "center",
  },
  bioPlaceholder: {
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    width: "100%",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#9ca3af",
    fontSize: 11,
  },
  editBtn: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  editText: {
    color: "#22c55e",
    fontWeight: "600",
  },
  logoutBtn: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  logoutText: {
    color: "#ef4444",
    fontWeight: "600",
  },
  sheetTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  label: {
    color: "#9ca3af",
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#020617",
    borderRadius: 10,
    padding: 10,
    color: "white",
  },
  bioInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  saveBtn: {
    backgroundColor: "#22c55e",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  saveText: {
    color: "#020617",
    fontWeight: "600",
  },
});
