/**
 * Design-system barrel. Feature screens import primitives from
 * `@/components/ui` (or a relative path to here). One refined amber/gold accent,
 * flat cinematic surfaces, dark + light, RTL-safe, reduced-motion aware.
 */
export { Icon } from './Icon';
export type { IconProps, LucideIcon } from './Icon';

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { IconButton } from './IconButton';
export type { IconButtonProps, IconButtonVariant, IconButtonSize } from './IconButton';

export { Card, CardHeader, CardTitle, CardBody, CardContent, CardFooter } from './Card';
export type {
	CardProps,
	CardHeaderProps,
	CardTitleProps,
	CardBodyProps,
	CardContentProps,
	CardFooterProps
} from './Card';

export { Badge, Pill } from './Badge';
export type { BadgeProps, PillProps, BadgeVariant, BadgeSize } from './Badge';

export { Chip } from './Chip';
export type { ChipProps } from './Chip';

export { Progress, CircularProgress } from './Progress';
export type { ProgressProps, ProgressSize, CircularProgressProps } from './Progress';

export { Skeleton, SkeletonText } from './Skeleton';
export type { SkeletonProps, SkeletonRounded, SkeletonTextProps } from './Skeleton';

export { Spinner } from './Spinner';
export type { SpinnerProps } from './Spinner';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { ErrorState } from './ErrorState';
export type { ErrorStateProps } from './ErrorState';

export {
	Dialog,
	DialogTrigger,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogFooter,
	DialogTitle,
	DialogDescription
} from './Dialog';
export type {
	DialogProps,
	DialogContentProps,
	DialogSize,
	DialogHeaderProps,
	DialogFooterProps,
	DialogTitleProps,
	DialogDescriptionProps
} from './Dialog';

export {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuGroup,
	DropdownMenuRadioGroup,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioItem,
	DropdownMenuLabel,
	DropdownMenuSeparator
} from './DropdownMenu';
export type {
	DropdownMenuProps,
	DropdownMenuContentProps,
	DropdownMenuItemProps,
	DropdownMenuCheckboxItemProps,
	DropdownMenuRadioItemProps,
	DropdownMenuLabelProps,
	DropdownMenuSeparatorProps
} from './DropdownMenu';

export { Popover, PopoverTrigger, PopoverAnchor, PopoverClose, PopoverContent } from './Popover';
export type { PopoverProps, PopoverContentProps } from './Popover';

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, TooltipTip } from './Tooltip';
export type {
	TooltipProviderProps,
	TooltipProps,
	TooltipContentProps,
	TooltipTipProps
} from './Tooltip';

export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps } from './Tabs';

export { Slider } from './Slider';
export type { SliderProps, SliderSize } from './Slider';

export { Switch, Toggle } from './Switch';
export type { SwitchProps, ToggleProps, SwitchSize } from './Switch';

export {
	Select,
	SelectValue,
	SelectGroup,
	SelectTrigger,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectSeparator
} from './Select';
export type {
	SelectTriggerProps,
	SelectContentProps,
	SelectItemProps,
	SelectLabelProps,
	SelectSeparatorProps
} from './Select';

export { SegmentedControl } from './SegmentedControl';
export type {
	SegmentedControlProps,
	SegmentedOption,
	SegmentedControlSize
} from './SegmentedControl';

export { Input, Textarea, Label, Field } from './Field';
export type { InputProps, TextareaProps, LabelProps, FieldProps } from './Field';

export { Avatar } from './Avatar';
export type { AvatarProps, AvatarSize } from './Avatar';

export { RatingChip } from './RatingChip';
export type { RatingChipProps, RatingTone } from './RatingChip';

export { Toaster } from './Toast';
