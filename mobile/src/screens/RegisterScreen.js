import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { COLORS, SPACING } from '../theme/theme';
import { authApi, setAuthTokens } from '../utils/api';

export default function RegisterScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [fnFocused, setFnFocused] = useState(false);
  const [lnFocused, setLnFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password) {
      setErrorMsg('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const result = await authApi.register({
      firstName,
      lastName,
      email,
      password,
    });
    setLoading(false);

    if (result.success && result.data) {
      const { accessToken, refreshToken } = result.data;
      await setAuthTokens(accessToken, refreshToken);
      // New user starts on onboarding
      navigation.replace('Onboarding');
    } else {
      setErrorMsg(result.message || 'Registration failed. Try again.');
    }
  };

  const content = (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>LOCK<Text style={styles.logoAccent}>IN</Text></Text>
          <Text style={styles.subtitle}>Unlock accountability. Set up your account.</Text>
        </View>

        {errorMsg && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={styles.flexItem}>
              <Text style={styles.label}>FIRST NAME</Text>
              <TextInput
                style={[styles.input, fnFocused && styles.inputFocused]}
                placeholder="John"
                placeholderTextColor={COLORS.textMuted}
                value={firstName}
                onChangeText={setFirstName}
                onFocus={() => setFnFocused(true)}
                onBlur={() => setFnFocused(false)}
              />
            </View>

            <View style={[styles.flexItem, { marginLeft: SPACING.md }]}>
              <Text style={styles.label}>LAST NAME</Text>
              <TextInput
                style={[styles.input, lnFocused && styles.inputFocused]}
                placeholder="Doe"
                placeholderTextColor={COLORS.textMuted}
                value={lastName}
                onChangeText={setLastName}
                onFocus={() => setLnFocused(true)}
                onBlur={() => setLnFocused(false)}
              />
            </View>
          </View>

          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput
            style={[styles.input, emailFocused && styles.inputFocused]}
            placeholder="john.doe@example.com"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
          />

          <Text style={styles.label}>PASSWORD (MIN 8 CHARACTERS)</Text>
          <TextInput
            style={[styles.input, passFocused && styles.inputFocused]}
            placeholder="••••••••"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPassFocused(true)}
            onBlur={() => setPassFocused(false)}
          />

          <TouchableOpacity 
            style={styles.registerButton} 
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.registerButtonText}>CREATE ACCOUNT</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (Platform.OS === 'web') {
    return content;
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      {content}
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxl,
    justifyContent: 'center',
  },
  header: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1.5,
  },
  logoAccent: {
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  flexItem: {
    flex: 1,
  },
  errorContainer: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.accent,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  form: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    color: COLORS.text,
    fontSize: 16,
    marginBottom: SPACING.md,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceLight,
  },
  registerButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  registerButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  loginLink: {
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 14,
  },
});
