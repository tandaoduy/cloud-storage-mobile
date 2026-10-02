import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { createFolder, deleteFile, deleteFolder, fetchFiles, fetchFolders, fetchProfile, fetchStorageUsage, RemoteFile, RemoteFolder, renameFile, Session, uploadFile } from '@/services/auth';
import { AccountSettingsModal } from '@/components/AccountSettingsModal';

type Language = 'vi' | 'en';

interface UserDashboardProps {
  session: Session;
  language: Language;
  setLanguage: (lang: Language) => void;
  onLogout: () => void;
}

export type MainTab = 'home' | 'starred' | 'shared' | 'files';
export type HomeSubTab = 'suggested' | 'activity';
export type FilesSubTab = 'my_drive' | 'computers';
export type FileTypeFilter = 'all' | 'doc' | 'sheet' | 'slide' | 'pdf' | 'image' | 'video' | 'archive';

export interface DriveFile {
  id: string;
  name: string;
  fileType: 'doc' | 'sheet' | 'slide' | 'pdf' | 'image' | 'video' | 'audio' | 'archive';
  sizeBytes: number;
  updatedAt: string;
  modifiedBy: string;
  isStarred: boolean;
  folderId?: string;
  sharedBy?: string;
  sharedDate?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  itemCount: number;
  updatedAt: string;
  color?: string;
}

const GIGABYTE = 1024 * 1024 * 1024;
const MEGABYTE = 1024 * 1024;
const BOTTOM_SHEET_DISMISS_DELAY_MS = 300;
let isDocumentPickerOpen = false;

function isPickerAlreadyOpenError(error: unknown): boolean {
  // Expo native exceptions can keep the useful message under `cause` instead of
  // the top-level Error.message (especially on iOS). Check the whole exception
  // shape so a harmless duplicate tap never becomes an upload error alert.
  const messages = new Set<string>();
  const visit = (value: unknown, depth = 0) => {
    if (depth > 3 || value == null) return;
    if (typeof value === 'string') {
      messages.add(value);
      return;
    }
    if (value instanceof Error) messages.add(value.message);
    if (typeof value !== 'object') return;

    for (const nestedValue of Object.values(value)) visit(nestedValue, depth + 1);
  };

  visit(error);
  const message = [...messages].join(' ').toLowerCase();
  return message.includes('pickinginprogressexception') || message.includes('document picking in progress');
}

function fileTypeFromMime(file: RemoteFile): DriveFile['fileType'] {
  if (file.mime_type.startsWith('image/')) return 'image';
  if (file.mime_type.startsWith('video/')) return 'video';
  if (file.mime_type.includes('pdf')) return 'pdf';
  if (file.mime_type.includes('spreadsheet') || /\.(xlsx?|csv)$/i.test(file.name)) return 'sheet';
  if (file.mime_type.includes('presentation') || /\.(pptx?)$/i.test(file.name)) return 'slide';
  if (/\.(zip|rar|7z)$/i.test(file.name)) return 'archive';
  return 'doc';
}

function splitFileName(name: string): { stem: string; extension: string } {
  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === name.length - 1) return { stem: name, extension: '' };
  return { stem: name.slice(0, lastDotIndex), extension: name.slice(lastDotIndex) };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Initial Mock Data
const INITIAL_FOLDERS: DriveFolder[] = [
  { id: 'f1', name: 'Tài liệu học tập', itemCount: 14, updatedAt: 'Hôm nay' },
  { id: 'f2', name: 'Đồ án tốt nghiệp 65CNTT', itemCount: 8, updatedAt: 'Hôm qua' },
  { id: 'f3', name: 'Ảnh kỷ niệm & Thực tập', itemCount: 42, updatedAt: '3 ngày trước' },
  { id: 'f4', name: 'Hóa đơn & Chứng từ', itemCount: 5, updatedAt: '26 thg 9' },
];

const INITIAL_FILES: DriveFile[] = [
  {
    id: 'f-1',
    name: 'Báo cáo Đồ án Chuyên ngành.pdf',
    fileType: 'pdf',
    sizeBytes: 4.8 * MEGABYTE,
    updatedAt: '10:45',
    modifiedBy: 'Bạn',
    isStarred: true,
    folderId: 'f2',
  },
  {
    id: 'f-2',
    name: 'Slide Thuyết trình Đồ án.pptx',
    fileType: 'slide',
    sizeBytes: 16.5 * MEGABYTE,
    updatedAt: '09:20',
    modifiedBy: 'Bạn',
    isStarred: false,
    folderId: 'f2',
  },
  {
    id: 'f-3',
    name: 'Bảng tổng hợp chi phí dự án.xlsx',
    fileType: 'sheet',
    sizeBytes: 2.1 * MEGABYTE,
    updatedAt: 'Hôm qua',
    modifiedBy: 'Bạn',
    isStarred: true,
    folderId: 'f4',
  },
  {
    id: 'f-4',
    name: 'Tài liệu hướng dẫn sử dụng Cloud.docx',
    fileType: 'doc',
    sizeBytes: 3.4 * MEGABYTE,
    updatedAt: 'Hôm qua',
    modifiedBy: 'Bạn',
    isStarred: false,
    folderId: 'f1',
  },
  {
    id: 'f-5',
    name: 'Ảnh kỷ yếu lớp 65CNTT.png',
    fileType: 'image',
    sizeBytes: 7.8 * MEGABYTE,
    updatedAt: '28 thg 9',
    modifiedBy: 'Bạn',
    isStarred: true,
    folderId: 'f3',
  },
  {
    id: 'f-6',
    name: 'Video Demo Ứng Dụng Mobile.mp4',
    fileType: 'video',
    sizeBytes: 120 * MEGABYTE,
    updatedAt: '25 thg 9',
    modifiedBy: 'Bạn',
    isStarred: false,
    folderId: 'f2',
  },
  {
    id: 'f-7',
    name: 'Source_Code_Backup_v1.zip',
    fileType: 'archive',
    sizeBytes: 65 * MEGABYTE,
    updatedAt: '22 thg 9',
    modifiedBy: 'Bạn',
    isStarred: false,
    folderId: 'f1',
  },
];

const SHARED_FILES: DriveFile[] = [
  {
    id: 'sf-1',
    name: 'Đề cương môn học Điện toán đám mây.pdf',
    fileType: 'pdf',
    sizeBytes: 1.8 * MEGABYTE,
    updatedAt: 'Hôm qua',
    modifiedBy: 'Giảng viên hướng dẫn',
    isStarred: true,
    sharedBy: 'Khoa Công nghệ Thông tin',
    sharedDate: 'Hôm qua',
  },
  {
    id: 'sf-2',
    name: 'Phân công nhiệm vụ đề tài tốt nghiệp.xlsx',
    fileType: 'sheet',
    sizeBytes: 950 * 1024,
    updatedAt: '25 thg 9',
    modifiedBy: 'Trưởng nhóm',
    isStarred: false,
    sharedBy: 'tran.van.b@ntu.edu.vn',
    sharedDate: '25 thg 9',
  },
  {
    id: 'sf-3',
    name: 'Tài liệu kiến trúc hệ thống Microservices.docx',
    fileType: 'doc',
    sizeBytes: 5.2 * MEGABYTE,
    updatedAt: '20 thg 9',
    modifiedBy: 'Nguyễn Văn A',
    isStarred: true,
    sharedBy: 'nguyen.van.a@ntu.edu.vn',
    sharedDate: '20 thg 9',
  },
];

export function UserDashboard({
  session,
  language,
  setLanguage,
  onLogout,
}: UserDashboardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // Navigation Tabs state
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [homeSubTab, setHomeSubTab] = useState<HomeSubTab>('suggested');
  const [filesSubTab, setFilesSubTab] = useState<FilesSubTab>('my_drive');
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortOrder, setSortOrder] = useState<'name' | 'modified'>('modified');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Storage and User state
  const [userProfile, setUserProfile] = useState(session.user);
  const [quotaBytes, setQuotaBytes] = useState(session.user.quota_bytes ?? 15 * GIGABYTE);
  const [usedStorageBytes, setUsedStorageBytes] = useState(
    session.user.used_storage_bytes && session.user.used_storage_bytes > 0
      ? session.user.used_storage_bytes
      : 2.3 * GIGABYTE
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Files & Folders state
  const [folders, setFolders] = useState<DriveFolder[]>(INITIAL_FOLDERS);
  const [files, setFiles] = useState<DriveFile[]>(INITIAL_FILES);
  const [sharedFiles] = useState<DriveFile[]>(SHARED_FILES);

  // Modals & Dropdown state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [fileActionSheetOpen, setFileActionSheetOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [renameFileModalOpen, setRenameFileModalOpen] = useState(false);
  const [renameFileName, setRenameFileName] = useState('');
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Translations
  const isVi = language === 'vi';
  const t = useMemo(() => {
    return isVi
      ? {
          searchPlaceholder: 'Tìm kiếm tệp, thư mục...',
          tabHome: 'Trang chủ',
          tabStarred: 'Đã gắn dấu sao',
          tabShared: 'Được chia sẻ',
          tabFiles: 'Tệp tin',
          suggested: 'Được đề xuất',
          activity: 'Hoạt động',
          myDrive: 'Tệp của tôi',
          computers: 'Bộ nhớ dùng chung',
          folders: 'Thư mục',
          filesLabel: 'Tệp tin',
          nameSort: 'Tên',
          modifiedSort: 'Sửa đổi gần đây',
          createNew: 'Tạo mới',
          folder: 'Thư mục',
          upload: 'Tải lên',
          scan: 'Quét tài liệu',
          docType: 'Tài liệu văn bản',
          sheetType: 'Bảng tính',
          slideType: 'Bản trình bày',
          storageUsed: 'Bộ nhớ đã dùng',
          storageDetails: 'Chi tiết bộ nhớ',
          getMoreStorage: 'Nâng cấp bộ nhớ',
          recent: 'Gần đây',
          offline: 'Ngoại tuyến',
          trash: 'Thùng rác',
          notifications: 'Thông báo',
          settings: 'Cài đặt',
          language: 'Ngôn ngữ',
          help: 'Trợ giúp & phản hồi',
          signOut: 'Đăng xuất',
          signOutConfirm: 'Bạn có chắc chắn muốn đăng xuất tài khoản?',
          cancel: 'Hủy',
          create: 'Tạo',
          folderNameHint: 'Thư mục không có tiêu đề',
          share: 'Chia sẻ',
          addToStarred: 'Thêm vào mục có dấu sao',
          removeFromStarred: 'Xóa khỏi mục có dấu sao',
          download: 'Tải xuống',
          rename: 'Đổi tên',
          fileNameHint: 'Nhập tên tệp',
          fileExtensionLocked: 'Đuôi tệp được giữ nguyên',
          move: 'Di chuyển',
          details: 'Chi tiết tệp tin',
          delete: 'Xóa',
          deleteConfirm: 'Chuyển tệp này vào Thùng rác?',
          emptyStarred: 'Chưa có mục nào được gắn dấu sao',
          emptyStarredHint: 'Gắn dấu sao cho các tệp bạn muốn tìm kiếm nhanh sau này.',
          emptyShared: 'Không có tệp nào được chia sẻ',
          emptySharedHint: 'Các tệp mà người khác chia sẻ với bạn sẽ xuất hiện ở đây.',
          noResults: 'Không tìm thấy kết quả nào phù hợp',
          uploadSuccess: 'Tải lên tệp thành công!',
          folderCreated: 'Đã tạo thư mục mới.',
          youModified: 'Bạn đã sửa đổi',
        }
      : {
          searchPlaceholder: 'Search files, folders...',
          tabHome: 'Home',
          tabStarred: 'Starred',
          tabShared: 'Shared',
          tabFiles: 'Files',
          suggested: 'Suggested',
          activity: 'Activity',
          myDrive: 'My Files',
          computers: 'Shared Storage',
          folders: 'Folders',
          filesLabel: 'Files',
          nameSort: 'Name',
          modifiedSort: 'Last modified',
          createNew: 'Create new',
          folder: 'Folder',
          upload: 'Upload',
          scan: 'Scan document',
          docType: 'Document',
          sheetType: 'Spreadsheet',
          slideType: 'Presentation',
          storageUsed: 'Storage used',
          storageDetails: 'Storage details',
          getMoreStorage: 'Upgrade storage',
          recent: 'Recent',
          offline: 'Offline',
          trash: 'Trash',
          notifications: 'Notifications',
          settings: 'Settings',
          language: 'Language',
          help: 'Help & feedback',
          signOut: 'Sign out',
          signOutConfirm: 'Are you sure you want to sign out?',
          cancel: 'Cancel',
          create: 'Create',
          folderNameHint: 'Untitled folder',
          share: 'Share',
          addToStarred: 'Add to Starred',
          removeFromStarred: 'Remove from Starred',
          download: 'Download',
          rename: 'Rename',
          fileNameHint: 'Enter file name',
          fileExtensionLocked: 'File extension is kept unchanged',
          move: 'Move',
          details: 'File details',
          delete: 'Remove',
          deleteConfirm: 'Move this file to Trash?',
          emptyStarred: 'No starred items',
          emptyStarredHint: 'Star files to quickly find them later.',
          emptyShared: 'No shared files',
          emptySharedHint: 'Files shared with you will appear here.',
          noResults: 'No matching results found',
          uploadSuccess: 'File uploaded successfully!',
          folderCreated: 'Folder created.',
          youModified: 'You modified',
        };
  }, [isVi]);

  // Fetch real profile & storage
  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const [profile, storage] = await Promise.allSettled([
        fetchProfile(),
        fetchStorageUsage(),
      ]);
      if (profile.status === 'fulfilled') {
        setUserProfile(profile.value);
        if (profile.value.quota_bytes) setQuotaBytes(profile.value.quota_bytes);
        if (profile.value.used_storage_bytes) {
          setUsedStorageBytes(profile.value.used_storage_bytes);
        }
      }
      if (storage.status === 'fulfilled') {
        setQuotaBytes(storage.value.quota_bytes);
        setUsedStorageBytes(storage.value.used_storage_bytes);
      }
    } catch {
      // Keep mock data if offline
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  // Initials
  const initials = useMemo(() => {
    if (!userProfile.display_name) return 'CS';
    return userProfile.display_name
      .split(' ')
      .map((part) => part[0])
      .slice(-2)
      .join('')
      .toUpperCase();
  }, [userProfile.display_name]);

  // Storage percentage
  const usedPercentage = useMemo(() => {
    if (quotaBytes <= 0) return 0;
    return Math.min(100, Math.round((usedStorageBytes / quotaBytes) * 100));
  }, [quotaBytes, usedStorageBytes]);

  // Star / Unstar
  const toggleStar = (fileId: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, isStarred: !f.isStarred } : f))
    );
  };

  const toDriveFolder = useCallback((folder: RemoteFolder): DriveFolder => ({
    id: folder.id,
    name: folder.name,
    itemCount: 0,
    updatedAt: new Date(folder.updated_at).toLocaleDateString(isVi ? 'vi-VN' : 'en-US'),
  }), [isVi]);

  // Create Folder
  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      Alert.alert(isVi ? 'Tên thư mục chưa hợp lệ' : 'Invalid folder name', isVi ? 'Vui lòng nhập tên thư mục.' : 'Enter a folder name.');
      return;
    }
    try {
      const folder = toDriveFolder(await createFolder(name));
      setFolders((current) => [folder, ...current]);
      setNewFolderName('');
      setNewFolderModalOpen(false);
      Alert.alert(isVi ? 'Thành công' : 'Success', t.folderCreated);
    } catch (error) {
      Alert.alert(isVi ? 'Không thể tạo thư mục' : 'Unable to create folder', error instanceof Error ? error.message : String(error));
    }
  };

  const handleDeleteFolder = (folder: DriveFolder) => {
    Alert.alert(
      isVi ? 'Xóa thư mục' : 'Delete folder',
      isVi ? `Bạn có chắc muốn xóa thư mục “${folder.name}”?` : `Delete “${folder.name}”?`,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFolder(folder.id);
              setFolders((current) => current.filter((item) => item.id !== folder.id));
            } catch (error) {
              Alert.alert(isVi ? 'Không thể xóa thư mục' : 'Unable to delete folder', error instanceof Error ? error.message : String(error));
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    void fetchFolders()
      .then((remoteFolders) => setFolders(remoteFolders.map(toDriveFolder)))
      .catch(() => undefined);
  }, [toDriveFolder]);

  useEffect(() => {
    void fetchFiles()
      .then((remoteFiles) => setFiles(remoteFiles.map((file) => ({ id: file.id, name: file.name, fileType: fileTypeFromMime(file), sizeBytes: file.size_bytes, updatedAt: new Date(file.created_at).toLocaleDateString(isVi ? 'vi-VN' : 'en-US'), modifiedBy: 'Bạn', isStarred: false }))))
      .catch(() => undefined);
  }, [isVi]);

  const handleUpload = async () => {
    if (isDocumentPickerOpen) return;

    isDocumentPickerOpen = true;
    setCreateSheetOpen(false);
    try {
      // iOS cannot present the system document picker while the React Native
      // bottom sheet is still being dismissed. Wait for that animation first.
      await new Promise<void>((resolve) => setTimeout(resolve, BOTTOM_SHEET_DISMISS_DELAY_MS));
      const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets[0]) return;

      const uploaded = await uploadFile(picked.assets[0]);
      if (uploaded) {
        const type = fileTypeFromMime(uploaded.file);
        setFiles((current) => [{ id: uploaded.file.id, name: uploaded.file.name, fileType: type, sizeBytes: uploaded.file.size_bytes, updatedAt: isVi ? 'Vừa xong' : 'Just now', modifiedBy: 'Bạn', isStarred: false }, ...current]);
        setUsedStorageBytes(uploaded.storage.used_storage_bytes);
      } else {
        const [remoteFiles, storage] = await Promise.all([fetchFiles(), fetchStorageUsage()]);
        setFiles(remoteFiles.map((file) => ({ id: file.id, name: file.name, fileType: fileTypeFromMime(file), sizeBytes: file.size_bytes, updatedAt: new Date(file.created_at).toLocaleDateString(isVi ? 'vi-VN' : 'en-US'), modifiedBy: 'Bạn', isStarred: false })));
        setUsedStorageBytes(storage.used_storage_bytes);
      }
      Alert.alert(isVi ? 'Thành công' : 'Success', t.uploadSuccess);
    } catch (error) {
      if (isPickerAlreadyOpenError(error)) return;
      Alert.alert(isVi ? 'Không thể tải lên' : 'Upload failed', error instanceof Error ? error.message : String(error));
    } finally {
      isDocumentPickerOpen = false;
    }
  };

  // Delete file
  const handleDeleteFile = (file: DriveFile) => {
    setFileActionSheetOpen(false);
    Alert.alert(t.delete, t.deleteConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            const storage = await deleteFile(file.id);
            setFiles((prev) => prev.filter((f) => f.id !== file.id));
            setUsedStorageBytes(storage.used_storage_bytes);
          } catch (error) {
            Alert.alert(isVi ? 'Không thể xóa tệp' : 'Unable to delete file', error instanceof Error ? error.message : String(error));
          }
        },
      },
    ]);
  };

  const handleRenameFile = async () => {
    const stem = renameFileName.trim();
    if (!selectedFile || !stem) {
      Alert.alert(isVi ? 'Tên tệp chưa hợp lệ' : 'Invalid file name', isVi ? 'Vui lòng nhập tên tệp.' : 'Enter a file name.');
      return;
    }

    const { extension } = splitFileName(selectedFile.name);
    if (extension && splitFileName(stem).extension) {
      Alert.alert(isVi ? 'Không thể đổi tên tệp' : 'Unable to rename file', isVi ? 'Chỉ nhập phần tên, không nhập đuôi tệp như .pdf, .docx hoặc .jpg.' : 'Enter only the name, without an extension such as .pdf, .docx, or .jpg.');
      return;
    }

    try {
      const renamed = await renameFile(selectedFile.id, `${stem}${extension}`);
      setFiles((current) => current.map((file) => file.id === renamed.id ? { ...file, name: renamed.name } : file));
      setSelectedFile((current) => current?.id === renamed.id ? { ...current, name: renamed.name } : current);
      setRenameFileModalOpen(false);
      setRenameFileName('');
    } catch (error) {
      Alert.alert(isVi ? 'Không thể đổi tên tệp' : 'Unable to rename file', error instanceof Error ? error.message : String(error));
    }
  };

  // Filtered files
  const displayedFiles = useMemo(() => {
    let list: DriveFile[] = [];
    if (activeTab === 'starred') {
      list = files.filter((f) => f.isStarred);
    } else if (activeTab === 'shared') {
      list = sharedFiles;
    } else {
      list = files;
    }

    if (typeFilter !== 'all') {
      list = list.filter((f) => f.fileType === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }

    if (sortOrder === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [activeTab, files, sharedFiles, typeFilter, searchQuery, sortOrder]);

  // Theme Colors
  const bgMain = isDark ? '#0F172A' : '#FFFFFF';
  const surfaceContainer = isDark ? '#1E293B' : '#F1F5F9';
  const searchBarBg = isDark ? '#1E293B' : '#F1F5F9';
  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#64748B';
  const activeTabPill = isDark ? '#1E3A8A' : '#DBEAFE';
  const activeTabIcon = isDark ? '#60A5FA' : '#1D4ED8';
  const dividerColor = isDark ? '#334155' : '#E2E8F0';

  // File Icons & Colors
  const getFileBadge = (type: DriveFile['fileType']) => {
    switch (type) {
      case 'doc':
        return { name: 'document-text' as const, color: '#2563EB' }; // Blue Doc
      case 'sheet':
        return { name: 'stats-chart' as const, color: '#10B981' }; // Green Sheet
      case 'slide':
        return { name: 'easel' as const, color: '#F59E0B' }; // Orange Slide
      case 'pdf':
        return { name: 'document-text' as const, color: '#EF4444' }; // Red PDF
      case 'image':
        return { name: 'image' as const, color: '#8B5CF6' }; // Purple Image
      case 'video':
        return { name: 'videocam' as const, color: '#EC4899' }; // Pink Video
      case 'archive':
        return { name: 'archive' as const, color: '#06B6D4' }; // Cyan Archive
      default:
        return { name: 'document-outline' as const, color: '#64748B' };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgMain }]}>
      {/* 1. TOP SEARCH BAR */}
      <View style={[styles.topSearchWrapper, { backgroundColor: bgMain }]}>
        <View style={[styles.searchBar, { backgroundColor: searchBarBg }]}>
          {/* Hamburger Drawer Menu Button */}
          <Pressable
            onPress={() => setDrawerOpen(true)}
            hitSlop={8}
            style={styles.searchMenuBtn}>
            <Ionicons name="menu" size={24} color={textColor} />
          </Pressable>

          {/* Search Input Box */}
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={textMuted}
            style={[styles.searchInput, { color: textColor }]}
            returnKeyType="search"
          />

          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8} style={{ marginRight: 8 }}>
              <Ionicons name="close-circle" size={18} color={textMuted} />
            </Pressable>
          )}

          {/* User Profile Avatar - Tapping opens the Dropdown Menu */}
          <Pressable
            onPress={() => setDropdownOpen((open) => !open)}
            hitSlop={6}
            style={styles.avatarBtn}>
            <View style={styles.userAvatarCircle}>
              {userProfile.avatar_url ? <Image key={userProfile.avatar_url} source={{ uri: userProfile.avatar_url }} style={styles.avatarImage} /> : <Text style={styles.userAvatarText}>{initials}</Text>}
            </View>
          </Pressable>
        </View>
      </View>

      {/* 2. SUB-TABS (Depending on Active Tab) */}
      {activeTab === 'home' && (
        <View style={[styles.subTabsRow, { borderBottomColor: dividerColor }]}>
          <Pressable
            onPress={() => setHomeSubTab('suggested')}
            style={[
              styles.subTabItem,
              homeSubTab === 'suggested' && styles.subTabItemActive,
            ]}>
            <Text
              style={[
                styles.subTabText,
                { color: textMuted },
                homeSubTab === 'suggested' && [styles.subTabTextActive, { color: '#2563EB' }],
              ]}>
              {t.suggested}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setHomeSubTab('activity')}
            style={[
              styles.subTabItem,
              homeSubTab === 'activity' && styles.subTabItemActive,
            ]}>
            <Text
              style={[
                styles.subTabText,
                { color: textMuted },
                homeSubTab === 'activity' && [styles.subTabTextActive, { color: '#2563EB' }],
              ]}>
              {t.activity}
            </Text>
          </Pressable>
        </View>
      )}

      {activeTab === 'files' && (
        <View style={[styles.subTabsRow, { borderBottomColor: dividerColor }]}>
          <Pressable
            onPress={() => setFilesSubTab('my_drive')}
            style={[
              styles.subTabItem,
              filesSubTab === 'my_drive' && styles.subTabItemActive,
            ]}>
            <Text
              style={[
                styles.subTabText,
                { color: textMuted },
                filesSubTab === 'my_drive' && [styles.subTabTextActive, { color: '#2563EB' }],
              ]}>
              {t.myDrive}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilesSubTab('computers')}
            style={[
              styles.subTabItem,
              filesSubTab === 'computers' && styles.subTabItemActive,
            ]}>
            <Text
              style={[
                styles.subTabText,
                { color: textMuted },
                filesSubTab === 'computers' && [styles.subTabTextActive, { color: '#2563EB' }],
              ]}>
              {t.computers}
            </Text>
          </Pressable>
        </View>
      )}

      {/* 3. MAIN CONTENT SCROLLVIEW */}
      <ScrollView
        contentContainerStyle={[
          styles.contentScroll,
          { paddingBottom: insets.bottom + 95 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadData(true)}
            tintColor="#2563EB"
            colors={['#2563EB', '#10B981', '#F59E0B']}
          />
        }>
        {/* Cloud Storage Progress Banner (Shown in Home) */}
        {activeTab === 'home' && (
          <Pressable
            onPress={() => setStorageModalOpen(true)}
            style={[styles.storageBanner, { backgroundColor: surfaceContainer }]}>
            <View style={styles.storageBannerHeader}>
              <View style={styles.storageTitleWrap}>
                <Ionicons name="cloud-outline" size={18} color="#2563EB" />
                <Text style={[styles.storageBannerTitle, { color: textColor }]}>
                  {t.storageUsed}
                </Text>
              </View>
              <Text style={[styles.storageBannerPercent, { color: textMuted }]}>
                {formatBytes(usedStorageBytes)} / {formatBytes(quotaBytes)} ({usedPercentage}%)
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.max(5, usedPercentage)}%` },
                ]}
              />
            </View>
          </Pressable>
        )}

        {/* TYPE FILTER CHIPS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}>
          {[
            { id: 'all' as FileTypeFilter, label: 'Tất cả' },
            { id: 'pdf' as FileTypeFilter, label: 'PDF' },
            { id: 'doc' as FileTypeFilter, label: 'Tài liệu' },
            { id: 'sheet' as FileTypeFilter, label: 'Bảng tính' },
            { id: 'slide' as FileTypeFilter, label: 'Bản trình bày' },
            { id: 'image' as FileTypeFilter, label: 'Ảnh & video' },
          ].map((chip) => {
            const isChipActive = typeFilter === chip.id;
            return (
              <Pressable
                key={chip.id}
                onPress={() => setTypeFilter(chip.id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isChipActive
                      ? isDark
                        ? '#1E3A8A'
                        : '#DBEAFE'
                      : isDark
                      ? '#1E293B'
                      : '#FFFFFF',
                    borderColor: dividerColor,
                  },
                ]}>
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isChipActive
                        ? isDark
                          ? '#93C5FD'
                          : '#1D4ED8'
                        : textMuted,
                      fontWeight: isChipActive ? '700' : '500',
                    },
                  ]}>
                  {chip.label}
                </Text>
                {isChipActive && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={isDark ? '#93C5FD' : '#1D4ED8'}
                    style={{ marginLeft: 4 }}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* SECTION: THƯ MỤC (FOLDERS) - Only on Files Tab */}
        {activeTab === 'files' && filesSubTab === 'my_drive' && (
          <View style={styles.foldersSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textMuted }]}>{t.folders}</Text>
              <Pressable onPress={() => setNewFolderModalOpen(true)}>
                <Text style={styles.actionLinkText}>+ {t.folder}</Text>
              </Pressable>
            </View>

            <View style={styles.foldersGrid}>
              {folders.map((folder) => (
                <View
                  key={folder.id}
                  style={[styles.folderCard, { backgroundColor: surfaceContainer }]}>
                  <Ionicons name="folder" size={24} color="#3B82F6" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.folderCardTitle, { color: textColor }]} numberOfLines={1}>
                      {folder.name}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleDeleteFolder(folder)}
                    hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* SECTION: TỆP (FILES) */}
        <View style={styles.filesSection}>
          <View style={styles.filesControlHeader}>
            <Pressable
              onPress={() => setSortOrder(sortOrder === 'modified' ? 'name' : 'modified')}
              style={styles.sortToggleBtn}>
              <Text style={[styles.sortToggleText, { color: textMuted }]}>
                {sortOrder === 'modified' ? t.modifiedSort : t.nameSort}
              </Text>
              <Ionicons name="arrow-down" size={14} color={textMuted} style={{ marginLeft: 4 }} />
            </Pressable>

            <View style={styles.viewModeWrap}>
              <Pressable
                onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                hitSlop={8}
                style={styles.viewModeBtn}>
                <Ionicons
                  name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
                  size={20}
                  color={textMuted}
                />
              </Pressable>
            </View>
          </View>

          {/* File Items Rendering */}
          {displayedFiles.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons
                name={activeTab === 'starred' ? 'star-outline' : 'folder-open-outline'}
                size={54}
                color={textMuted}
              />
              <Text style={[styles.emptyStateTitle, { color: textColor }]}>
                {activeTab === 'starred'
                  ? t.emptyStarred
                  : activeTab === 'shared'
                  ? t.emptyShared
                  : t.noResults}
              </Text>
              <Text style={[styles.emptyStateHint, { color: textMuted }]}>
                {activeTab === 'starred' ? t.emptyStarredHint : t.emptySharedHint}
              </Text>
            </View>
          ) : viewMode === 'list' ? (
            <View style={styles.filesList}>
              {displayedFiles.map((file) => {
                const badge = getFileBadge(file.fileType);
                return (
                  <Pressable
                    key={file.id}
                    onPress={() => {
                      setSelectedFile(file);
                      setFileActionSheetOpen(true);
                    }}
                    style={[styles.fileListItem, { borderBottomColor: dividerColor }]}>
                    <View style={styles.fileListIconWrap}>
                      <Ionicons name={badge.name} size={24} color={badge.color} />
                    </View>

                    <View style={styles.fileListInfo}>
                      <Text style={[styles.fileListTitle, { color: textColor }]} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text style={[styles.fileListMeta, { color: textMuted }]} numberOfLines={1}>
                        {file.sharedBy
                          ? `${file.sharedBy} • ${file.updatedAt}`
                          : `${t.youModified} • ${file.updatedAt}`}
                      </Text>
                    </View>

                    {file.isStarred && (
                      <Ionicons name="star" size={16} color="#F59E0B" style={{ marginRight: 10 }} />
                    )}

                    <Pressable
                      onPress={() => {
                        setSelectedFile(file);
                        setFileActionSheetOpen(true);
                      }}
                      hitSlop={8}
                      style={styles.moreActionBtn}>
                      <Ionicons name="ellipsis-vertical" size={18} color={textMuted} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.filesGrid}>
              {displayedFiles.map((file) => {
                const badge = getFileBadge(file.fileType);
                return (
                  <Pressable
                    key={file.id}
                    onPress={() => {
                      setSelectedFile(file);
                      setFileActionSheetOpen(true);
                    }}
                    style={[styles.fileGridCard, { backgroundColor: surfaceContainer }]}>
                    <View style={styles.fileGridPreview}>
                      <Ionicons name={badge.name} size={36} color={badge.color} />
                    </View>

                    <View style={styles.fileGridFooter}>
                      <Text style={[styles.fileGridTitle, { color: textColor }]} numberOfLines={2}>
                        {file.name}
                      </Text>
                      <View style={styles.fileGridMetaRow}>
                        <Text style={[styles.fileGridMetaText, { color: textMuted }]} numberOfLines={1}>
                          {file.updatedAt}
                        </Text>
                        <Pressable
                          onPress={() => {
                            setSelectedFile(file);
                            setFileActionSheetOpen(true);
                          }}
                          hitSlop={6}>
                          <Ionicons name="ellipsis-vertical" size={16} color={textMuted} />
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 4. FLOATING ACTION BUTTON (+ FAB) */}
      <View style={[styles.fabContainer, { bottom: insets.bottom + 68 }]}>
        <Pressable
          onPress={() => setCreateSheetOpen(true)}
          style={[styles.floatingActionBtn, { backgroundColor: '#2563EB' }]}>
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* 5. BOTTOM NAVIGATION BAR (4 TABS) */}
      <View
        style={[
          styles.bottomNavBar,
          {
            backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
            borderTopColor: dividerColor,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}>
        {/* Tab 1: Trang chủ (Home) */}
        <Pressable onPress={() => setActiveTab('home')} style={styles.navTabItem}>
          <View
            style={[
              styles.navTabPill,
              activeTab === 'home' && { backgroundColor: activeTabPill },
            ]}>
            <Ionicons
              name={activeTab === 'home' ? 'home' : 'home-outline'}
              size={22}
              color={activeTab === 'home' ? activeTabIcon : textMuted}
            />
          </View>
          <Text
            style={[
              styles.navTabLabel,
              { color: activeTab === 'home' ? textColor : textMuted },
              activeTab === 'home' && styles.navTabLabelActive,
            ]}>
            {t.tabHome}
          </Text>
        </Pressable>

        {/* Tab 2: Gắn dấu sao (Starred) */}
        <Pressable onPress={() => setActiveTab('starred')} style={styles.navTabItem}>
          <View
            style={[
              styles.navTabPill,
              activeTab === 'starred' && { backgroundColor: activeTabPill },
            ]}>
            <Ionicons
              name={activeTab === 'starred' ? 'star' : 'star-outline'}
              size={22}
              color={activeTab === 'starred' ? activeTabIcon : textMuted}
            />
          </View>
          <Text
            style={[
              styles.navTabLabel,
              { color: activeTab === 'starred' ? textColor : textMuted },
              activeTab === 'starred' && styles.navTabLabelActive,
            ]}>
            {t.tabStarred}
          </Text>
        </Pressable>

        {/* Tab 3: Được chia sẻ (Shared) */}
        <Pressable onPress={() => setActiveTab('shared')} style={styles.navTabItem}>
          <View
            style={[
              styles.navTabPill,
              activeTab === 'shared' && { backgroundColor: activeTabPill },
            ]}>
            <Ionicons
              name={activeTab === 'shared' ? 'people' : 'people-outline'}
              size={22}
              color={activeTab === 'shared' ? activeTabIcon : textMuted}
            />
          </View>
          <Text
            style={[
              styles.navTabLabel,
              { color: activeTab === 'shared' ? textColor : textMuted },
              activeTab === 'shared' && styles.navTabLabelActive,
            ]}>
            {t.tabShared}
          </Text>
        </Pressable>

        {/* Tab 4: Tệp (Files) */}
        <Pressable onPress={() => setActiveTab('files')} style={styles.navTabItem}>
          <View
            style={[
              styles.navTabPill,
              activeTab === 'files' && { backgroundColor: activeTabPill },
            ]}>
            <Ionicons
              name={activeTab === 'files' ? 'folder' : 'folder-outline'}
              size={22}
              color={activeTab === 'files' ? activeTabIcon : textMuted}
            />
          </View>
          <Text
            style={[
              styles.navTabLabel,
              { color: activeTab === 'files' ? textColor : textMuted },
              activeTab === 'files' && styles.navTabLabelActive,
            ]}>
            {t.tabFiles}
          </Text>
        </Pressable>
      </View>

      {/* 6. DROPDOWN MENU (Settings, Language, Sign out) */}
      {dropdownOpen && (
        <Modal
          visible={dropdownOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setDropdownOpen(false)}>
          <Pressable style={styles.dropdownBackdrop} onPress={() => setDropdownOpen(false)}>
            <View
              style={[
                styles.dropdownCard,
                {
                  top: insets.top + (Platform.OS === 'ios' ? 62 : 68),
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: dividerColor,
                },
              ]}>
              {/* User Profile Header */}
              <View style={styles.dropdownHeaderRow}>
              <View style={styles.dropdownAvatarCircle}>
                  {userProfile.avatar_url ? <Image key={userProfile.avatar_url} source={{ uri: userProfile.avatar_url }} style={styles.dropdownAvatarImage} /> : <Text style={styles.dropdownAvatarText}>{initials}</Text>}
                </View>
                <View style={styles.dropdownUserDetails}>
                  <Text style={[styles.dropdownUserName, { color: textColor }]} numberOfLines={1}>
                    {userProfile.display_name}
                  </Text>
                  <Text style={[styles.dropdownUserEmail, { color: textMuted }]} numberOfLines={1}>
                    {userProfile.email}
                  </Text>
                </View>
              </View>

              <View style={[styles.dropdownDivider, { backgroundColor: dividerColor }]} />


              {/* Menu Item 1: Cài đặt (Settings) */}
              <Pressable
                onPress={() => {
                  setDropdownOpen(false);
                  setSettingsOpen(true);
                }}
                style={styles.dropdownMenuItem}>
                <Ionicons name="settings-outline" size={18} color={textColor} />
                <Text style={[styles.dropdownMenuText, { color: textColor }]}>{t.settings}</Text>
              </Pressable>

              {/* Menu Item 2: Chuyển đổi ngôn ngữ (Language Toggle) */}
              <Pressable
                onPress={() => {
                  setLanguage(language === 'vi' ? 'en' : 'vi');
                  setDropdownOpen(false);
                }}
                style={styles.dropdownMenuItem}>
                <Ionicons name="language-outline" size={18} color={textColor} />
                <View style={styles.dropdownLangRow}>
                  <Text style={[styles.dropdownMenuText, { color: textColor }]}>{t.language}</Text>
                  <View style={[styles.dropdownLangBadge, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <Text style={[styles.dropdownLangBadgeText, { color: textColor }]}>
                      {language === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}
                    </Text>
                  </View>
                </View>
              </Pressable>

              <View style={[styles.dropdownDivider, { backgroundColor: dividerColor }]} />

              {/* Menu Item 3: Đăng xuất (Sign out) */}
              <Pressable
                onPress={() => {
                  setDropdownOpen(false);
                  onLogout();
                }}
                style={styles.dropdownMenuItem}>
                <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                <Text style={[styles.dropdownMenuText, { color: '#DC2626', fontWeight: '700' }]}>
                  {t.signOut}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* 7. MODAL: CREATE NEW SHEET (FAB TAP) */}
      <Modal
        visible={createSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateSheetOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCreateSheetOpen(false)}>
          <View
            style={[
              styles.bottomSheetCard,
              { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', paddingBottom: insets.bottom + 20 },
            ]}>
            <View style={styles.sheetDragHandle} />
            <Text style={[styles.createSheetTitle, { color: textColor }]}>{t.createNew}</Text>

            {/* 6-Grid Options: Folder, Upload, Scan, Docs, Sheets, Slides */}
            <View style={styles.createGrid}>
              {/* 1: Folder */}
              <Pressable
                onPress={() => {
                  setCreateSheetOpen(false);
                  setNewFolderModalOpen(true);
                }}
                style={styles.createGridItem}>
                <View style={[styles.createIconCircle, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                  <Ionicons name="folder-outline" size={26} color="#3B82F6" />
                </View>
                <Text style={[styles.createItemText, { color: textColor }]}>{t.folder}</Text>
              </Pressable>

              {/* 2: Upload */}
              <Pressable
                onPress={() => void handleUpload()}
                style={styles.createGridItem}>
                <View style={[styles.createIconCircle, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                  <Ionicons name="arrow-up" size={26} color="#2563EB" />
                </View>
                <Text style={[styles.createItemText, { color: textColor }]}>{t.upload}</Text>
              </Pressable>

              {/* 3: Scan */}
              <Pressable
                onPress={() => void handleUpload()}
                style={styles.createGridItem}>
                <View style={[styles.createIconCircle, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                  <Ionicons name="camera-outline" size={26} color="#10B981" />
                </View>
                <Text style={[styles.createItemText, { color: textColor }]}>{t.scan}</Text>
              </Pressable>

              {/* 4: Docs */}
              <Pressable
                onPress={() => void handleUpload()}
                style={styles.createGridItem}>
                <View style={[styles.createIconCircle, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                  <Ionicons name="document-text" size={26} color="#2563EB" />
                </View>
                <Text style={[styles.createItemText, { color: textColor }]}>{t.docType}</Text>
              </Pressable>

              {/* 5: Sheets */}
              <Pressable
                onPress={() => void handleUpload()}
                style={styles.createGridItem}>
                <View style={[styles.createIconCircle, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                  <Ionicons name="stats-chart" size={26} color="#10B981" />
                </View>
                <Text style={[styles.createItemText, { color: textColor }]}>{t.sheetType}</Text>
              </Pressable>

              {/* 6: Slides */}
              <Pressable
                onPress={() => void handleUpload()}
                style={styles.createGridItem}>
                <View style={[styles.createIconCircle, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                  <Ionicons name="easel" size={26} color="#F59E0B" />
                </View>
                <Text style={[styles.createItemText, { color: textColor }]}>{t.slideType}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* 8. MODAL: LEFT NAVIGATION DRAWER */}
      <Modal
        visible={drawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDrawerOpen(false)}>
          <View style={[styles.sideDrawer, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', paddingTop: insets.top + 10 }]}>
            {/* Drawer Header with Cloud Storage Logo */}
            <View style={styles.drawerHeader}>
              <Ionicons name="cloud" size={26} color="#2563EB" style={{ marginRight: 8 }} />
              <Text style={[styles.drawerLogoText, { color: textColor }]}>Cloud Storage</Text>
            </View>

            <ScrollView style={{ flex: 1 }}>
              <Pressable
                onPress={() => setDrawerOpen(false)}
                style={styles.drawerItem}>
                <Ionicons name="time-outline" size={22} color={textMuted} />
                <Text style={[styles.drawerItemText, { color: textColor }]}>{t.recent}</Text>
              </Pressable>

              <Pressable
                onPress={() => setDrawerOpen(false)}
                style={styles.drawerItem}>
                <Ionicons name="checkmark-circle-outline" size={22} color={textMuted} />
                <Text style={[styles.drawerItemText, { color: textColor }]}>{t.offline}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setDrawerOpen(false);
                  Alert.alert(t.trash, isVi ? 'Thùng rác trống.' : 'Trash is empty.');
                }}
                style={styles.drawerItem}>
                <Ionicons name="trash-outline" size={22} color={textMuted} />
                <Text style={[styles.drawerItemText, { color: textColor }]}>{t.trash}</Text>
              </Pressable>

              <Pressable
                onPress={() => setDrawerOpen(false)}
                style={styles.drawerItem}>
                <Ionicons name="notifications-outline" size={22} color={textMuted} />
                <Text style={[styles.drawerItemText, { color: textColor }]}>{t.notifications}</Text>
              </Pressable>

              <View style={[styles.drawerDivider, { backgroundColor: dividerColor }]} />

              <Pressable
                onPress={() => {
                  setDrawerOpen(false);
                  setSettingsOpen(true);
                }}
                style={styles.drawerItem}>
                <Ionicons name="settings-outline" size={22} color={textMuted} />
                <Text style={[styles.drawerItemText, { color: textColor }]}>{t.settings}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setDrawerOpen(false);
                  Alert.alert(t.help, 'Cloud Storage v1.0.0');
                }}
                style={styles.drawerItem}>
                <Ionicons name="help-circle-outline" size={22} color={textMuted} />
                <Text style={[styles.drawerItemText, { color: textColor }]}>{t.help}</Text>
              </Pressable>

              <View style={[styles.drawerDivider, { backgroundColor: dividerColor }]} />

              {/* Drawer Storage Section */}
              <View style={styles.drawerStorageSection}>
                <View style={styles.drawerStorageRow}>
                  <Ionicons name="cloud" size={18} color="#2563EB" />
                  <Text style={[styles.drawerStorageLabel, { color: textColor }]}>
                    {t.storageUsed}
                  </Text>
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#334155' : '#E2E8F0', marginVertical: 8 }]}>
                  <View style={[styles.progressBarFill, { width: `${Math.max(5, usedPercentage)}%` }]} />
                </View>
                <Text style={[styles.drawerStorageSub, { color: textMuted }]}>
                  {formatBytes(usedStorageBytes)} / {formatBytes(quotaBytes)}
                </Text>

                <Pressable
                  onPress={() => {
                    setDrawerOpen(false);
                    setStorageModalOpen(true);
                  }}
                  style={[styles.buyStorageBtn, { borderColor: dividerColor }]}>
                  <Text style={styles.buyStorageBtnText}>{t.getMoreStorage}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* 9. MODAL: FILE 3-DOT ACTIONS SHEET */}
      <Modal
        visible={fileActionSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFileActionSheetOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFileActionSheetOpen(false)}>
          <View
            style={[
              styles.bottomSheetCard,
              { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', paddingBottom: insets.bottom + 20 },
            ]}>
            <View style={styles.sheetDragHandle} />

            {selectedFile && (
              <View style={[styles.actionSheetFileHeader, { borderBottomColor: dividerColor }]}>
                <Ionicons
                  name={getFileBadge(selectedFile.fileType).name}
                  size={26}
                  color={getFileBadge(selectedFile.fileType).color}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionSheetFileName, { color: textColor }]} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={[styles.actionSheetFileMeta, { color: textMuted }]}>
                    {formatBytes(selectedFile.sizeBytes)} • {selectedFile.updatedAt}
                  </Text>
                </View>
              </View>
            )}

            {/* Action Items */}
            <Pressable
              onPress={() => {
                setFileActionSheetOpen(false);
                Alert.alert(t.share, isVi ? 'Đã sao chép liên kết tệp!' : 'File link copied!');
              }}
              style={styles.actionSheetItem}>
              <Ionicons name="share-social-outline" size={20} color={textColor} />
              <Text style={[styles.actionSheetItemText, { color: textColor }]}>{t.share}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (selectedFile) toggleStar(selectedFile.id);
                setFileActionSheetOpen(false);
              }}
              style={styles.actionSheetItem}>
              <Ionicons
                name={selectedFile?.isStarred ? 'star' : 'star-outline'}
                size={20}
                color={selectedFile?.isStarred ? '#F59E0B' : textColor}
              />
              <Text style={[styles.actionSheetItemText, { color: textColor }]}>
                {selectedFile?.isStarred ? t.removeFromStarred : t.addToStarred}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setFileActionSheetOpen(false);
                Alert.alert(t.download, isVi ? 'Đang chuẩn bị tải xuống...' : 'Preparing download...');
              }}
              style={styles.actionSheetItem}>
              <Ionicons name="download-outline" size={20} color={textColor} />
              <Text style={[styles.actionSheetItemText, { color: textColor }]}>{t.download}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setFileActionSheetOpen(false);
                if (selectedFile) {
                  setRenameFileName(splitFileName(selectedFile.name).stem);
                  setRenameFileModalOpen(true);
                }
              }}
              style={styles.actionSheetItem}>
              <Ionicons name="pencil-outline" size={20} color={textColor} />
              <Text style={[styles.actionSheetItemText, { color: textColor }]}>{t.rename}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (selectedFile) handleDeleteFile(selectedFile);
              }}
              style={styles.actionSheetItem}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.actionSheetItemText, { color: '#EF4444' }]}>{t.delete}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 10. MODAL: RENAME FILE DIALOG */}
      <Modal
        visible={renameFileModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameFileModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <Text style={[styles.dialogTitle, { color: textColor }]}>{t.rename}</Text>
            <View style={[styles.renameFileInputRow, { backgroundColor: surfaceContainer, borderColor: '#2563EB' }]}>
              <TextInput
                value={renameFileName}
                onChangeText={setRenameFileName}
                placeholder={t.fileNameHint}
                placeholderTextColor={textMuted}
                autoFocus
                style={[styles.renameFileTextInput, { color: textColor }]}
              />
              {!!selectedFile && !!splitFileName(selectedFile.name).extension && (
                <Text style={[styles.renameFileExtension, { color: textMuted }]}>
                  {splitFileName(selectedFile.name).extension}
                </Text>
              )}
            </View>
            <View style={styles.dialogButtonsRow}>
              <Pressable
                onPress={() => {
                  setRenameFileName('');
                  setRenameFileModalOpen(false);
                }}
                style={styles.dialogTextBtn}>
                <Text style={styles.dialogCancelText}>{t.cancel}</Text>
              </Pressable>
              <Pressable onPress={() => void handleRenameFile()} style={styles.dialogTextBtn}>
                <Text style={styles.dialogConfirmText}>{t.rename}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 11. MODAL: CREATE NEW FOLDER DIALOG */}
      <Modal
        visible={newFolderModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNewFolderModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <Text style={[styles.dialogTitle, { color: textColor }]}>{t.folder}</Text>

            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder={t.folderNameHint}
              placeholderTextColor={textMuted}
              autoFocus
              style={[
                styles.dialogTextInput,
                {
                  color: textColor,
                  backgroundColor: surfaceContainer,
                  borderColor: '#2563EB',
                },
              ]}
            />

            <View style={styles.dialogButtonsRow}>
              <Pressable
                onPress={() => {
                  setNewFolderName('');
                  setNewFolderModalOpen(false);
                }}
                style={styles.dialogTextBtn}>
                <Text style={styles.dialogCancelText}>{t.cancel}</Text>
              </Pressable>
              <Pressable onPress={handleCreateFolder} style={styles.dialogTextBtn}>
                <Text style={styles.dialogConfirmText}>{t.create}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 11. MODAL: STORAGE BREAKDOWN */}
      <Modal
        visible={storageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStorageModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <Text style={[styles.dialogTitle, { color: textColor }]}>{t.storageDetails}</Text>
            <Text style={[styles.storageSubText, { color: textMuted }]}>
              {formatBytes(usedStorageBytes)} / {formatBytes(quotaBytes)} {t.storageUsed.toLowerCase()}
            </Text>

            {/* Progress Bar */}
            <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#334155' : '#E2E8F0', marginVertical: 12 }]}>
              <View style={[styles.progressBarFill, { width: `${Math.max(5, usedPercentage)}%` }]} />
            </View>

            <View style={styles.storageCategoryItem}>
              <Ionicons name="document-text" size={18} color="#2563EB" />
              <Text style={[styles.storageCategoryName, { color: textColor }]}>Tài liệu & PDF</Text>
              <Text style={[styles.storageCategoryValue, { color: textMuted }]}>
                {formatBytes(Math.round(usedStorageBytes * 0.45))}
              </Text>
            </View>

            <View style={styles.storageCategoryItem}>
              <Ionicons name="image" size={18} color="#8B5CF6" />
              <Text style={[styles.storageCategoryName, { color: textColor }]}>Hình ảnh & Video</Text>
              <Text style={[styles.storageCategoryValue, { color: textMuted }]}>
                {formatBytes(Math.round(usedStorageBytes * 0.35))}
              </Text>
            </View>

            <View style={styles.storageCategoryItem}>
              <Ionicons name="archive" size={18} color="#06B6D4" />
              <Text style={[styles.storageCategoryName, { color: textColor }]}>Tệp nén & Khác</Text>
              <Text style={[styles.storageCategoryValue, { color: textMuted }]}>
                {formatBytes(Math.round(usedStorageBytes * 0.2))}
              </Text>
            </View>

            <View style={styles.dialogButtonsRow}>
              <Pressable onPress={() => setStorageModalOpen(false)} style={styles.dialogTextBtn}>
                <Text style={styles.dialogConfirmText}>{isVi ? 'Đóng' : 'Close'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <AccountSettingsModal visible={settingsOpen} user={userProfile} language={language} onClose={() => setSettingsOpen(false)} onUserUpdated={setUserProfile} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // 1. TOP SEARCH BAR
  topSearchWrapper: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  searchMenuBtn: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  avatarBtn: {
    marginLeft: 6,
  },
  userAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  avatarImage: { width: 32, height: 32, borderRadius: 16 },

  // 2. SUB-TABS ROW
  subTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  subTabItem: {
    paddingVertical: 10,
    marginRight: 24,
  },
  subTabItemActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#2563EB',
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  subTabTextActive: {
    fontWeight: '700',
  },

  // 3. MAIN CONTENT SCROLL
  contentScroll: {
    paddingTop: 12,
  },

  // STORAGE BANNER
  storageBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
  },
  storageBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  storageTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storageBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  storageBannerPercent: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 3,
  },

  // FILTER CHIPS ROW
  filterChipsRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12.5,
  },

  // SECTION FOLDERS
  foldersSection: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  foldersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48.5%',
    padding: 12,
    borderRadius: 12,
  },
  folderCardTitle: {
    fontSize: 13,
    fontWeight: '500',
  },

  // SECTION FILES
  filesSection: {
    paddingHorizontal: 16,
  },
  filesControlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sortToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortToggleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  viewModeWrap: {},
  viewModeBtn: {
    padding: 4,
  },

  // FILES LIST VIEW
  filesList: {
    marginTop: 4,
  },
  fileListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fileListIconWrap: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileListInfo: {
    flex: 1,
  },
  fileListTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  fileListMeta: {
    fontSize: 11,
  },
  moreActionBtn: {
    padding: 6,
  },

  // FILES GRID VIEW
  filesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  fileGridCard: {
    width: '48.5%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  fileGridPreview: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  fileGridFooter: {
    padding: 10,
  },
  fileGridTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
    minHeight: 28,
  },
  fileGridMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileGridMetaText: {
    fontSize: 10,
  },

  // EMPTY STATE
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
  },
  emptyStateHint: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 30,
  },

  // 4. FLOATING ACTION BUTTON (+ FAB)
  fabContainer: {
    position: 'absolute',
    right: 18,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingActionBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 5. BOTTOM NAVIGATION BAR (4 TABS)
  bottomNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  navTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navTabPill: {
    width: 56,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  navTabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  navTabLabelActive: {
    fontWeight: '700',
  },

  // 6. DROPDOWN MENU
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  dropdownCard: {
    position: 'absolute',
    right: 16,
    width: 260,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
  },
  dropdownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    marginBottom: 6,
  },
  dropdownAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  dropdownAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  dropdownUserDetails: {
    flex: 1,
  },
  dropdownUserName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  dropdownUserEmail: {
    fontSize: 11,
  },
  dropdownDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 10,
  },
  dropdownMenuText: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  dropdownLangRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownLangBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dropdownLangBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
  },

  // MODAL OVERLAYS & SHEETS
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
    alignSelf: 'center',
    marginBottom: 16,
  },
  createSheetTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 16,
  },
  createGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  createGridItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 8,
  },
  createIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  createItemText: {
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
  },

  // SIDE DRAWER
  sideDrawer: {
    width: '75%',
    height: '100%',
    paddingHorizontal: 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 6,
  },
  drawerLogoText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  drawerItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  drawerDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  drawerStorageSection: {
    paddingVertical: 12,
  },
  drawerStorageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerStorageLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  drawerStorageSub: {
    fontSize: 11,
    marginBottom: 12,
  },
  buyStorageBtn: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 7,
    alignItems: 'center',
  },
  buyStorageBtnText: {
    color: '#2563EB',
    fontSize: 12.5,
    fontWeight: '600',
  },

  // ACTION SHEET (3-DOT MENU)
  actionSheetFileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  actionSheetFileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionSheetFileMeta: {
    fontSize: 11,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 14,
  },
  actionSheetItemText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // DIALOG (CREATE FOLDER / STORAGE)
  dialogCard: {
    margin: 24,
    marginVertical: 'auto',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  dialogTextInput: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 18,
  },
  renameFileInputRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  renameFileTextInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    paddingVertical: 0,
  },
  renameFileExtension: {
    fontSize: 14,
    fontWeight: '600',
  },
  dialogButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  dialogTextBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  dialogCancelText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  dialogConfirmText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '700',
  },
  storageSubText: {
    fontSize: 13,
    marginBottom: 4,
  },
  storageCategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  storageCategoryName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  storageCategoryValue: {
    fontSize: 12,
    fontWeight: '600',
  },
});
