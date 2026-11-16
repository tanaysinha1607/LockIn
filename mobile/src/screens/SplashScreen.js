import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { COLORS, SPACING } from '../theme/theme';
import { initializeAuthTokens, userApi } from '../utils/api';
import { connectSocket } from '../utils/socket';

export default function SplashScreen({ navigation }) {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.9);

  useEffect(() => {
    // Logo entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    // Check authentication status
    const checkAuth = async () => {
      // Simulate splash display for a premium feel
      const minDisplayTime = new Promise((resolve) => setTimeout(resolve, 2000));
      const authPromise = initializeAuthTokens();

      const [token] = await Promise.all([authPromise, minDisplayTime]);

      if (token) {
        connectSocket(token);
        // Verify token by calling /users/me
        const result = await userApi.getMe();
        if (result.success && result.data) {
          const { user } = result.data;
          if (user.isOnboarded) {
            navigation.replace('Home');
          } else {
            navigation.replace('Onboarding');
          }
          return;
        }
      }
      
      // Not authenticated or token invalid
      navigation.replace('Login');
    };

    checkAuth();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.logoText}>LOCK<Text style={styles.logoAccent}>IN</Text></Text>
        <Text style={styles.tagline}>AI Gym Accountability & Social Matching</Text>
      </Animated.View>
      
      <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 2,
  },
  logoAccent: {
    color: COLORS.primary,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    letterSpacing: 0.5,
  },
  loader: {
    position: 'absolute',
    bottom: 80,
  },
});
