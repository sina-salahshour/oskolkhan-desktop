<script lang="ts">
	import { api } from '$lib/api';
	import { t } from '$lib/i18n';
	import ManagedTitleList from '$lib/components/list/ManagedTitleList.svelte';
</script>

<ManagedTitleList
	heading={t('history.title')}
	emptyIcon="clock"
	emptyTitle={t('history.empty')}
	load={() => api.watches(0, 1)}
	remove={(id) => api.removeWatch(id)}
	showProgress
/>
