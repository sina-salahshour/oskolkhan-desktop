/** Create-download-group dialog: name, destination folder, chunks (1-8), auto-start, schedule. */
import { useState } from 'react';
import { Folder, CalendarClock } from '@lucide/react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	Field,
	Input,
	Button,
	Switch,
	SegmentedControl,
	Label
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { toFaDigits } from '@/lib/util/format';
import { useGroupsStore } from './groupsStore';

export function NewGroupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
	const { t, lang } = useI18n();
	const addGroup = useGroupsStore((s) => s.addGroup);

	const [name, setName] = useState('');
	const [folder, setFolder] = useState('');
	const [chunks, setChunks] = useState('4');
	const [autoStart, setAutoStart] = useState(false);
	const [schedule, setSchedule] = useState('');

	const canSave = name.trim().length > 0 && folder.trim().length > 0;

	function reset() {
		setName('');
		setFolder('');
		setChunks('4');
		setAutoStart(false);
		setSchedule('');
	}

	function save() {
		if (!canSave) return;
		addGroup({
			name: name.trim(),
			folder: folder.trim(),
			chunks: Number(chunks),
			autoStart,
			schedule: schedule.trim()
		});
		reset();
		onOpenChange(false);
	}

	const digit = (n: number) => (lang === 'fa' ? toFaDigits(String(n)) : String(n));

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) reset();
				onOpenChange(v);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t('downloads.newGroup')}</DialogTitle>
				</DialogHeader>

				<form
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						save();
					}}
				>
					<Field label={t('downloads.newGroup')} htmlFor="group-name">
						<Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} leftIcon={Folder} autoFocus />
					</Field>
					<Field label={t('downloads.folder')} htmlFor="group-folder">
						<Input
							id="group-folder"
							value={folder}
							onChange={(e) => setFolder(e.target.value)}
							placeholder="~/Downloads/OskolKhan"
							dir="ltr"
						/>
					</Field>

					<div className="flex items-center justify-between gap-3">
						<Label>{t('downloads.chunks')}</Label>
						<SegmentedControl
							size="sm"
							value={chunks}
							onValueChange={setChunks}
							aria-label={t('downloads.chunks')}
							options={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: digit(n) }))}
						/>
					</div>

					<div className="flex items-center justify-between gap-3">
						<Label htmlFor="group-auto">{t('downloads.autoStart')}</Label>
						<Switch id="group-auto" checked={autoStart} onCheckedChange={setAutoStart} />
					</div>

					<Field label={t('downloads.schedule')} htmlFor="group-schedule">
						<Input
							id="group-schedule"
							value={schedule}
							onChange={(e) => setSchedule(e.target.value)}
							placeholder="HH:mm"
							leftIcon={CalendarClock}
							dir="ltr"
						/>
					</Field>
				</form>

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						{t('common.cancel')}
					</Button>
					<Button disabled={!canSave} onClick={save}>
						{t('common.save')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
