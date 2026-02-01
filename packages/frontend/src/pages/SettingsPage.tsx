import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User,
  Lock,
  Monitor,
  LogOut,
  Trash2,
  Download,
  AlertTriangle,
  Check,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Spinner,
  Badge,
} from '@/components/ui';
import { settingsService, UserSession } from '@/services/settings.service';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/utils/toast';
import { cn } from '@/utils/cn';
import { formatRelativeTime } from '@/utils/formatters';

// Validation schemas
const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  email: z.string().email('Invalid email address').optional(),
}).refine(data => data.fullName || data.email, {
  message: 'At least one field is required',
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  // Fetch profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['settings-profile'],
    queryFn: settingsService.getProfile,
  });

  // Fetch sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['settings-sessions'],
    queryFn: settingsService.getSessions,
  });

  // Profile form
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.fullName || '',
      email: profile?.email || '',
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileFormData) => settingsService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-profile'] });
      toast.success('Profile updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update profile');
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordFormData) =>
      settingsService.changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => {
      toast.success('Password changed. Please log in again.');
      passwordForm.reset();
      logout();
      navigate('/login');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to change password');
    },
  });

  // Revoke session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => settingsService.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-sessions'] });
      toast.success('Session revoked');
    },
  });

  // Revoke all sessions mutation
  const revokeAllMutation = useMutation({
    mutationFn: () => settingsService.revokeAllOtherSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-sessions'] });
      toast.success('All other sessions revoked');
    },
  });

  // Export data mutation
  const exportDataMutation = useMutation({
    mutationFn: settingsService.exportData,
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `account-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    },
    onError: () => {
      toast.error('Failed to export data');
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: () => settingsService.deleteAccount(deletePassword),
    onSuccess: () => {
      toast.success('Account deleted');
      logout();
      navigate('/');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete account');
    },
  });

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" label="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-gray-500">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-gray-500" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <Input
                {...profileForm.register('fullName')}
                defaultValue={profile?.fullName}
                placeholder="Your full name"
                className="mt-1"
              />
              {profileForm.formState.errors.fullName && (
                <p className="mt-1 text-sm text-red-600">
                  {profileForm.formState.errors.fullName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email Address</label>
              <div className="relative mt-1">
                <Input
                  {...profileForm.register('email')}
                  type="email"
                  defaultValue={profile?.email}
                  placeholder="your@email.com"
                />
                {profile?.emailVerified && (
                  <Badge className="absolute right-2 top-1/2 -translate-y-1/2" variant="success">
                    <Check className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-gray-500" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700">Current Password</label>
              <div className="relative mt-1">
                <Input
                  {...passwordForm.register('currentPassword')}
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.formState.errors.currentPassword && (
                <p className="mt-1 text-sm text-red-600">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <div className="relative mt-1">
                <Input
                  {...passwordForm.register('newPassword')}
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.formState.errors.newPassword && (
                <p className="mt-1 text-sm text-red-600">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
              <Input
                {...passwordForm.register('confirmPassword')}
                type="password"
                placeholder="Confirm new password"
                className="mt-1"
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  'Change Password'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Sessions Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-gray-500" />
            Active Sessions
          </CardTitle>
          {sessions && sessions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => revokeAllMutation.mutate()}
              disabled={revokeAllMutation.isPending}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out all others
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : !sessions || sessions.length === 0 ? (
            <p className="text-center text-gray-500">No active sessions</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session: UserSession) => (
                <div
                  key={session.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-4',
                    session.isCurrent && 'border-primary-200 bg-primary-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Monitor className="h-8 w-8 text-gray-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {session.deviceInfo || 'Unknown Device'}
                        </p>
                        {session.isCurrent && (
                          <Badge variant="primary">Current</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {session.ipAddress || 'Unknown IP'} •{' '}
                        Last active {formatRelativeTime(session.lastUsed)}
                      </p>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeSessionMutation.mutate(session.id)}
                      disabled={revokeSessionMutation.isPending}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-gray-500" />
            Export Your Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-gray-600">
            Download a copy of all your data including your profile, PDFs, quizzes, and statistics.
          </p>
          <Button
            variant="outline"
            onClick={() => exportDataMutation.mutate()}
            disabled={exportDataMutation.isPending}
          >
            {exportDataMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing export...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download My Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader className="border-b border-red-100 bg-red-50">
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">Delete Account</h3>
              <p className="mt-1 text-sm text-gray-500">
                Once you delete your account, there is no going back. All your data will be permanently removed.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Type DELETE MY ACCOUNT to confirm
                </label>
                <Input
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE MY ACCOUNT"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Enter your password
                </label>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  className="mt-1"
                />
              </div>

              <Button
                variant="destructive"
                onClick={() => deleteAccountMutation.mutate()}
                disabled={
                  deleteConfirmation !== 'DELETE MY ACCOUNT' ||
                  !deletePassword ||
                  deleteAccountMutation.isPending
                }
              >
                {deleteAccountMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete My Account
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
