<script setup lang="ts">
import { IconPhotoOff } from '@tabler/icons-vue'

const props = defineProps<{ src: string; alt: string; eager?: boolean }>()
const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <span class="champion-image">
    <img
      v-if="!failed"
      :src="src"
      :alt="alt"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      @error="failed = true"
    />
    <span v-else class="image-fallback" role="img" :aria-label="alt"
      ><IconPhotoOff :size="26" aria-hidden="true"
    /></span>
  </span>
</template>
