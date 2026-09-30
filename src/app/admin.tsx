import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { deleteUser, listUsers, type ManagedUser, updateUserQuota } from '@/services/admin';
import { getSession, logout } from '@/services/auth';

const GIGABYTE = 1024 * 1024 * 1024;
const formatGb = (bytes: number) => `${Math.round((bytes / GIGABYTE) * 10) / 10} GB`;

export default function AdminDashboard() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [adminName, setAdminName] = useState('Administrator');
  const [menuOpen, setMenuOpen] = useState(false);
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list');
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const [items, session] = await Promise.all([listUsers(), getSession()]);
      setUsers(items);
      setCurrentUserId(session?.user.id ?? null);
      setAdminName(session?.user.display_name ?? 'Administrator');
    } catch (error) {
      Alert.alert('Không thể tải dashboard', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Dashboard data is loaded once after this screen mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const totalQuota = useMemo(() => users.reduce((total, user) => total + user.quota_bytes, 0), [users]);
  const totalUsed = useMemo(() => users.reduce((total, user) => total + user.used_storage_bytes, 0), [users]);

  const addStorage = (user: ManagedUser) => {
    Alert.alert('Tăng dung lượng', `Cộng thêm 1 GB cho ${user.display_name}?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Tăng 1 GB',
        onPress: async () => {
          try {
            const updated = await updateUserQuota(user.id, user.quota_bytes + GIGABYTE);
            setUsers((items) => items.map((item) => (item.id === user.id ? updated : item)));
            if (selectedUser?.id === user.id) {
              setSelectedUser(updated);
            }
          } catch (error) {
            Alert.alert('Không thể cập nhật', error instanceof Error ? error.message : 'Vui lòng thử lại.');
          }
        },
      },
    ]);
  };

  const removeUser = (user: ManagedUser) => {
    Alert.alert('Xoá tài khoản?', `Tài khoản ${user.email} sẽ bị xoá vĩnh viễn.`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUser(user.id);
            setUsers((items) => items.filter((item) => item.id !== user.id));
            if (selectedUser?.id === user.id) {
              setSelectedUser(null);
            }
          } catch (error) {
            Alert.alert('Không thể xoá', error instanceof Error ? error.message : 'Vui lòng thử lại.');
          }
        },
      },
    ]);
  };

  const signOut = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{adminName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.greeting}>{language === 'vi' ? 'Xin chào,' : 'Hello,'}</Text>
            <Text style={styles.title}>{adminName}</Text>
          </View>
          <View style={styles.menuWrap}>
            <Pressable onPress={() => setMenuOpen((open) => !open)} hitSlop={12} style={styles.menuButton}>
              <Ionicons name="ellipsis-horizontal" size={23} color="#0F172A" />
            </Pressable>
            {menuOpen ? (
              <View style={styles.menu}>
                <Pressable
                  onPress={() => {
                    setMenuOpen(false);
                    Alert.alert('Cài đặt', 'Cài đặt hệ thống sẽ được bổ sung ở phiên bản tiếp theo.');
                  }}
                  style={styles.menuItem}>
                  <Ionicons name="settings-outline" size={18} color="#334155" />
                  <Text style={styles.menuText}>{language === 'vi' ? 'Cài đặt' : 'Settings'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setLanguage((value) => (value === 'vi' ? 'en' : 'vi'));
                    setMenuOpen(false);
                  }}
                  style={styles.menuItem}>
                  <Ionicons name="language-outline" size={18} color="#334155" />
                  <Text style={styles.menuText}>{language === 'vi' ? 'English' : 'Tiếng Việt'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  style={styles.menuItem}>
                  <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                  <Text style={styles.logoutMenuText}>{language === 'vi' ? 'Đăng xuất' : 'Sign out'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} />}
            contentContainerStyle={styles.content}>
            {/* Quick Stats */}
            <View style={styles.statsRow}>
              <Stat icon="people" label={language === 'vi' ? 'Tài khoản' : 'Accounts'} value={String(users.length)} color="#2563EB" />
              <Stat icon="server" label={language === 'vi' ? 'Đã dùng' : 'Used'} value={formatGb(totalUsed)} color="#8B5CF6" />
              <Stat icon="pie-chart" label={language === 'vi' ? 'Tổng quota' : 'Total Quota'} value={formatGb(totalQuota)} color="#059669" />
            </View>

            {/* Section Header with View Mode Toggle */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>{language === 'vi' ? 'Người dùng' : 'Users'}</Text>
                <Text style={styles.sectionMeta}>
                  {users.length} {language === 'vi' ? 'tài khoản' : 'accounts'}
                </Text>
              </View>

              <View style={styles.viewModeToggle}>
                <Pressable
                  onPress={() => setViewMode('card')}
                  hitSlop={6}
                  style={[styles.viewModeBtn, viewMode === 'card' && styles.viewModeBtnActive]}>
                  <Ionicons name="grid" size={16} color={viewMode === 'card' ? '#2563EB' : '#64748B'} />
                </Pressable>
                <Pressable
                  onPress={() => setViewMode('list')}
                  hitSlop={6}
                  style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}>
                  <Ionicons name="list" size={17} color={viewMode === 'list' ? '#2563EB' : '#64748B'} />
                </Pressable>
              </View>
            </View>

            {/* List / Card Views with ONLY 2 icon buttons: Eye (Chi tiết) and Trash (Xoá) */}
            {viewMode === 'card' ? (
              users.map((user) => {
                const usage = user.quota_bytes ? Math.min((user.used_storage_bytes / user.quota_bytes) * 100, 100) : 0;
                const isSelf = user.id === currentUserId;
                return (
                  <View key={user.id} style={styles.userCard}>
                    <View style={styles.userTop}>
                      <View style={[styles.avatar, user.role === 'admin' && styles.adminAvatar]}>
                        <Text style={styles.avatarText}>{user.display_name.slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <View style={styles.userInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.name}>{user.display_name}</Text>
                          {user.role === 'admin' ? (
                            <View style={styles.adminBadge}>
                              <Text style={styles.adminBadgeText}>ADMIN</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.email}>{user.email}</Text>
                      </View>
                      {/* Icon buttons in Card view */}
                      <View style={styles.cardActions}>
                        <Pressable
                          onPress={() => setSelectedUser(user)}
                          hitSlop={8}
                          style={styles.cardDetailBtn}>
                          <Ionicons name="eye-outline" size={18} color="#1D4ED8" />
                        </Pressable>
                        <Pressable
                          disabled={isSelf}
                          onPress={() => removeUser(user)}
                          hitSlop={8}
                          style={[styles.cardDeleteBtn, isSelf && styles.disabled]}>
                          <Ionicons name="trash-outline" size={18} color={isSelf ? '#94A3B8' : '#DC2626'} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.quotaLine}>
                      <Text style={styles.quotaText}>
                        {formatGb(user.used_storage_bytes)} / {formatGb(user.quota_bytes)}
                      </Text>
                      <Text style={styles.quotaText}>{Math.round(usage)}%</Text>
                    </View>
                    <View style={styles.bar}>
                      <View style={[styles.barFill, { width: `${usage}%` }]} />
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.listContainer}>
                {users.map((user, idx) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <View
                      key={user.id}
                      style={[styles.userListItem, idx === users.length - 1 && styles.lastListItem]}>
                      {/* Avatar */}
                      <View style={[styles.listAvatar, user.role === 'admin' && styles.adminAvatar]}>
                        <Text style={styles.listAvatarText}>{user.display_name.slice(0, 1).toUpperCase()}</Text>
                      </View>

                      {/* Info: Name & Email */}
                      <View style={styles.listInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.listName} numberOfLines={1}>
                            {user.display_name}
                          </Text>
                          {user.role === 'admin' ? (
                            <View style={styles.adminBadge}>
                              <Text style={styles.adminBadgeText}>ADMIN</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.listEmail} numberOfLines={1}>
                          {user.email}
                        </Text>
                      </View>

                      {/* Chỉ 2 icon buttons: Eye và Trash */}
                      <View style={styles.listActions}>
                        <Pressable
                          onPress={() => setSelectedUser(user)}
                          hitSlop={6}
                          style={styles.listDetailBtn}>
                          <Ionicons name="eye-outline" size={17} color="#1D4ED8" />
                        </Pressable>

                        <Pressable
                          disabled={isSelf}
                          onPress={() => removeUser(user)}
                          hitSlop={6}
                          style={[styles.listDeleteBtn, isSelf && styles.disabled]}>
                          <Ionicons name="trash-outline" size={17} color={isSelf ? '#94A3B8' : '#DC2626'} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        {/* Modal: Xem chi tiết tài khoản */}
        <Modal
          visible={!!selectedUser}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedUser(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              {selectedUser ? (
                <>
                  <View style={styles.modalHeader}>
                    <View style={[styles.avatar, selectedUser.role === 'admin' && styles.adminAvatar]}>
                      <Text style={styles.avatarText}>{selectedUser.display_name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={styles.modalUserInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.modalUserName}>{selectedUser.display_name}</Text>
                        {selectedUser.role === 'admin' ? (
                          <View style={styles.adminBadge}>
                            <Text style={styles.adminBadgeText}>ADMIN</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>
                    </View>
                    <Pressable onPress={() => setSelectedUser(null)} hitSlop={10} style={styles.modalCloseIcon}>
                      <Ionicons name="close" size={20} color="#64748B" />
                    </Pressable>
                  </View>

                  <View style={styles.modalDivider} />

                  <View style={styles.modalDetails}>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>{language === 'vi' ? 'Vai trò' : 'Role'}</Text>
                      <Text style={styles.modalDetailValue}>
                        {selectedUser.role === 'admin'
                          ? language === 'vi' ? 'Quản trị viên' : 'Administrator'
                          : language === 'vi' ? 'Người dùng' : 'Standard User'}
                      </Text>
                    </View>

                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>{language === 'vi' ? 'Dung lượng đã dùng' : 'Storage used'}</Text>
                      <Text style={styles.modalDetailValue}>
                        {formatGb(selectedUser.used_storage_bytes)} / {formatGb(selectedUser.quota_bytes)}
                      </Text>
                    </View>

                    <View style={styles.modalBar}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${
                              selectedUser.quota_bytes
                                ? Math.min((selectedUser.used_storage_bytes / selectedUser.quota_bytes) * 100, 100)
                                : 0
                            }%`,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.modalActions}>
                    <Pressable
                      onPress={() => {
                        const target = selectedUser;
                        addStorage(target);
                      }}
                      style={styles.modalUpgradeBtn}>
                      <Ionicons name="add-circle-outline" size={17} color="#1D4ED8" />
                      <Text style={styles.modalUpgradeText}>
                        {language === 'vi' ? 'Tăng 1 GB' : 'Add 1 GB'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setSelectedUser(null)}
                      style={styles.modalCloseBtn}>
                      <Text style={styles.modalCloseText}>
                        {language === 'vi' ? 'Đóng' : 'Close'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F8FC',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
  },
  headerAvatar: {
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerAvatarText: {
    color: '#1D4ED8',
    fontSize: 18,
    fontWeight: '800',
  },
  greeting: {
    color: '#64748B',
    fontSize: 12,
  },
  title: {
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '800',
    marginTop: 1,
  },
  menuWrap: {
    marginLeft: 'auto',
    position: 'relative',
    zIndex: 10,
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 18,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  menu: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 14,
    borderWidth: 1,
    elevation: 8,
    gap: 2,
    padding: 6,
    position: 'absolute',
    right: 0,
    top: 46,
    width: 174,
    zIndex: 20,
  },
  menuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  menuText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutMenuText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    gap: 14,
    padding: 20,
    paddingTop: 0,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  statIcon: {
    alignItems: 'center',
    borderRadius: 9,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  statValue: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },

  // Section Header & View Mode Switcher
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sectionTitleWrap: {
    gap: 2,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionMeta: {
    color: '#64748B',
    fontSize: 13,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  viewModeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 32,
    borderRadius: 8,
  },
  viewModeBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  // Card View
  userCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 18,
    borderWidth: 1,
    gap: 11,
    padding: 15,
  },
  userTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  adminAvatar: {
    backgroundColor: '#EDE9FE',
  },
  avatarText: {
    color: '#1D4ED8',
    fontSize: 18,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  name: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  adminBadge: {
    backgroundColor: '#EDE9FE',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  adminBadgeText: {
    color: '#6D28D9',
    fontSize: 9,
    fontWeight: '800',
  },
  email: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  quotaLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quotaText: {
    color: '#64748B',
    fontSize: 12,
  },
  bar: {
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    height: 7,
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: '#2563EB',
    borderRadius: 4,
    height: '100%',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDetailBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 9,
    width: 36,
    height: 36,
  },
  cardDeleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 9,
    width: 36,
    height: 36,
  },

  // List View (2 nút: Chi tiết & Xoá)
  listContainer: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  userListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  lastListItem: {
    borderBottomWidth: 0,
  },
  listAvatar: {
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  listAvatarText: {
    color: '#1D4ED8',
    fontSize: 15,
    fontWeight: '800',
  },
  listInfo: {
    flex: 1,
    gap: 2,
  },
  listName: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  listEmail: {
    color: '#64748B',
    fontSize: 11.5,
  },
  listActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listDetailBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 9,
    width: 36,
    height: 36,
  },
  listDeleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 9,
    width: 36,
    height: 36,
  },
  disabled: {
    opacity: 0.45,
  },
  disabledText: {
    color: '#94A3B8',
  },

  // Modal Chi tiết
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalUserInfo: {
    flex: 1,
    gap: 2,
  },
  modalUserName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalUserEmail: {
    fontSize: 12,
    color: '#64748B',
  },
  modalCloseIcon: {
    padding: 4,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  modalDetails: {
    gap: 10,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalDetailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  modalDetailValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  modalBar: {
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    height: 6,
    overflow: 'hidden',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalUpgradeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  modalUpgradeText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  modalCloseBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 10,
  },
  modalCloseText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
});
