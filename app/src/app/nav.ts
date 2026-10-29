/**
 * Primary navigation config, shared by the sidebar and the command palette.
 * `labelKey` is an i18n key; `to` is a TanStack Router path.
 */
import {
	Home,
	Compass,
	Search,
	Heart,
	History,
	Download,
	Settings,
	UserRound,
	type LucideIcon
} from '@lucide/react';

export interface NavItem {
	to: string;
	labelKey: string;
	icon: LucideIcon;
}

/** Items shown in the sidebar (in order). */
export const navItems: NavItem[] = [
	{ to: '/', labelKey: 'nav.home', icon: Home },
	{ to: '/explore', labelKey: 'nav.explore', icon: Compass },
	{ to: '/search', labelKey: 'nav.search', icon: Search },
	{ to: '/likes', labelKey: 'nav.likes', icon: Heart },
	{ to: '/history', labelKey: 'nav.history', icon: History },
	{ to: '/downloads', labelKey: 'nav.downloads', icon: Download }
];

/** Items shown lower / in the footer area. */
export const navFooterItems: NavItem[] = [
	{ to: '/settings', labelKey: 'nav.settings', icon: Settings },
	{ to: '/account', labelKey: 'nav.account', icon: UserRound }
];

export const allNavItems: NavItem[] = [...navItems, ...navFooterItems];
