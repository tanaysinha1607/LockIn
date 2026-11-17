import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import BuddyScreen from './src/screens/BuddyScreen';
import AICoachScreen from './src/screens/AICoachScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatScreen from './src/screens/ChatScreen';
import SessionsScreen from './src/screens/SessionsScreen';
import ChallengesScreen from './src/screens/ChallengesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import { listenForPushTaps } from './src/utils/push';
import { routeForNotification, setPendingRoute } from './src/utils/notificationRoutes';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

// Screens where the user isn't signed in yet; a tapped push waits until Home
const PRE_AUTH_SCREENS = ['Splash', 'Login', 'Register', 'Onboarding'];

const openFromPush = (data) => {
  const route = routeForNotification(data?.type, data);
  if (!route) return;
  const current = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null;
  if (!current || PRE_AUTH_SCREENS.includes(current)) {
    setPendingRoute(route);
  } else {
    navigationRef.navigate(route.name, route.params);
  }
};

export default function App() {
  useEffect(() => listenForPushTaps(openFromPush), []);

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Buddy" component={BuddyScreen} />
        <Stack.Screen name="AICoach" component={AICoachScreen} />
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Sessions" component={SessionsScreen} />
        <Stack.Screen name="Challenges" component={ChallengesScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

