import { useState } from 'react'

/** Shows the like one tick after the click. */
export function LikeButton() {
  const [liked, setLiked] = useState(false)

  return (
    <button type="button" onClick={() => setTimeout(() => setLiked(true), 0)}>
      {liked ? 'Liked' : 'Like'}
    </button>
  )
}
