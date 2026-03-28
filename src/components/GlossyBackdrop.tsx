import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function GlossyBackdrop() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  useEffect(() => {
    const root = document.documentElement;

    const handleMouseMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;
      root.style.setProperty('--cursor-x', `${x}%`);
      root.style.setProperty('--cursor-y', `${y}%`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className={`gloss-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden ${isAuthPage ? 'opacity-65' : 'opacity-100'}`}>
      <div className="gloss-orb gloss-orb-a" />
      <div className="gloss-orb gloss-orb-b" />
      <div className="gloss-orb gloss-orb-c" />
      <div className="gloss-orb gloss-orb-d" />
      <div className="gloss-cursor-sheen" />
    </div>
  );
}
