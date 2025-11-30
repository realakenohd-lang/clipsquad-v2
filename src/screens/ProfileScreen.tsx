import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from "react-native";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  where,
  query,
} from "firebase/firestore";
import { auth, db } from "../../firebaseConfig";
import BottomSheet from "../components/BottomSheet";

// ---------- helpers ----------

// never show full emails as a display name
const getSafeDisplayName = (username?: string, email?: string | null) => {
  const candidate = (username || email || "").trim();
  if (!candidate) return "player";

  if (candidate.includes("@")) {
    const beforeAt = candidate.split("@")[0].trim();
    if (beforeAt.length >= 3) return beforeAt;
    return "player";
  }
  return candidate;
};

type ProfileState = {
  username: string;
  platform: string;
  favoriteGame: string;
  region: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  clipCount: number;
  lfgCount: number;
};

const emptyProfile: ProfileState = {
  username: "",
  platform: "",
  favoriteGame: "",
  region: "",
  bio: "",
  followersCount: 0,
  followingCount: 0,
  clipCount: 0,
  lfgCount: 0,
};

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileState>(emptyProfile);

  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // local edit fields
  const [editUsername, setEditUsername] = useState("");
  const [editPlatform, setEditPlatform] = useState("");
  const [editFavoriteGame, setEditFavoriteGame] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editBio, setEditBio] = useState("");

  const user = auth.currentUser;

  // -------- load profile + stats ----------
  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        let username = "";
        let platform = "";
        let favoriteGame = "";
        let region = "";
        let bio = "";
        let followersCount = 0;
        let followingCount = 0;

        if (snap.exists()) {
          const data = snap.data() as any;
          username = data.username || "";
          platform = data.platform || "";
          favoriteGame = data.favoriteGame || "";
          region = data.region || "";
          bio = data.bio || "";
          followersCount = Array.isArray(data.followers)
            ? data.followers.length
            : 0;
          followingCount = Array.isArray(data.following)
            ? data.following.length
            : 0;
        } else {
          // create a basic doc so follow system works later
          await setDoc(userRef, {
            email: user.email ?? null,
            createdAt: new Date(),
          });
        }

        // stats based on content
        const clipsQ = query(
          collection(db, "clips"),
          where("userId", "==", user.uid)
        );
        const clipsSnap = await getDocs(clipsQ);
        const clipCount = clipsSnap.size;

        const lfgQ = query(
          collection(db, "lfgPosts"),
          where("userId", "==", user.uid)
        );
        const lfgSnap = await getDocs(lfgQ);
        const lfgCount = lfgSnap.size;

        const newProfile: ProfileState = {
          username,
          platform,
          favoriteGame,
          region,
          bio,
          followersCount,
          followingCount,
          clipCount,
          lfgCount,
        };

        setProfile(newProfile);

        // fill edit fields
        setEditUsername(username);
        setEditPlatform(platform);
        setEditFavoriteGame(favoriteGame);
        setEditRegion(region);
        setEditBio(bio);
      } catch (err) {
        console.log("Profile load error", err);
        Alert.alert("Error", "Could not load profile.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.uid]);

  // -------- save profile edits ----------
  const handleSaveProfile = async () => {
    if (!user) return;

    const trimmedUsername = editUsername.trim();
    if (!trimmedUsername) {
      Alert.alert("Missing username", "Please enter a username.");
      return;
    }

    try {
      setSaving(true);

      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          username: trimmedUsername,
          platform: editPlatform.trim(),
          favoriteGame: editFavoriteGame.trim(),
          region: editRegion.trim(),
          bio: editBio.trim(),
          email: user.email ?? null, // still stored, but NOT displayed
        },
        { merge: true }
      );

      setProfile((prev) => ({
        ...prev,
        username: trimmedUsername,
        platform: editPlatform.trim(),
        favoriteGame: editFavoriteGame.trim(),
        region: editRegion.trim(),
        bio: editBio.trim(),
      }));

      setEditVisible(false);
    } catch (err) {
      console.log("Save profile error", err);
      Alert.alert("Error", "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.centerText}>
          You need to be logged in to see your profile.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const displayName = getSafeDisplayName(profile.username, user.email);
  const avatarSeed = displayName || "player";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#050816" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text style={styles.header}>Profile</Text>

        {/* top card */}
        <View style={styles.card}>
          <View style={styles.topRow}>
            <Image
              source={{
                uri: `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(
                  avatarSeed
                )}`,
              }}
              style={styles.avatar}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.displayName}>{displayName}</Text>
              {profile.platform ? (
                <Text style={styles.platformText}>{profile.platform}</Text>
              ) : (
                <Text style={styles.platformTextMuted}>No platform set</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => setEditVisible(true)}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {profile.bio ? (
            <Text style={styles.bioText}>{profile.bio}</Text>
          ) : (
            <Text style={styles.bioTextMuted}>
              Add a short bio so people know what you play.
            </Text>
          )}
        </View>

        {/* stats */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{profile.clipCount}</Text>
              <Text style={styles.statLabel}>Clips</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{profile.lfgCount}</Text>
              <Text style={styles.statLabel}>LFG posts</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{profile.followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{profile.followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        {/* extra info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Favorite game</Text>
            <Text style={styles.infoValue}>
              {profile.favoriteGame || "Not set"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Region</Text>
            <Text style={styles.infoValue}>
              {profile.region || "Not set"}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Edit bottom sheet */}
      <BottomSheet
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        height={460}
      >
        <Text style={styles.sheetTitle}>Edit profile</Text>

        <TextInput
          style={styles.input}
          placeholder="Username (shown to others)"
          placeholderTextColor="#6b7280"
          value={editUsername}
          onChangeText={setEditUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Platform (PC, PS5, Xbox, etc.)"
          placeholderTextColor="#6b7280"
          value={editPlatform}
          onChangeText={setEditPlatform}
        />
        <TextInput
          style={styles.input}
          placeholder="Favorite game"
          placeholderTextColor="#6b7280"
          value={editFavoriteGame}
          onChangeText={setEditFavoriteGame}
        />
        <TextInput
          style={styles.input}
          placeholder="Region (e.g. NA East, EU)"
          placeholderTextColor="#6b7280"
          value={editRegion}
          onChangeText={setEditRegion}
        />
        <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="Short bio"
          placeholderTextColor="#6b7280"
          multiline
          value={editBio}
          onChangeText={setEditBio}
        />

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving..." : "Save profile"}
          </Text>
        </TouchableOpacity>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

// ---------- styles ----------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050816",
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  header: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#050816",
    justifyContent: "center",
    alignItems: "center",
  },
  centerText: {
    color: "#e5e7eb",
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#020617",
  },
  displayName: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  platformText: {
    color: "#9ca3af",
    marginTop: 2,
  },
  platformTextMuted: {
    color: "#6b7280",
    marginTop: 2,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  editBtnText: {
    color: "#22c55e",
    fontWeight: "600",
    fontSize: 13,
  },
  bioText: {
    color: "#e5e7eb",
    fontSize: 14,
  },
  bioTextMuted: {
    color: "#6b7280",
    fontSize: 14,
  },
  sectionTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#9ca3af",
    fontSize: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  infoLabel: {
    color: "#9ca3af",
    fontSize: 13,
  },
  infoValue: {
    color: "#e5e7eb",
    fontSize: 13,
  },
  // bottom sheet
  sheetTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#020617",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "white",
    marginBottom: 8,
    fontSize: 14,
  },
  saveBtn: {
    marginTop: 4,
    backgroundColor: "#22c55e",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#020617",
    fontWeight: "600",
    fontSize: 15,
  },
});
