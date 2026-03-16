/**
 * Auth Layout — transparent passthrough.
 * Each auth page (login, register) manages its own full-screen layout and responsive behavior.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
