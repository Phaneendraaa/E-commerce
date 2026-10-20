import { redirect } from 'next/navigation';

/** Password reset emails link here; the reset flow lives on /forgot-password. */
export default function ResetPasswordPage() {
  redirect('/forgot-password');
}
