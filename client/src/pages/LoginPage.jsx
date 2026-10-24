import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';
import { post } from '../services/apiClient.js';

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [resetSent, setResetSent] = useState(false);
  const { register, handleSubmit, formState: { errors }, getValues } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    try {
      const user = await login(values.email, values.password);
      toast.push('Welcome back', 'success');
      navigate(user.roles?.some((r) => r !== 'CUSTOMER') ? '/admin' : '/');
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };

  const requestReset = async () => {
    const email = getValues('email');
    if (!email) return toast.push('Enter your email first', 'error');
    await post('/auth/request-password-reset', { email }).catch(() => {});
    setResetSent(true);
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4 rounded-2xl border border-line bg-white p-6">
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Password" type="password" {...register('password')} error={errors.password?.message} />
        <Button type="submit" className="w-full">Log in</Button>
        <div className="flex justify-between text-sm">
          <button type="button" onClick={requestReset} className="text-brand">Forgot password?</button>
          <Link to="/register" className="text-brand">Create account</Link>
        </div>
        {resetSent && <p className="text-sm text-success">If an account exists for this email, a reset link was sent.</p>}
      </form>
    </div>
  );
}
