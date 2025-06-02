import { LucideIcon } from 'lucide-react';
import { cn } from '@renderer/utils';

interface NavItemProps {
  title: string;
  icon: LucideIcon;
  href: string;
  isActive?: boolean;
}

export const NavItem = ({
  title,
  icon: Icon,
  href,
  isActive,
}: NavItemProps) => {
  return (
    <a
      href={href}
      className={cn(
        'group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent',
      )}
    >
      <Icon className="mr-2 h-4 w-4" />
      <span>{title}</span>
    </a>
  );
};
