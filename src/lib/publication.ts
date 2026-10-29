import type { Post } from './types'

export function publicationPending(post: Post) {
  return post.status === 'publishing' || (post.status === 'scheduled' && Boolean(
    post.publishRequestedAt || post.nextAttemptAt || post.publicationStage ||
    Date.parse(post.scheduledAt) <= Date.parse(post.serverNow ?? post.updatedAt),
  ))
}

export function publicationStatus(post: Post) {
  if (post.status !== 'scheduled' || !publicationPending(post)) return post.status
  return post.nextAttemptAt ? 'retrying' : 'queued'
}

export function publicationMessage(post: Post | null) {
  if (!post) return 'Enviando publicação…'
  if (post.nextAttemptAt && post.status === 'scheduled') return 'Aguardando nova tentativa'
  switch (post.publicationStage) {
    case 'instagram_processing': return 'Instagram processando a mídia…'
    case 'instagram_publishing': return 'Confirmando publicação no Instagram…'
    case 'facebook_publishing': return 'Publicando no Facebook…'
    case 'preparing': return 'Preparando a mídia para publicação…'
    default: return post.status === 'publishing' ? 'Publicando nas redes selecionadas…' : 'Publicação na fila de envio…'
  }
}
