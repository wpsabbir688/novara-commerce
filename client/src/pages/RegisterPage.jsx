import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { post } from '../services/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
});

export function RegisterPage() {
  const { setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    try {
      const d = await post('/auth/register', values);
      setUser(d.user);
      toast.push('Account created', 'success');
      navigate('/');
    } catch (err) {
      toast.push(err.message, 'error');
    }
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-bold">Create account</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4 rounded-2xl border border-line bg-white p-6">
        <Input label="Full name" {...register('name')} error={errors.name?.message} />
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Password (min 8 characters)" type="password" {...register('password')} error={errors.password?.message} />
        <Input label="Phone (optional, 01XXXXXXXXX)" {...register('phone')} error={errors.phone?.message} />
        <Button type="submit" className="w-full">Create account</Button>
        <p className="text-center text-sm text-muted">Already have an account? <Link to="/login" className="text-brand">Log in</Link></p>
      </form>
    </div>
  );
}
