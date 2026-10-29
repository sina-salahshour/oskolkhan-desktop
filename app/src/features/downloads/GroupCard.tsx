/** A download-group config card. */
import { Folder, Trash2 } from '@lucide/react';
import { Card, Badge, Icon, IconButton } from '@/components/ui';
import { useI18n } from '@/i18n';
import { toFaDigits } from '@/lib/util/format';
import { useGroupsStore, type DownloadGroup } from './groupsStore';

export function GroupCard({ group }: { group: DownloadGroup }) {
	const { t, lang } = useI18n();
	const removeGroup = useGroupsStore((s) => s.removeGroup);
	const chunks = lang === 'fa' ? toFaDigits(String(group.chunks)) : String(group.chunks);

	return (
		<Card className="flex flex-col gap-3 p-5">
			<div className="flex items-start justify-between gap-2">
				<h3 className="truncate text-base font-bold text-fg">{group.name}</h3>
				<IconButton
					variant="ghost"
					size="sm"
					icon={Trash2}
					label={t('common.delete')}
					onClick={() => removeGroup(group.id)}
				/>
			</div>
			<p className="flex items-center gap-2 text-sm text-muted" dir="ltr">
				<Icon icon={Folder} size={16} />
				<span className="truncate">{group.folder}</span>
			</p>
			<div className="flex flex-wrap gap-2">
				<Badge variant="accent" size="sm">
					{t('downloads.chunks')}: {chunks}
				</Badge>
				{group.autoStart ? (
					<Badge variant="success" size="sm">
						{t('downloads.autoStart')}
					</Badge>
				) : null}
				{group.schedule ? (
					<Badge variant="neutral" size="sm">
						<span dir="ltr">{group.schedule}</span>
					</Badge>
				) : null}
			</div>
		</Card>
	);
}
