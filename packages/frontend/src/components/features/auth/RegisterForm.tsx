import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Check, X } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/api';
import { ROUTES } from '@/utils/constants';
import { cn } from '@/utils/cn';

const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface PasswordRequirement {
  label: string;
  regex: RegExp;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: '8+ characters', regex: /.{8,}/ },
  { label: 'Uppercase letter', regex: /[A-Z]/ },
  { label: 'Lowercase letter', regex: /[a-z]/ },
  { label: 'Number', regex: /[0-9]/ },
  { label: 'Special character', regex: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/ },
];

interface RegisterFormProps {
  onSuccess?: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { register: registerUser, isLoading } = useAuthStore();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password', '');

  const onSubmit = async (data: RegisterFormData) => {
    setError(null);
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
      });
      onSuccess?.();
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600">
          <span className="text-2xl font-bold text-white">Q</span>
        </div>
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>Get started with QuizGenius</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div
              className="rounded-md bg-error-50 p-3 text-sm text-error-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                {...register('fullName')}
                type="text"
                id="fullName"
                autoComplete="name"
                placeholder="John Doe"
                className={`flex h-10 w-full rounded-md border bg-white pl-10 pr-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors.fullName ? 'border-error-500' : 'border-gray-300'
                }`}
                aria-invalid={errors.fullName ? 'true' : 'false'}
              />
            </div>
            {errors.fullName && (
              <p className="text-sm text-error-500" role="alert">
                {errors.fullName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                {...register('email')}
                type="email"
                id="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`flex h-10 w-full rounded-md border bg-white pl-10 pr-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors.email ? 'border-error-500' : 'border-gray-300'
                }`}
                aria-invalid={errors.email ? 'true' : 'false'}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-error-500" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="new-password"
                placeholder="Create a strong password"
                className={`flex h-10 w-full rounded-md border bg-white pl-10 pr-10 py-2 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors.password ? 'border-error-500' : 'border-gray-300'
                }`}
                aria-invalid={errors.password ? 'true' : 'false'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            {/* Password requirements */}
            {password && (
              <div className="mt-2 space-y-1">
                {passwordRequirements.map((req) => {
                  const isValid = req.regex.test(password);
                  return (
                    <div
                      key={req.label}
                      className={cn(
                        'flex items-center gap-2 text-xs',
                        isValid ? 'text-success-600' : 'text-gray-500'
                      )}
                    >
                      {isValid ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      {req.label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                {...register('confirmPassword')}
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                autoComplete="new-password"
                placeholder="Confirm your password"
                className={`flex h-10 w-full rounded-md border bg-white pl-10 pr-10 py-2 text-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors.confirmPassword ? 'border-error-500' : 'border-gray-300'
                }`}
                aria-invalid={errors.confirmPassword ? 'true' : 'false'}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-error-500" role="alert">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" loading={isLoading}>
            Create account
          </Button>

          <p className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link
              to={ROUTES.LOGIN}
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
