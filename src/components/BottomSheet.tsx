import React from "react";
import { View, StyleSheet } from "react-native";
import Modal from "react-native-modal";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number;
};

export default function BottomSheet({ visible, onClose, children, height = 420 }: Props) {
  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      style={styles.modal}
      backdropOpacity={0.5}
    >
      <View style={[styles.sheet, { height }]}>
        <View style={styles.grabber} />
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  sheet: {
    backgroundColor: "#111827",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  grabber: {
    width: 50,
    height: 5,
    backgroundColor: "#444",
    alignSelf: "center",
    borderRadius: 5,
    marginBottom: 12,
  },
});
