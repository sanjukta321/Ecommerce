interface BrandLogoProps {
  appName: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandLogo({ appName, size = 'md' }: BrandLogoProps) {
  if (!appName.trim()) return null;
  const words = appName.trim().split(' ');
  const initials = words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const firstName = words[0];
  const restName = words.slice(1).join(' ');

  const cfg = {
    sm: { badge: 28, badgeFont: 11, textSize: 15, gap: 8, radius: 7 },
    md: { badge: 36, badgeFont: 14, textSize: 20, gap: 10, radius: 9 },
    lg: { badge: 44, badgeFont: 17, textSize: 26, gap: 12, radius: 11 },
  }[size];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: cfg.gap }}>
      <div style={{
        width: cfg.badge, height: cfg.badge, flexShrink: 0,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: cfg.radius,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: cfg.badgeFont, color: '#fff',
        letterSpacing: '0.5px',
        boxShadow: '0 2px 10px rgba(102,126,234,0.45)',
      }}>
        {initials}
      </div>
      <span style={{
        fontWeight: 700, fontSize: cfg.textSize, lineHeight: 1, whiteSpace: 'nowrap',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        {firstName}
        {restName && (
          <span style={{ fontWeight: 400 }}> {restName}</span>
        )}
      </span>
    </div>
  );
}
