import React, { useRef, useEffect } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function Toast({ visible, message, type = 'success' }) {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 50,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const bgColor = type === 'error' ? colors.redGlobal : colors.greenGlobal;
  const icon = type === 'error' ? 'alert-circle' : 'checkmark-circle';

  return (
    <Animated.View style={[styles.toastContainer, { transform: [{ translateY }], backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={20} color="white" />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute', top: 0, left: 20, right: 20, zIndex: 9999,
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, gap: 8,
  },
  toastText: { color: 'white', fontWeight: 'bold', fontSize: 14, flex: 1 },
});
