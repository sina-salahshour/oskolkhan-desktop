<script lang="ts">
	import { api } from '$lib/api';
	import { t } from '$lib/i18n';
	import ManagedTitleList from '$lib/components/list/ManagedTitleList.svelte';
</script>

<ManagedTitleList
	heading={t('likes.title')}
	emptyIcon="heart"
	emptyTitle={t('likes.empty')}
	load={() => api.likes(0, 1)}
	remove={(id) => api.like({ category: 0, item: id, on: false, status: 0 })}
/>
