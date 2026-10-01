import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { changePassword, removeAvatar, updateProfile, uploadAvatar, type User } from '@/services/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  visible: boolean;
  user: User;
  onClose: () => void;
  onUserUpdated: (user: User) => void;
  language: 'vi' | 'en';
};

type FormErrors = {
  displayName?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export function AccountSettingsModal(props: Props) {
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={props.onClose}>
      {props.visible ? <AccountSettingsContent {...props} /> : null}
    </Modal>
  );
}

function AccountSettingsContent({ user, onClose, onUserUpdated, language }: Props) {
  const vi = language === 'vi';
  const isDark = useColorScheme() === 'dark';
  const colors = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    surface: isDark ? '#1E293B' : '#FFFFFF',
    border: isDark ? '#334155' : '#E2E8F0',
    text: isDark ? '#F8FAFC' : '#0F172A',
    muted: isDark ? '#94A3B8' : '#64748B',
    input: isDark ? '#131B2A' : '#FFFFFF',
  };
  const [displayName, setDisplayName] = useState(user.display_name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert(vi ? 'Không thể cập nhật' : 'Update failed', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const chooseAvatar = () =>
    run(async () => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error(vi ? 'Cần cấp quyền thư viện ảnh để chọn ảnh đại diện.' : 'Photo-library permission is required.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        throw new Error(vi ? 'Ảnh đại diện không được vượt quá 5 MB.' : 'Avatar must not exceed 5 MB.');
      }
      setAvatarLoading(true);
      try {
        const updated = await uploadAvatar(asset);
        onUserUpdated(updated);
      } finally {
        setAvatarLoading(false);
      }
    });

  const saveSettings = async () => {
    const newErrors: FormErrors = {};

    if (!displayName.trim()) {
      newErrors.displayName = vi ? 'Vui lòng nhập họ và tên hiển thị.' : 'Please enter your display name.';
    }

    const passwordFieldsStarted = Boolean(currentPassword || newPassword || confirmPassword);
    if (passwordFieldsStarted) {
      if (!currentPassword) {
        newErrors.currentPassword = vi ? 'Vui lòng nhập mật khẩu hiện tại.' : 'Please enter your current password.';
      }
      if (!newPassword) {
        newErrors.newPassword = vi ? 'Vui lòng nhập mật khẩu mới.' : 'Please enter a new password.';
      } else if (newPassword.length < 8) {
        newErrors.newPassword = vi ? 'Mật khẩu mới phải có ít nhất 8 ký tự.' : 'New password must have at least 8 characters.';
      }
      if (!confirmPassword) {
        newErrors.confirmPassword = vi ? 'Vui lòng xác nhận mật khẩu mới.' : 'Please confirm your new password.';
      } else if (newPassword && confirmPassword && newPassword !== confirmPassword) {
        newErrors.confirmPassword = vi ? 'Mật khẩu xác nhận không khớp.' : 'Passwords do not match.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setBusy(true);

    try {
      if (displayName.trim() !== user.display_name) {
        const updated = await updateProfile(displayName.trim());
        onUserUpdated(updated);
      }
      if (passwordFieldsStarted) {
        await changePassword(currentPassword, newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
      Alert.alert(
        vi ? 'Đã lưu' : 'Saved',
        passwordFieldsStarted
          ? vi
            ? 'Hồ sơ và mật khẩu đã được cập nhật. Các phiên khác đã bị đăng xuất.'
            : 'Profile and password updated. Other sessions have been signed out.'
          : vi
          ? 'Hồ sơ đã được cập nhật.'
          : 'Your profile has been updated.'
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Mật khẩu hiện tại') || msg.toLowerCase().includes('current password')) {
        setErrors((prev) => ({
          ...prev,
          currentPassword: vi ? 'Mật khẩu hiện tại không chính xác.' : 'Current password is incorrect.',
        }));
      } else {
        Alert.alert(vi ? 'Không thể cập nhật' : 'Update failed', msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{vi ? 'Cài đặt tài khoản' : 'Account settings'}</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.section, { color: colors.text }]}>{vi ? 'Ảnh đại diện' : 'Avatar'}</Text>
        <View style={styles.avatarCenterWrapper}>
          <Pressable style={styles.avatarCircle} onPress={chooseAvatar} disabled={busy || avatarLoading}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{user.display_name.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            {avatarLoading ? (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator color="#FFFFFF" size="small" />
              </View>
            ) : (
              <View style={styles.avatarOverlay}>
                <Ionicons name="camera" size={15} color="#FFFFFF" />
                <Text style={styles.avatarOverlayText}>{vi ? 'Chọn ảnh' : 'Change'}</Text>
              </View>
            )}
          </Pressable>

          {user.avatar_url && (
            <Pressable
              onPress={() => run(async () => onUserUpdated(await removeAvatar()))}
              disabled={busy || avatarLoading}
              style={styles.removeButton}>
              <Ionicons name="trash-outline" size={14} color="#DC2626" />
              <Text style={styles.removeText}>{vi ? 'Xóa ảnh' : 'Remove'}</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.section, { color: colors.text }]}>{vi ? 'Thông tin hồ sơ' : 'Profile'}</Text>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.text }]}>{vi ? 'Tên hiển thị' : 'Display name'}</Text>
          <TextInput
            value={displayName}
            onChangeText={(val) => {
              setDisplayName(val);
              if (errors.displayName) {
                setErrors((prev) => ({ ...prev, displayName: undefined }));
              }
            }}
            maxLength={100}
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }, errors.displayName ? styles.inputError : null]}
          />
          {errors.displayName ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{errors.displayName}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.text }]}>{vi ? 'Email tài khoản' : 'Account email'}</Text>
          <Text style={[styles.email, { color: colors.muted }]}>{user.email}</Text>
        </View>

        <Text style={[styles.section, { color: colors.text }]}>{vi ? 'Đổi mật khẩu' : 'Change password'}</Text>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.text }]}>{vi ? 'Mật khẩu hiện tại' : 'Current password'}</Text>
          <View style={[styles.passwordContainer, { backgroundColor: colors.input, borderColor: colors.border }, errors.currentPassword ? styles.inputError : null]}>
            <TextInput
              value={currentPassword}
              onChangeText={(val) => {
                setCurrentPassword(val);
                if (errors.currentPassword) {
                  setErrors((prev) => ({ ...prev, currentPassword: undefined }));
                }
              }}
              secureTextEntry={!showCurrentPassword}
              style={[styles.passwordInput, { color: colors.text }]}
            />
            {currentPassword.length > 0 ? (
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword((prev) => !prev)}
                hitSlop={8}>
                <Ionicons
                  name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.muted}
                />
              </Pressable>
            ) : null}
          </View>
          {errors.currentPassword ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{errors.currentPassword}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.text }]}>{vi ? 'Mật khẩu mới (ít nhất 8 ký tự)' : 'New password (at least 8 characters)'}</Text>
          <View style={[styles.passwordContainer, { backgroundColor: colors.input, borderColor: colors.border }, errors.newPassword ? styles.inputError : null]}>
            <TextInput
              value={newPassword}
              onChangeText={(val) => {
                setNewPassword(val);
                if (errors.newPassword) {
                  setErrors((prev) => ({ ...prev, newPassword: undefined }));
                }
              }}
              secureTextEntry={!showNewPassword}
              style={[styles.passwordInput, { color: colors.text }]}
            />
            {newPassword.length > 0 ? (
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowNewPassword((prev) => !prev)}
                hitSlop={8}>
                <Ionicons
                  name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.muted}
                />
              </Pressable>
            ) : null}
          </View>
          {errors.newPassword ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{errors.newPassword}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.text }]}>{vi ? 'Xác nhận mật khẩu mới' : 'Confirm new password'}</Text>
          <View style={[styles.passwordContainer, { backgroundColor: colors.input, borderColor: colors.border }, errors.confirmPassword ? styles.inputError : null]}>
            <TextInput
              value={confirmPassword}
              onChangeText={(val) => {
                setConfirmPassword(val);
                if (errors.confirmPassword) {
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }
              }}
              secureTextEntry={!showConfirmPassword}
              style={[styles.passwordInput, { color: colors.text }]}
            />
            {confirmPassword.length > 0 ? (
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                hitSlop={8}>
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.muted}
                />
              </Pressable>
            ) : null}
          </View>
          {errors.confirmPassword ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          style={[styles.primaryButton, busy ? styles.primaryButtonDisabled : null]}
          disabled={busy}
          onPress={saveSettings}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>{vi ? 'Lưu thay đổi' : 'Save changes'}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    padding: 20,
    paddingTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  content: { padding: 20, gap: 14 },
  section: { marginTop: 8, fontSize: 16, fontWeight: '700', color: '#0F172A' },
  fieldGroup: {
    gap: 6,
  },
  label: { color: '#334155', fontSize: 13, fontWeight: '600' },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
    color: '#0F172A',
    fontSize: 14,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFF',
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    color: '#0F172A',
    fontSize: 14,
  },
  eyeButton: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingHorizontal: 2,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
  },
  email: { color: '#64748B', fontSize: 14, paddingVertical: 4 },
  avatarCenterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    gap: 8,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#2563EB',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 10,
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  avatarOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 12.5,
  },
  primaryButton: {
    minHeight: 46,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
