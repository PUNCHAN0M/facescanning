import { type ReactNode, useEffect, useState } from 'react';

interface ClientOnlyProps {
  children: ReactNode;
}

export function ClientOnly({ children }: Readonly<ClientOnlyProps>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // หลังจาก mount บน client → render content
  }, []);

  if (!mounted) return null; // ก่อน mount → render nothing

  return <>{children}</>;
}
