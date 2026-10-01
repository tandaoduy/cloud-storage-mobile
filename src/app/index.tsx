import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { getSession, login, logout, register, Session } from '@/services/auth';
import { UserDashboard } from '@/components/UserDashboard';

type Language = 'vi' | 'en';


type FormErrors = {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
};

const translations = {
  vi: {
    brandTitle: 'Cloud Storage',
    loginTitle: 'Đăng nhập',
    registerTitle: 'Đăng ký',
    nameLabel: 'Họ và tên',
    emailLabel: 'Email',
    passwordLabel: 'Mật khẩu',
    passwordRegisterLabel: 'Mật khẩu (ít nhất 8 ký tự)',
    confirmPasswordLabel: 'Xác nhận mật khẩu',
    forgotPassword: 'Quên mật khẩu?',
    forgotPasswordAlertTitle: 'Quên mật khẩu',
    forgotPasswordAlertMsg: 'Tính năng khôi phục mật khẩu qua email sẽ sớm có mặt.',
    loginButton: 'Đăng nhập',
    registerButton: 'Đăng ký',
    noAccountPrompt: 'Bạn chưa có tài khoản? ',
    registerLink: 'Đăng ký',
    backToLogin: 'Quay trở lại trang Đăng nhập',
    nameRequired: 'Vui lòng nhập họ và tên',
    emailRequired: 'Vui lòng nhập email',
    emailInvalid: 'Vui lòng nhập địa chỉ email hợp lệ',
    passwordRequired: 'Vui lòng nhập mật khẩu',
    passwordMinLength: 'Vui lòng nhập mật khẩu ít nhất 8 ký tự',
    confirmPasswordRequired: 'Vui lòng xác nhận mật khẩu',
    passwordMismatch: 'Mật khẩu xác nhận không khớp',
    emailAlreadyUsed: 'Email này đã được đăng ký tài khoản khác',
    invalidCredentials: 'Email hoặc mật khẩu không chính xác',
    serverError: 'Có lỗi xảy ra, vui lòng thử lại sau.',
    close: 'Đóng',
    logoutTitle: 'Đăng xuất',
    logoutConfirm: 'Bạn có chắc chắn muốn đăng xuất?',
    cancel: 'Hủy',
    storageUsed: 'Dung lượng đã dùng',
    exploreFiles: 'Khám phá tệp tin',
    logout: 'Đăng xuất',
  },
  en: {
    brandTitle: 'Cloud Storage',
    loginTitle: 'Sign In',
    registerTitle: 'Sign Up',
    nameLabel: 'Full name',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    passwordRegisterLabel: 'Password (at least 8 characters)',
    confirmPasswordLabel: 'Confirm password',
    forgotPassword: 'Forgot password?',
    forgotPasswordAlertTitle: 'Forgot Password',
    forgotPasswordAlertMsg: 'Password recovery via email will be available soon.',
    loginButton: 'Sign In',
    registerButton: 'Sign Up',
    noAccountPrompt: "Don't have an account? ",
    registerLink: 'Sign Up',
    backToLogin: 'Back to Sign In',
    nameRequired: 'Please enter your full name',
    emailRequired: 'Please enter your email',
    emailInvalid: 'Please enter a valid email address',
    passwordRequired: 'Please enter your password',
    passwordMinLength: 'Password must be at least 8 characters',
    confirmPasswordRequired: 'Please confirm your password',
    passwordMismatch: 'Passwords do not match',
    emailAlreadyUsed: 'This email is already registered',
    invalidCredentials: 'Invalid email or password',
    serverError: 'An error occurred, please try again.',
    close: 'Close',
    logoutTitle: 'Sign Out',
    logoutConfirm: 'Are you sure you want to sign out?',
    cancel: 'Cancel',
    storageUsed: 'Storage used',
    exploreFiles: 'Explore files',
    logout: 'Sign Out',
  },
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // Language state: 'vi' (default) or 'en'
  const [language, setLanguage] = useState<Language>('vi');
  const t = translations[language];

  const [isRegister, setIsRegister] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Field-level error messages
  const [errors, setErrors] = useState<FormErrors>({});

  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const activeSession = await getSession();
      setSession(activeSession);
    } catch {
      // ignore
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    // Session is read once from encrypted device storage when the app starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (session?.user.role === 'admin') {
      router.replace('/admin');
    }
  }, [session]);

  const switchMode = (toRegister: boolean) => {
    setIsRegister(toRegister);
    setErrors({});
  };

  const handleSubmit = async () => {
    setErrors({});

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanDisplayName = displayName.trim();

    const newErrors: FormErrors = {};

    if (isRegister && !cleanDisplayName) {
      newErrors.displayName = t.nameRequired;
    }

    if (!cleanEmail) {
      newErrors.email = t.emailRequired;
    } else if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      newErrors.email = t.emailInvalid;
    }

    if (!cleanPassword) {
      newErrors.password = t.passwordRequired;
    } else if (cleanPassword.length < 8) {
      newErrors.password = t.passwordMinLength;
    }

    if (isRegister) {
      if (!confirmPassword.trim()) {
        newErrors.confirmPassword = t.confirmPasswordRequired;
      } else if (cleanPassword !== confirmPassword.trim()) {
        newErrors.confirmPassword = t.passwordMismatch;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const resultSession = isRegister
        ? await register(cleanEmail, cleanPassword, cleanDisplayName)
        : await login(cleanEmail, cleanPassword);

      setSession(resultSession);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t.serverError;
      if (message.toLowerCase().includes('email đã được sử dụng') || message.toLowerCase().includes('already registered')) {
        setErrors({ email: t.emailAlreadyUsed });
      } else if (message.toLowerCase().includes('email hoặc mật khẩu không đúng') || message.toLowerCase().includes('invalid')) {
        setErrors({ general: t.invalidCredentials });
      } else {
        setErrors({ general: message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t.logoutTitle, t.logoutConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.logout,
        style: 'destructive',
        onPress: async () => {
          await logout();
          setSession(null);
          setErrors({});
        },
      },
    ]);
  };

  const handleForgotPassword = () => {
    Alert.alert(t.forgotPasswordAlertTitle, t.forgotPasswordAlertMsg, [
      { text: t.close },
    ]);
  };

  // Harmonious theme colors with system blue overlay
  const bgMain = isDark ? '#0A1326' : '#F6F8FC';
  const bgGradientColors: readonly [string, string, ...string[]] = isDark
    ? ['#0A152A', '#0E2246', '#0A1733', '#060B16']
    : ['#EEF6FF', '#E0F0FE', '#F1F6FD', '#F8FAFC'];
  const cardBg = isDark ? 'rgba(15, 26, 48, 0.88)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(59, 130, 246, 0.24)' : 'rgba(219, 234, 254, 0.9)';
  const inputBg = isDark ? 'rgba(10, 18, 34, 0.85)' : '#F8FAFC';
  const inputBorder = isDark ? 'rgba(59, 130, 246, 0.22)' : '#D1D5DB';
  const inputBorderFocus = '#3B82F6';
  const inputBorderError = '#EF4444';
  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#64748B';
  const labelColor = isDark ? '#CBD5E1' : '#334155';

  if (isLoadingSession) {
    return (
      <View style={[styles.centered, { backgroundColor: bgMain }]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  // Logged-in user dashboard
  if (session) {
    return (
      <SafeAreaView style={[styles.dashboardSafeArea, { backgroundColor: bgMain }]} edges={['top', 'left', 'right']}>
        <UserDashboard
          session={session}
          language={language}
          setLanguage={setLanguage}
          onLogout={handleLogout}
        />
      </SafeAreaView>
    );
  }



  // Unified Single-Frame Login / Register View
  return (
    <LinearGradient
      colors={bgGradientColors}
      locations={isDark ? [0, 0.35, 0.7, 1] : [0, 0.3, 0.7, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.container}>
      {/* Decorative ambient glowing lights for depth */}
      <View style={styles.ambientBackgroundContainer} pointerEvents="none">
        <LinearGradient
          colors={
            isDark
              ? ['rgba(37, 99, 235, 0.28)', 'rgba(30, 64, 175, 0.05)', 'transparent']
              : ['rgba(56, 189, 248, 0.25)', 'rgba(37, 99, 235, 0.06)', 'transparent']
          }
          style={styles.ambientOrbTop}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={
            isDark
              ? ['rgba(14, 165, 233, 0.2)', 'rgba(37, 99, 235, 0.04)', 'transparent']
              : ['rgba(96, 165, 250, 0.2)', 'rgba(147, 197, 253, 0.05)', 'transparent']
          }
          style={styles.ambientOrbBottom}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0, y: 0 }}
        />
        <View
          style={[
            styles.ambientOrbCenter,
            {
              backgroundColor: isDark
                ? 'rgba(59, 130, 246, 0.08)'
                : 'rgba(37, 99, 235, 0.05)',
            },
          ]}
        />
      </View>
      <SafeAreaView style={styles.safeArea}>
        {/* Top Bar with Language Selector */}
        <View style={styles.topBar}>
          <View style={[styles.langToggle, { backgroundColor: isDark ? '#131B2A' : '#EAEFF5', borderColor: cardBorder }]}>
            <Pressable
              onPress={() => setLanguage('vi')}
              style={[styles.langBtn, language === 'vi' && [styles.langBtnActive, { backgroundColor: isDark ? '#222F46' : '#FFFFFF' }]]}>
              <Text style={styles.flagIcon}>🇻🇳</Text>
              <Text style={[styles.langText, { color: textColor }, language === 'vi' && styles.langTextActive]}>VI</Text>
            </Pressable>
            <Pressable
              onPress={() => setLanguage('en')}
              style={[styles.langBtn, language === 'en' && [styles.langBtnActive, { backgroundColor: isDark ? '#222F46' : '#FFFFFF' }]]}>
              <Text style={styles.flagIcon}>🇬🇧</Text>
              <Text style={[styles.langText, { color: textColor }, language === 'en' && styles.langTextActive]}>EN</Text>
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                flexGrow: 1,
                justifyContent: 'center',
                paddingBottom: insets.bottom + 20,
                paddingTop: 10,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Header: Logo & App Title */}
            <View style={styles.brandHeader}>
              <View style={styles.logoContainer}>
                <View style={styles.logoAmbientGlow} />
                <LinearGradient
                  colors={['#38BDF8', '#2563EB', '#1D4ED8']}
                  style={styles.logoBadge}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}>
                  <Ionicons name="cloud" size={42} color="#FFFFFF" />
                  <View style={styles.uploadBadge}>
                    <Ionicons name="arrow-up" size={11} color="#2563EB" />
                  </View>
                </LinearGradient>
              </View>
              <Text style={[styles.brandTitle, { color: textColor }]}>{t.brandTitle}</Text>
            </View>

            {/* Single Form Frame */}
            <View
              style={[
                styles.card,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}>
              {/* CĂN GIỮA FORM cho tiêu đề Đăng nhập / Đăng ký */}
              <Text style={[styles.cardTitle, { color: textColor }]}>
                {isRegister ? t.registerTitle : t.loginTitle}
              </Text>

              {/* Field: Họ và tên (chỉ khi đăng ký) */}
              {isRegister ? (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: labelColor }]}>{t.nameLabel}</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: inputBg,
                        borderColor: errors.displayName
                          ? inputBorderError
                          : focusedField === 'name'
                          ? inputBorderFocus
                          : inputBorder,
                      },
                    ]}>
                    <TextInput
                      value={displayName}
                      onChangeText={(val) => {
                        setDisplayName(val);
                        if (errors.displayName) {
                          setErrors((prev) => ({ ...prev, displayName: undefined }));
                        }
                      }}
                      placeholder=""
                      autoCapitalize="words"
                      autoCorrect={false}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.textInput, { color: textColor }]}
                    />
                  </View>
                  {errors.displayName ? (
                    <Text style={styles.errorText}>{errors.displayName}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* Field: Email */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: labelColor }]}>{t.emailLabel}</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: inputBg,
                      borderColor: errors.email
                        ? inputBorderError
                        : focusedField === 'email'
                        ? inputBorderFocus
                        : inputBorder,
                    },
                  ]}>
                  <TextInput
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (errors.email) {
                        setErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    placeholder=""
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    style={[styles.textInput, { color: textColor }]}
                  />
                </View>
                {errors.email ? (
                  <Text style={styles.errorText}>{errors.email}</Text>
                ) : null}
              </View>

              {/* Field: Mật khẩu */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: labelColor }]}>
                  {isRegister ? t.passwordRegisterLabel : t.passwordLabel}
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: inputBg,
                      borderColor: errors.password
                        ? inputBorderError
                        : focusedField === 'password'
                        ? inputBorderFocus
                        : inputBorder,
                    },
                  ]}>
                  <TextInput
                    value={password}
                    onChangeText={(val) => {
                      setPassword(val);
                      if (errors.password) {
                        setErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    placeholder=""
                    secureTextEntry={!showPassword}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    style={[styles.textInput, { color: textColor }]}
                  />
                  {password.length > 0 ? (
                    <Pressable
                      hitSlop={12}
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={textMuted}
                      />
                    </Pressable>
                  ) : null}
                </View>
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : null}
              </View>

              {/* Field: Xác nhận mật khẩu (chỉ khi đăng ký) */}
              {isRegister ? (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: labelColor }]}>{t.confirmPasswordLabel}</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: inputBg,
                        borderColor: errors.confirmPassword
                          ? inputBorderError
                          : focusedField === 'confirm'
                          ? inputBorderFocus
                          : inputBorder,
                      },
                    ]}>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={(val) => {
                        setConfirmPassword(val);
                        if (errors.confirmPassword) {
                          setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                        }
                      }}
                      placeholder=""
                      secureTextEntry={!showConfirmPassword}
                      onFocus={() => setFocusedField('confirm')}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.textInput, { color: textColor }]}
                    />
                    {confirmPassword.length > 0 ? (
                      <Pressable
                        hitSlop={12}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeButton}>
                        <Ionicons
                          name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color={textMuted}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                  {errors.confirmPassword ? (
                    <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* Quên mật khẩu link - chỉ hiển thị ở chế độ đăng nhập */}
              {!isRegister ? (
                <Pressable onPress={handleForgotPassword} style={styles.forgotRow}>
                  <Text style={styles.forgotText}>{t.forgotPassword}</Text>
                </Pressable>
              ) : null}

              {/* General error message (nếu có từ server) */}
              {errors.general ? (
                <View style={styles.generalErrorRow}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.generalErrorText}>{errors.general}</Text>
                </View>
              ) : null}

              {/* Submit Button */}
              <Pressable
                disabled={isSubmitting}
                onPress={() => void handleSubmit()}
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}>
                <LinearGradient
                  colors={isSubmitting ? ['#93C5FD', '#60A5FA'] : ['#2563EB', '#1D4ED8']}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {isRegister ? t.registerButton : t.loginButton}
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>

              {/* Chuyển đổi Đăng nhập / Đăng ký lồng trực tiếp vào trong form */}
              <View style={styles.switchRow}>
                {isRegister ? (
                  <Pressable
                    onPress={() => switchMode(false)}
                    hitSlop={8}
                    style={styles.backButton}>
                    <Ionicons name="arrow-back" size={16} color="#2563EB" />
                    <Text style={styles.backButtonText}>{t.backToLogin}</Text>
                  </Pressable>
                ) : (
                  <View style={styles.loginSwitchRow}>
                    <Text style={[styles.switchPrompt, { color: textMuted }]}>
                      {t.noAccountPrompt}
                    </Text>
                    <Pressable onPress={() => switchMode(true)} hitSlop={8}>
                      <Text style={styles.switchLink}>{t.registerLink}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  dashboardSafeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  ambientBackgroundContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  ambientOrbTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  ambientOrbCenter: {
    position: 'absolute',
    top: '25%',
    left: '12%',
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Top Bar Language Switcher
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 4,
    zIndex: 10,
  },
  langToggle: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 5,
  },
  langBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  flagIcon: {
    fontSize: 16,
  },
  langText: {
    fontSize: 12,
    fontWeight: '600',
  },
  langTextActive: {
    fontWeight: '800',
  },

  // Brand Header
  brandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoAmbientGlow: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#38BDF8',
    opacity: 0.22,
  },
  logoBadge: {
    width: 74,
    height: 74,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  uploadBadge: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  brandTitle: {
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // Single Card Frame
  card: {
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    gap: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 2,
    textAlign: 'center', // CĂN GIỮA TIÊU ĐỀ THEO YÊU CẦU
  },

  // Fields with Labels
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.3,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 12,
  },
  eyeButton: {
    padding: 6,
    marginLeft: 6,
  },

  // Field inline error text
  errorText: {
    fontSize: 12.5,
    color: '#DC2626',
    fontWeight: '500',
    marginLeft: 4,
    marginTop: 2,
  },

  // General error (server message)
  generalErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  generalErrorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },

  // Forgot password
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },

  // Submit Button
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14.5,
    paddingHorizontal: 20,
    gap: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Switch Link nested inside form
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 6,
  },
  loginSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchPrompt: {
    fontSize: 14,
    fontWeight: '500',
  },
  switchLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },

  // User Profile (Logged in)
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 13,
  },
  quotaBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quotaLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  quotaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  progressBarBg: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  logoutButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
});
