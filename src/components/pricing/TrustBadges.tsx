import { Shield, Lock, Building, Globe } from '@/icons';

const badges = [
  { icon: Globe, label: 'Swiss Data Residency', flag: '🇨🇭' },
  { icon: Lock, label: 'Zero Retention' },
  { icon: Building, label: 'Banking-Grade Encryption' },
  { icon: Shield, label: 'GDPR Compliant' },
];

export function TrustBadges() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
      {badges.map((badge, index) => (
        <div
          key={index}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          {badge.flag ? (
            <span className="text-base">{badge.flag}</span>
          ) : (
            <badge.icon className="h-4 w-4" />
          )}
          <span>{badge.label}</span>
        </div>
      ))}
    </div>
  );
}
