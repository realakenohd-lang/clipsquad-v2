// src/screens/FeedScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
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
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove,
  getDoc,
  getDocs,
  where,
  setDoc,
} from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import BottomSheet from "../components/BottomSheet";

type Clip = {
  id: string;
  title: string;
  game: string;
  thumbnail?: string;
  user?: string;   // safe display name only
  userId?: string;
  createdAt?: any;
  likedBy: string[];
};

type Comment = {
  id: string;
  userId: string;
  username: string; // safe display name only
  text: string;
  createdAt?: any;
};

type PublicUserProfile = {
  userId: string;
  username: string;
  platform: string;
  clipCount: number;
  lfgCount: number;
  isFollowing: boolean;
};

// ---- helpers --------------------------------------------------

// never show full emails as a display name
const getSafeDisplayName = (rawUser?: string, username?: string): string => {
  // pick a candidate from username or old "user" field
  let candidate = (username || rawUser || "").trim();

  if (!candidate) return "player";

  // if it looks like an email, mask it (show only the part before "@")
  if (candidate.includes("@")) {
    const beforeAt = candidate.split("@")[0].trim();
    if (beforeAt.length >= 3) {
      return beforeAt; // e.g. "luisky720@gmail.com" → "luisky720"
    }
    return "player";
  }

  return candidate;
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

// ----------------------------------------------------------------

export default function FeedScreen() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [game, setGame] = useState("");
  const [title, setTitle] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [posting, setPosting] = useState(false);

  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [commentSending, setCommentSending] = useState(false);

  const [userModalVisible, setUserModalVisible] = useState(false);
  const [userModalLoading, setUserModalLoading] = useState(false);
  const [userModalProfile, setUserModalProfile] =
    useState<PublicUserProfile | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);

  const user = auth.currentUser;

  // Listen to clips in real time
  useEffect(() => {
    const q = query(collection(db, "clips"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const data: Clip[] = snap.docs.map((docSnap) => {
        const d = docSnap.data() as any;

        // prefer username field, then fall back to old user / userEmail
        const safeName = getSafeDisplayName(
          d.user,
          d.username ?? d.userEmail
        );

        return {
          id: docSnap.id,
          title: d.title ?? "",
          game: d.game ?? "",
          thumbnail: d.thumbnail,
          user: safeName || "player",
          userId: d.userId,
          createdAt: d.createdAt,
          likedBy: Array.isArray(d.likedBy) ? d.likedBy : [],
        };
      });
      setClips(data);
    });

    return unsub;
  }, []);

  // create clip --------------------------------------------------

  const handlePost = async () => {
    if (!game || !title) {
      Alert.alert("Missing info", "Game and title are required.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Not logged in", "You must be logged in to post.");
      return;
    }

    const finalThumbnail =
      thumbnail.trim() ||
      "https://placehold.co/600x400/111827/FFFFFF?text=No+Thumbnail";

    // figure out a safe display name to store for this post
    let displayName: string | undefined;

    try {
      const meRef = doc(db, "users", currentUser.uid);
      const meSnap = await getDoc(meRef);
      if (meSnap.exists()) {
        const data = meSnap.data() as any;
        if (data.username) {
          displayName = getSafeDisplayName(undefined, String(data.username));
        }
      }
    } catch (e) {
      console.log("Could not fetch profile for post display name.");
    }

    const safeDisplayName = getSafeDisplayName(
      displayName,
      currentUser.email ?? currentUser.uid
    );

    try {
      setPosting(true);
      await addDoc(collection(db, "clips"), {
        title: title.trim(),
        game: game.trim(),
        thumbnail: finalThumbnail,
        user: safeDisplayName,        // <- safe, no email
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
        likedBy: [],
      });

      setGame("");
      setTitle("");
      setThumbnail("");
      setCreateVisible(false); // close sheet after posting
    } catch (err: any) {
      console.log("Post error", err);
      Alert.alert("Error", err.message || "Could not post clip.");
    } finally {
      setPosting(false);
    }
  };

  // likes --------------------------------------------------------

  const toggleLike = async (clip: Clip) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Not logged in", "You must be logged in to like clips.");
      return;
    }

    try {
      const ref = doc(db, "clips", clip.id);
      const alreadyLiked = clip.likedBy.includes(currentUser.uid);

      await updateDoc(ref, {
        likedBy: alreadyLiked
          ? arrayRemove(currentUser.uid)
          : arrayUnion(currentUser.uid),
      });
    } catch (err) {
      console.log("Like error", err);
    }
  };

  // comments -----------------------------------------------------

  const loadCommentsForClip = async (clipId: string) => {
    try {
      setCommentsLoading(true);
      setComments([]);

      const commentsRef = collection(db, "clips", clipId, "comments");
      const q = query(commentsRef, orderBy("createdAt", "asc"));
      const snap = await getDocs(q);

      const data: Comment[] = snap.docs.map((d) => {
        const c = d.data() as any;

        const safeName = getSafeDisplayName(
          undefined,
          c.username ?? c.userEmail
        );

        return {
          id: d.id,
          userId: c.userId,
          username: safeName || "player",
          text: c.text,
          createdAt: c.createdAt,
        };
      });

      setComments(data);
    } catch (err) {
      console.log("Error loading comments", err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleOpenClip = (clip: Clip) => {
    setSelectedClip(clip);
    setCommentInput("");
    loadCommentsForClip(clip.id);
  };

  const handleSendComment = async () => {
    const text = commentInput.trim();
    if (!text || !selectedClip) return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Not logged in", "You must be logged in to comment.");
      return;
    }

    try {
      setCommentSending(true);

      let profileName: string | undefined;

      try {
        const ref = doc(db, "users", currentUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data.username) profileName = String(data.username);
        }
      } catch (e) {
        console.log("Could not fetch profile for comment, using email.");
      }

      const safeName = getSafeDisplayName(
        undefined,
        profileName ?? currentUser.email ?? currentUser.uid
      );

      const commentsRef = collection(db, "clips", selectedClip.id, "comments");

      await addDoc(commentsRef, {
        userId: currentUser.uid,
        userEmail: currentUser.email, // can still be stored, but not shown
        username: safeName,
        text,
        createdAt: serverTimestamp(),
      });

      // Optimistic update
      setComments((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          userId: currentUser.uid,
          username: safeName,
          text,
          createdAt: new Date(),
        },
      ]);

      setCommentInput("");
    } catch (err) {
      console.log("Error sending comment", err);
    } finally {
      setCommentSending(false);
    }
  };

  // user profile bottom sheet ------------------------------------

  const openUserProfileModal = async (userId?: string) => {
    if (!userId) {
      Alert.alert("Unavailable", "User information not available for this clip.");
      return;
    }

    setUserModalVisible(true);
    setUserModalLoading(true);
    setUserModalProfile(null);

    try {
      // target user
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      let username = "Unknown player";
      let platform = "Unknown platform";

      if (userSnap.exists()) {
        const data = userSnap.data() as any;
        if (data.username) {
          username = getSafeDisplayName(undefined, String(data.username));
        }
        if (data.platform) platform = String(data.platform);
      }

      // their stats
      const clipsQ = query(
        collection(db, "clips"),
        where("userId", "==", userId)
      );
      const clipsSnap = await getDocs(clipsQ);
      const clipCount = clipsSnap.size;

      const lfgQ = query(
        collection(db, "lfgPosts"),
        where("userId", "==", userId)
      );
      const lfgSnap = await getDocs(lfgQ);
      const lfgCount = lfgSnap.size;

      // is current user following them?
      let isFollowing = false;
      const currentUser = auth.currentUser;
      if (currentUser) {
        const meRef = doc(db, "users", currentUser.uid);
        const meSnap = await getDoc(meRef);
        if (meSnap.exists()) {
          const meData = meSnap.data() as any;
          const following: string[] = Array.isArray(meData.following)
            ? meData.following
            : [];
          isFollowing = following.includes(userId);
        }
      }

      setUserModalProfile({
        userId,
        username,
        platform,
        clipCount,
        lfgCount,
        isFollowing,
      });
    } catch (err) {
      console.log("Error loading user profile", err);
    } finally {
      setUserModalLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !userModalProfile) return;
    if (currentUser.uid === userModalProfile.userId) return; // can't follow self

    try {
      setFollowBusy(true);

      const meRef = doc(db, "users", currentUser.uid);
      const targetRef = doc(db, "users", userModalProfile.userId);

      const newIsFollowing = !userModalProfile.isFollowing;

      // ensure docs exist
      await setDoc(meRef, {}, { merge: true });
      await setDoc(targetRef, {}, { merge: true });

      // update my "following"
      await updateDoc(meRef, {
        following: newIsFollowing
          ? arrayUnion(userModalProfile.userId)
          : arrayRemove(userModalProfile.userId),
      });

      // update their "followers"
      await updateDoc(targetRef, {
        followers: newIsFollowing
          ? arrayUnion(currentUser.uid)
          : arrayRemove(currentUser.uid),
      });

      setUserModalProfile((prev) =>
        prev ? { ...prev, isFollowing: newIsFollowing } : prev
      );
    } catch (err) {
      console.log("Follow error", err);
    } finally {
      setFollowBusy(false);
    }
  };

  const closeClipModal = () => {
    setSelectedClip(null);
    setComments([]);
    setCommentInput("");
  };

  const avatarSeed = userModalProfile?.username || "player";

  // list item ----------------------------------------------------

  const renderItem = ({ item }: { item: Clip }) => {
    const createdText = formatTimeAgo(item.createdAt);
    const isLiked =
      user && item.likedBy && item.likedBy.includes(user.uid || "");
    const likesCount = item.likedBy.length;
    const thumbUri =
      item.thumbnail ||
      "https://placehold.co/600x400/111827/FFFFFF?text=No+Thumbnail";

    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => handleOpenClip(item)}>
        <View style={styles.card}>
          <Image source={{ uri: thumbUri }} style={styles.thumb} />
          <View style={styles.cardBody}>
            <View style={styles.cardHeader}>
              <Text style={styles.game}>{item.game}</Text>
              {createdText ? (
                <Text style={styles.time}>{createdText}</Text>
              ) : null}
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <View style={styles.cardFooter}>
              <TouchableOpacity onPress={() => openUserProfileModal(item.userId)}>
                <Text style={styles.user}>@{item.user || "player"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.likeRow}
                onPress={() => toggleLike(item)}
              >
                <Text
                  style={[
                    styles.heart,
                    isLiked && { color: "#f97316" },
                  ]}
                >
                  {isLiked ? "♥" : "♡"}
                </Text>
                <Text style={styles.likesText}>{likesCount}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // render -------------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#050816" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Feed</Text>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => setCreateVisible(true)}
          >
            <Text style={styles.newBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Clips list */}
        <FlatList
          data={clips}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No clips yet. Be the first!</Text>
          }
        />

        {/* Bottom sheet: create post */}
        <BottomSheet
          visible={createVisible}
          onClose={() => setCreateVisible(false)}
          height={420}
        >
          <Text style={styles.sheetTitle}>Post a clip</Text>

          <TextInput
            style={styles.input}
            placeholder="Game (e.g. Warzone)"
            placeholderTextColor="#6b7280"
            value={game}
            onChangeText={setGame}
          />
          <TextInput
            style={styles.input}
            placeholder="Title (e.g. 1v4 clutch)"
            placeholderTextColor="#6b7280"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Thumbnail URL (image link)"
            placeholderTextColor="#6b7280"
            value={thumbnail}
            onChangeText={setThumbnail}
          />

          <TouchableOpacity
            style={[styles.postBtn, posting && { opacity: 0.7 }]}
            onPress={handlePost}
            disabled={posting}
          >
            <Text style={styles.postBtnText}>
              {posting ? "Posting..." : "Post clip"}
            </Text>
          </TouchableOpacity>
        </BottomSheet>

        {/* Bottom sheet: clip fullscreen + comments */}
        <BottomSheet
          visible={!!selectedClip}
          onClose={closeClipModal}
          height={560}
        >
          {selectedClip ? (
            <ScrollView
              style={{ width: "100%" }}
              contentContainerStyle={{ alignItems: "center" }}
            >
              <Image
                source={{
                  uri:
                    selectedClip.thumbnail ||
                    "https://placehold.co/600x400/111827/FFFFFF?text=No+Thumbnail",
                }}
                style={styles.fullImage}
                resizeMode="contain"
              />
              <View style={styles.modalTextArea}>
                <Text style={styles.modalGame}>{selectedClip.game}</Text>
                <Text style={styles.modalTitle}>{selectedClip.title}</Text>
                <Text style={styles.modalUser}>
                  @{selectedClip.user || "player"}
                </Text>
              </View>

              <View style={styles.commentsSection}>
                <Text style={styles.commentsTitle}>Comments</Text>

                {commentsLoading ? (
                  <ActivityIndicator size="small" color="#22c55e" />
                ) : comments.length === 0 ? (
                  <Text style={styles.noCommentsText}>
                    No comments yet. Be the first to comment.
                  </Text>
                ) : (
                  comments.map((c) => {
                    const time = formatTimeAgo(c.createdAt);
                    return (
                      <View key={c.id} style={styles.commentRow}>
                        <Text style={styles.commentUser}>
                          @{c.username}
                          {time ? (
                            <Text style={styles.commentTime}> · {time}</Text>
                          ) : null}
                        </Text>
                        <Text style={styles.commentText}>{c.text}</Text>
                      </View>
                    );
                  })
                )}

                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Add a comment..."
                    placeholderTextColor="#6b7280"
                    value={commentInput}
                    onChangeText={setCommentInput}
                  />
                  <TouchableOpacity
                    style={[
                      styles.commentSendBtn,
                      (commentSending || !commentInput.trim()) && {
                        opacity: 0.6,
                      },
                    ]}
                    onPress={handleSendComment}
                    disabled={commentSending || !commentInput.trim()}
                  >
                    <Text style={styles.commentSendText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          ) : (
            <ActivityIndicator size="large" color="#22c55e" />
          )}
        </BottomSheet>

        {/* Bottom sheet: user profile */}
        <BottomSheet
          visible={userModalVisible}
          onClose={() => setUserModalVisible(false)}
          height={400}
        >
          {userModalLoading ? (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <ActivityIndicator size="large" color="#22c55e" />
            </View>
          ) : userModalProfile ? (
            <View style={styles.userModalContentInner}>
              <Image
                source={{
                  uri: `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(
                    avatarSeed
                  )}`,
                }}
                style={styles.userAvatar}
              />
              <Text style={styles.userModalName}>
                {userModalProfile.username}
              </Text>
              <Text style={styles.userModalPlatform}>
                {userModalProfile.platform || "No platform set"}
              </Text>

              <View style={styles.userStatsRow}>
                <View style={styles.userStatBox}>
                  <Text style={styles.userStatNumber}>
                    {userModalProfile.clipCount}
                  </Text>
                  <Text style={styles.userStatLabel}>Clips</Text>
                </View>
                <View style={styles.userStatBox}>
                  <Text style={styles.userStatNumber}>
                    {userModalProfile.lfgCount}
                  </Text>
                  <Text style={styles.userStatLabel}>LFG Posts</Text>
                </View>
              </View>

              {user &&
                user.uid !== userModalProfile.userId && (
                  <TouchableOpacity
                    style={[
                      styles.followBtn,
                      userModalProfile.isFollowing && styles.followBtnActive,
                      followBusy && { opacity: 0.6 },
                    ]}
                    onPress={handleToggleFollow}
                    disabled={followBusy}
                  >
                    <Text
                      style={[
                        styles.followBtnText,
                        userModalProfile.isFollowing &&
                          styles.followBtnTextActive,
                      ]}
                    >
                      {userModalProfile.isFollowing ? "Following" : "Follow"}
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={{ color: "white", textAlign: "center" }}>
                Could not load user profile.
              </Text>
            </View>
          )}
        </BottomSheet>
      </View>
    </KeyboardAvoidingView>
  );
}

// ----------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050816",
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  header: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
  },
  newBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#22c55e",
  },
  newBtnText: {
    color: "#020617",
    fontWeight: "600",
    fontSize: 13,
  },
  sheetTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#020617",
    borderRadius: 8,
    padding: 10,
    color: "white",
    marginBottom: 8,
    fontSize: 14,
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
    marginBottom: 14,
    overflow: "hidden",
  },
  thumb: {
    width: "100%",
    height: 140,
    resizeMode: "contain",
    backgroundColor: "#020617",
  },
  cardBody: {
    padding: 12,
  },
  cardHeader: {
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
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  user: {
    color: "#93c5fd",
    textDecorationLine: "underline",
  },
  likeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heart: {
    fontSize: 18,
    color: "#6b7280",
    marginRight: 4,
  },
  likesText: {
    color: "#9ca3af",
    fontSize: 13,
  },
  empty: {
    color: "#6b7280",
    textAlign: "center",
    marginTop: 20,
  },
  fullImage: {
    width: "100%",
    height: 220,
    resizeMode: "contain",
    backgroundColor: "black",
    borderRadius: 12,
  },
  modalTextArea: {
    marginTop: 10,
    alignItems: "center",
  },
  modalGame: {
    color: "#9ca3af",
    fontSize: 14,
  },
  modalTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  modalUser: {
    color: "#9ca3af",
    marginTop: 4,
  },
  commentsSection: {
    marginTop: 16,
    width: "100%",
  },
  commentsTitle: {
    color: "white",
    fontWeight: "600",
    marginBottom: 8,
  },
  noCommentsText: {
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 8,
  },
  commentRow: {
    marginBottom: 8,
  },
  commentUser: {
    color: "#e5e7eb",
    fontSize: 13,
    marginBottom: 2,
  },
  commentTime: {
    color: "#6b7280",
    fontSize: 11,
  },
  commentText: {
    color: "#d1d5db",
    fontSize: 13,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#020617",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "white",
    fontSize: 13,
  },
  commentSendBtn: {
    marginLeft: 8,
    backgroundColor: "#22c55e",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  commentSendText: {
    color: "#050816",
    fontWeight: "600",
    fontSize: 13,
  },

  // user bottom sheet inner
  userModalContentInner: {
    flex: 1,
    alignItems: "center",
  },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  userModalName: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 4,
  },
  userModalPlatform: {
    color: "#9ca3af",
    marginTop: 2,
    marginBottom: 10,
  },
  userStatsRow: {
    flexDirection: "row",
    marginTop: 10,
    marginBottom: 10,
  },
  userStatBox: {
    alignItems: "center",
    marginHorizontal: 12,
  },
  userStatNumber: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  userStatLabel: {
    color: "#9ca3af",
    fontSize: 12,
  },
  followBtn: {
    marginTop: 10,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  followBtnActive: {
    backgroundColor: "#22c55e",
  },
  followBtnText: {
    color: "#22c55e",
    fontWeight: "600",
  },
  followBtnTextActive: {
    color: "#050816",
  },
});
